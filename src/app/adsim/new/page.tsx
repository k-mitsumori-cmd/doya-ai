'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import toast from 'react-hot-toast'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { INDUSTRY_BENCHMARKS, MEDIA_OPTIONS, MediaId } from '@/lib/adsim/benchmark'

const GOAL_OPTIONS = [
  '認知拡大',
  'リード獲得',
  '直接購入',
  'アプリインストール',
  '来店促進',
  'ブランディング',
]

const PERIOD_OPTIONS = [1, 3, 6, 12]

type Form = {
  clientName: string
  industry: string
  productName: string
  lpUrl: string
  age: string
  gender: string
  region: string
  interests: string
  goals: string[]
  periodMonths: number
  monthlyBudget: number
  targetCv: string
  targetCpa: string
  targetRoas: string
  mediaAllocation: Partial<Record<MediaId, number>>
  proposerName: string
  proposerEmail: string
}

const INITIAL_FORM: Form = {
  clientName: '',
  industry: 'ec',
  productName: '',
  lpUrl: '',
  age: '',
  gender: '',
  region: '',
  interests: '',
  goals: [],
  periodMonths: 3,
  monthlyBudget: 500000,
  targetCv: '',
  targetCpa: '',
  targetRoas: '',
  mediaAllocation: { google: 40, meta: 30, line: 15, x: 5, tiktok: 5, yahoo: 5 },
  proposerName: '',
  proposerEmail: '',
}

