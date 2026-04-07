'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Wand2,
  Building2,
  Target,
  Megaphone,
} from 'lucide-react'
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

// 仮入力サンプルデータ
const SAMPLE_FORM: Form = {
  clientName: '株式会社サンプルコスメ',
  industry: 'beauty',
  productName: '新作オーガニック美容液「Luna Glow」',
  lpUrl: 'https://example.com/luna-glow',
  age: '25-44',
  gender: '女性',
  region: '全国',
  interests: 'スキンケア, 美容, ナチュラル志向, インスタ',
  goals: ['認知拡大', '直接購入'],
  periodMonths: 3,
  monthlyBudget: 800000,
  targetCv: '120',
  targetCpa: '6500',
  targetRoas: '350',
  mediaAllocation: { google: 35, meta: 30, line: 15, tiktok: 15, x: 3, yahoo: 2 },
  proposerName: '山田 太郎',
  proposerEmail: 'yamada@example.com',
}

export default function AdSimNewPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const isSessionLoading = status === 'loading'
  const isLoggedIn = !!session?.user

  useEffect(() => {
    if (!isSessionLoading && !isLoggedIn) {
      router.replace('/auth/signin?callbackUrl=/adsim/new')
    }
  }, [isSessionLoading, isLoggedIn, router])

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<Form>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [scraping, setScraping] = useState(false)

  const totalSteps = 3

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const fillSample = () => {
    setForm(SAMPLE_FORM)
    toast.success('サンプルデータを入力しました')
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
      setForm((prev) => ({ ...prev, productName: prev.productName || data.title || '' }))
      toast.success('取得完了')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'LP取得に失敗')
    } finally {
      setScraping(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return form.clientName && form.productName
    if (step === 2) return form.goals.length > 0 && form.monthlyBudget > 0
    if (step === 3) return allocationTotal === 100
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
        throw new Error(err.error || 'プロジェクト作成に失敗')
      }
      const { project } = await createRes.json()

      // 2. 数値シミュレーション
      toast.loading('シミュレーション中...', { id: 'sim' })
      const simRes = await fetch(`/api/adsim/projects/${project.id}/simulate`, { method: 'POST' })
      if (!simRes.ok) throw new Error('シミュレーションに失敗')

      // 3. 提案テキスト生成（SSE）
      toast.loading('提案テキストを生成中... (0/10)', { id: 'sim' })
      const propRes = await fetch(`/api/adsim/projects/${project.id}/proposal?stream=1`, {
        method: 'POST',
      })
      if (!propRes.ok || !propRes.body) throw new Error('提案テキスト生成に失敗')

      const reader = propRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
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
              toast.loading(`提案テキスト生成中... (${data.completed}/${data.total})`, { id: 'sim' })
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
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  const stepInfo = [
    { num: 1, label: 'クライアント情報', icon: Building2 },
    { num: 2, label: '目的・予算', icon: Target },
    { num: 3, label: '媒体配分・提案者', icon: Megaphone },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/adsim" className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ChevronLeft className="h-4 w-4" />
            ダッシュボード
          </Link>
          <button
            type="button"
            onClick={fillSample}
            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Wand2 className="h-3.5 w-3.5" />
            サンプルで全部埋める
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Hero */}
        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
            <Sparkles className="h-3 w-3" />
            STEP {step} / {totalSteps}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">新規広告提案を作成</h1>
          <p className="mt-1 text-sm text-slate-500">
            3ステップで入力 → AI が数値・グラフ・提案文を一気に生成します
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-2">
          {stepInfo.map((s, i) => {
            const isActive = s.num === step
            const isDone = s.num < step
            return (
              <div key={s.num} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isActive
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : isDone
                          ? 'border-indigo-600 bg-white text-indigo-600'
                          : 'border-slate-200 bg-white text-slate-400'
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="hidden md:block">
                    <div
                      className={`text-xs font-semibold ${
                        isActive ? 'text-indigo-700' : isDone ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      STEP {s.num}
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        isActive ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </div>
                  </div>
                </div>
                {i < stepInfo.length - 1 && (
                  <div className={`h-0.5 flex-1 rounded ${isDone ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {/* STEP 1: クライアント情報 */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">クライアント情報</h2>
                <p className="mt-1 text-xs text-slate-500">提案先・商材・ターゲットを入力してください</p>
              </div>
              <LabeledInput label="クライアント名 *" value={form.clientName} onChange={(v) => update('clientName', v)} placeholder="例: 株式会社○○" />
              <LabeledSelect
                label="業種 *"
                value={form.industry}
                onChange={(v) => update('industry', v)}
                options={INDUSTRY_BENCHMARKS.map((b) => ({ value: b.id, label: b.name }))}
              />
              <LabeledInput label="商材・サービス名 *" value={form.productName} onChange={(v) => update('productName', v)} placeholder="例: 新作美容液" />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">LP / サイトURL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={form.lpUrl}
                    onChange={(e) => update('lpUrl', e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={scrapeLp}
                    disabled={scraping || !form.lpUrl}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 disabled:opacity-50"
                  >
                    {scraping && <Loader2 className="h-3 w-3 animate-spin" />}
                    AI自動補完
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <LabeledInput label="年齢層" value={form.age} onChange={(v) => update('age', v)} placeholder="例: 30-45" />
                <LabeledInput label="性別" value={form.gender} onChange={(v) => update('gender', v)} placeholder="例: 男女" />
                <LabeledInput label="地域" value={form.region} onChange={(v) => update('region', v)} placeholder="例: 全国" />
                <LabeledInput label="興味関心" value={form.interests} onChange={(v) => update('interests', v)} placeholder="カンマ区切り" />
              </div>
            </div>
          )}

          {/* STEP 2: 目的・予算 */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">目的・予算・KPI</h2>
                <p className="mt-1 text-xs text-slate-500">提案の目的と予算規模を設定してください</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">目的（複数選択可）*</label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      className={`rounded-full border px-4 py-1.5 text-sm transition ${
                        form.goals.includes(g)
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">提案期間 *</label>
                <div className="grid grid-cols-4 gap-2">
                  {PERIOD_OPTIONS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update('periodMonths', p)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                        form.periodMonths === p
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      {p}ヶ月
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">月額予算（円）*</label>
                <input
                  type="number"
                  value={form.monthlyBudget}
                  onChange={(e) => update('monthlyBudget', Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="mt-1 text-xs text-indigo-700">
                  ¥{form.monthlyBudget.toLocaleString()} × {form.periodMonths}ヶ月 = ¥{(form.monthlyBudget * form.periodMonths).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">目標KPI（任意・空欄ならAIが自動算出）</label>
                <div className="grid grid-cols-3 gap-3">
                  <LabeledInput label="目標CV数" value={form.targetCv} onChange={(v) => update('targetCv', v)} placeholder="120" />
                  <LabeledInput label="目標CPA(円)" value={form.targetCpa} onChange={(v) => update('targetCpa', v)} placeholder="5000" />
                  <LabeledInput label="目標ROAS(%)" value={form.targetRoas} onChange={(v) => update('targetRoas', v)} placeholder="300" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 媒体配分・提案者 */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">媒体配分・提案者情報</h2>
                <p className="mt-1 text-xs text-slate-500">配分の合計が100%になるように調整してください</p>
              </div>
              <div className="space-y-3">
                {MEDIA_OPTIONS.map((m) => (
                  <div key={m.id}>
                    <label className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{m.name}</span>
                      <span className="text-sm font-bold text-indigo-700">{form.mediaAllocation[m.id] || 0}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={form.mediaAllocation[m.id] || 0}
                      onChange={(e) => updateAllocation(m.id, Number(e.target.value))}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                ))}
              </div>
              <div
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  allocationTotal === 100
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                合計: {allocationTotal}% {allocationTotal !== 100 && '(100%に合わせてください)'}
              </div>
              <div className="border-t border-slate-100 pt-5">
                <label className="mb-2 block text-sm font-semibold text-slate-700">提案者情報（資料に表示されます）</label>
                <div className="grid grid-cols-2 gap-3">
                  <LabeledInput label="提案者名" value={form.proposerName} onChange={(v) => update('proposerName', v)} placeholder="例: 山田太郎" />
                  <LabeledInput label="メール" value={form.proposerEmail} onChange={(v) => update('proposerEmail', v)} placeholder="example@..." />
                </div>
              </div>
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
                <strong className="block mb-1">準備完了！</strong>
                「生成する」を押すと、シミュレーション数値・グラフ・提案テキスト10セクションをまとめて生成します（約1〜3分）。
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              戻る
            </button>
            {step < totalSteps ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
                className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
              >
                次へ
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !canProceed()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <Sparkles className="h-4 w-4" />
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
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