export default function AdSimNewPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user

  // 未ログインなら /auth/signin にリダイレクト
  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim/new')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [scraping, setScraping] = useState(false)

  const scrapeLp = async () => {
    if (!form.lpUrl) {
      toast.error('LP URL を入力してください')
      return
    }
    setScraping(true)
    try {
      const res = await fetch('/api/adsim/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.lpUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'scrape failed')
      setForm((prev) => ({
        ...prev,
        productName: prev.productName || data.title || '',
      }))
      if (data.description) {
        toast.success(`取得完了: ${String(data.title).substring(0, 40)}`)
      } else {
        toast.success('取得完了')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'LP取得に失敗')
    } finally {
      setScraping(false)
    }
  }

  const totalSteps = 5

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const toggleGoal = (g: string) => {
    update('goals', form.goals.includes(g) ? form.goals.filter((x) => x !== g) : [...form.goals, g])
  }

  const updateAllocation = (media: MediaId, value: number) => {
    update('mediaAllocation', { ...form.mediaAllocation, [media]: value })
  }

  const allocationTotal = Object.values(form.mediaAllocation).reduce(
    (a, b) => (a as number) + (b as number),
    0
  ) as number

  const canProceed = () => {
    if (step === 1) return form.clientName && form.productName
    if (step === 2) return form.goals.length > 0
    if (step === 3) return form.monthlyBudget > 0
    if (step === 4) return allocationTotal === 100
    return true
  }

  const submit = async () => {
    setSubmitting(true)
    try {
      // 1. プロジェクト作成
      const createRes = await fetch('/api/adsim/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${form.clientName} 広告提案`,
          clientName: form.clientName,
          industry: form.industry,
          productName: form.productName,
          lpUrl: form.lpUrl || null,
          targetAudience: {
            age: form.age,
            gender: form.gender,
            region: form.region,
            interests: form.interests.split(',').map((s) => s.trim()).filter(Boolean),
          },
          goals: form.goals,
          periodMonths: form.periodMonths,
          monthlyBudget: form.monthlyBudget,
          targetCv: form.targetCv || null,
          targetCpa: form.targetCpa || null,
          targetRoas: form.targetRoas || null,
          mediaAllocation: form.mediaAllocation,
          proposerName: form.proposerName,
          proposerEmail: form.proposerEmail,
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}))
        if (err.code === 'MONTHLY_LIMIT_REACHED') {
          throw new Error(err.error || '月間上限に達しました')
        }
        throw new Error(err.error || 'プロジェクト作成に失敗')
      }
      const { project } = await createRes.json()

      // 2. 数値シミュレーション
      toast.loading('シミュレーション中...', { id: 'sim' })
      const simRes = await fetch(`/api/adsim/projects/${project.id}/simulate`, { method: 'POST' })
      if (!simRes.ok) throw new Error('シミュレーションに失敗')

      // 3. 提案テキスト生成（SSE: セクションごとに進捗表示）
      toast.loading('提案テキストを生成中... (0/10)', { id: 'sim' })
      const propRes = await fetch(`/api/adsim/projects/${project.id}/proposal?stream=1`, {
        method: 'POST',
      })
      if (!propRes.ok || !propRes.body) throw new Error('提案テキスト生成に失敗')

      const reader = propRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let completed = 0
      let errored = false

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const evt of events) {
          const line = evt.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'section') {
              completed = data.completed
              toast.loading(`提案テキスト生成中... (${completed}/${data.total})`, { id: 'sim' })
            } else if (data.type === 'error') {
              errored = true
              throw new Error(data.error)
            }
          } catch (err) {
            if (errored) throw err
          }
        }
      }

      toast.success('生成完了！', { id: 'sim' })
      router.push(`/adsim/${project.id}`)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : '生成に失敗しました', { id: 'sim' })
    } finally {
      setSubmitting(false)
    }
  }

  if (isSessionLoading || !isLoggedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">新規広告提案を作成</h1>
        <p className="mb-6 text-sm text-gray-600">
          Step {step} / {totalSteps}
        </p>

        {/* Progress */}
        <div className="mb-8 flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i < step ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Step 1: クライアント情報</h2>
              <LabeledInput label="クライアント名 *" value={form.clientName} onChange={(v) => update('clientName', v)} />
              <LabeledSelect
                label="業種 *"
                value={form.industry}
                onChange={(v) => update('industry', v)}
                options={INDUSTRY_BENCHMARKS.map((b) => ({ value: b.id, label: b.name }))}
              />
              <LabeledInput label="商材・サービス名 *" value={form.productName} onChange={(v) => update('productName', v)} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">LP / サイトURL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.lpUrl}
                    onChange={(e) => update('lpUrl', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={scrapeLp}
                    disabled={scraping || !form.lpUrl}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 disabled:opacity-50"
                  >
                    {scraping && <Loader2 className="h-3 w-3 animate-spin" />}
                    AIで自動補完
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">LP URL からタイトル・説明を取得して商材名を自動入力します</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="年齢層" value={form.age} onChange={(v) => update('age', v)} placeholder="例: 30-45" />
                <LabeledInput label="性別" value={form.gender} onChange={(v) => update('gender', v)} placeholder="例: 男女" />
                <LabeledInput label="地域" value={form.region} onChange={(v) => update('region', v)} placeholder="例: 全国" />
                <LabeledInput label="興味関心" value={form.interests} onChange={(v) => update('interests', v)} placeholder="カンマ区切り" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Step 2: 提案目的</h2>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">目的（複数選択可）*</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        form.goals.includes(g)
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-indigo-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">提案期間 *</label>
                <div className="flex gap-2">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update('periodMonths', p)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                        form.periodMonths === p
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {p}ヶ月
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Step 3: 予算・KPI</h2>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">月額予算（円）*</label>
                <input
                  type="number"
                  value={form.monthlyBudget}
                  onChange={(e) => update('monthlyBudget', Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">現在: ¥{form.monthlyBudget.toLocaleString()}</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <LabeledInput label="目標CV数" value={form.targetCv} onChange={(v) => update('targetCv', v)} placeholder="任意" />
                <LabeledInput label="目標CPA" value={form.targetCpa} onChange={(v) => update('targetCpa', v)} placeholder="任意" />
                <LabeledInput label="目標ROAS" value={form.targetRoas} onChange={(v) => update('targetRoas', v)} placeholder="任意" />
              </div>
              <p className="text-xs text-gray-500">
                ※ 未入力の場合、AI が業界平均から自動で逆算します。
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Step 4: 運用媒体・配分</h2>
              <p className="text-xs text-gray-500">
                配分の合計が 100% になるように調整してください。全6媒体に対応しています。
              </p>
              {MEDIA_OPTIONS.map((m) => (
                <div key={m.id}>
                  <label className="mb-1 flex items-center justify-between text-sm font-medium text-gray-700">
                    <span>{m.name}</span>
                    <span className="text-indigo-600">{form.mediaAllocation[m.id] || 0}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.mediaAllocation[m.id] || 0}
                    onChange={(e) => updateAllocation(m.id, Number(e.target.value))}
                    className="w-full"
                  />
                </div>
              ))}
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  allocationTotal === 100
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                合計: {allocationTotal}% {allocationTotal !== 100 && '(100%に合わせてください)'}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold">Step 5: 提案資料の体裁</h2>
              <LabeledInput label="提案者名" value={form.proposerName} onChange={(v) => update('proposerName', v)} />
              <LabeledInput label="提案者メール" value={form.proposerEmail} onChange={(v) => update('proposerEmail', v)} />
              <div className="rounded-lg bg-indigo-50 p-4 text-sm text-indigo-900">
                <strong>準備完了！</strong>
                <br />
                「生成する」を押すと、シミュレーション数値・グラフ・提案テキスト10セクションをまとめて生成します。
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 text-sm text-gray-600 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              戻る
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                生成する
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
    </div>
  )
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
