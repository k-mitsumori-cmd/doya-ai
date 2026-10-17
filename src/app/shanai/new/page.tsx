'use client'

// ドヤ社内インタビュー 新規作成: 方法（録音 / アンケート）と社員の基本情報
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Mic } from 'lucide-react'
import { api, Button, Card, Field, inputCls, Notice, SectionTitle } from '@/components/shanai/ui'
import { PURPOSE_LABELS, TONE_LABELS, type ShanaiPurpose, type ShanaiTone } from '@/lib/shanai/types'

interface Source {
  id: string
  kind: string
  label: string
  url: string
}

export default function ShanaiNewPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'voice' | 'survey'>('voice')
  const [form, setForm] = useState({ intervieweeName: '', department: '', position: '', joinYear: '', roleInService: '' })
  const [purpose, setPurpose] = useState<ShanaiPurpose>('recruit')
  const [tone, setTone] = useState<ShanaiTone>('friendly')
  const [sources, setSources] = useState<Source[]>([])
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<{ company: { sources: Source[] } | null }>('/api/shanai/company')
      .then((d) => setSources((d.company?.sources || []).filter((s) => s.kind === 'service')))
      .catch(() => {})
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.intervieweeName.trim()) {
      setError('社員のお名前を入力してください。')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await api<{ id: string }>('/api/shanai/interviews', { method: 'POST', json: { ...form, mode, purpose, tone, serviceSourceIds: serviceIds } })
      router.push(`/shanai/interviews/${res.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-black text-[var(--ink)]">インタビューを作る</h1>
      <p className="mt-1 text-sm font-bold text-[var(--sub)]">素材の集め方と、インタビューする社員の情報を入れてください。</p>

      <Card className="mt-6">
        <SectionTitle step="1" title="素材の集め方" />
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { key: 'voice', icon: Mic, title: '録音から作る', desc: '社内インタビューの録音をアップロードします。AIが文字起こしして記事にします。' },
              { key: 'survey', icon: ClipboardList, title: 'アンケートから作る', desc: '社員にアンケートのURLを送り、書いてもらいます。15問・最低文字数つきです。' },
            ] as const
          ).map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={`rounded-[var(--r)] border p-4 text-left transition-colors ${mode === m.key ? 'border-[var(--blue)] bg-[var(--blue-soft)] ring-2 ring-[var(--blue-line)]' : 'border-[var(--line)] bg-[var(--paper)] hover:border-[var(--blue-line)]'}`}
            >
              <m.icon className={`h-5 w-5 ${mode === m.key ? 'text-[var(--blue-deep)]' : 'text-[var(--muted)]'}`} />
              <p className="mt-2 text-sm font-black text-[var(--ink)]">{m.title}</p>
              <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--sub)]">{m.desc}</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <SectionTitle step="2" title="社員の情報" desc="記事のプロフィール欄に使います。" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="お名前（必須）">
            <input className={inputCls} value={form.intervieweeName} onChange={set('intervieweeName')} placeholder="山田 花子" maxLength={60} />
          </Field>
          <Field label="部署">
            <input className={inputCls} value={form.department} onChange={set('department')} placeholder="カスタマーサクセス部" maxLength={60} />
          </Field>
          <Field label="役職">
            <input className={inputCls} value={form.position} onChange={set('position')} placeholder="リーダー" maxLength={60} />
          </Field>
          <Field label="入社年">
            <input className={inputCls} value={form.joinYear} onChange={set('joinYear')} placeholder="2021年" maxLength={30} />
          </Field>
        </div>

        {sources.length > 0 && (
          <div className="mt-5">
            <p className="text-xs font-black text-[var(--sub)]">関わっているサービス</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((s) => {
                const on = serviceIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                    className={`rounded-full border px-3 py-1.5 text-xs font-black ${on ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue-deep)]' : 'border-[var(--line)] bg-[var(--paper)] text-[var(--sub)]'}`}
                  >
                    {s.label || new URL(s.url).hostname}
                  </button>
                )
              })}
            </div>
            <div className="mt-3">
              <Field label="サービスでの役割" hint="任意">
                <input className={inputCls} value={form.roleInService} onChange={set('roleInService')} placeholder="導入企業のオンボーディングを担当" maxLength={200} />
              </Field>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <SectionTitle step="3" title="記事の方向性" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="記事の目的">
            <select className={inputCls} value={purpose} onChange={(e) => setPurpose(e.target.value as ShanaiPurpose)}>
              {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="文体">
            <select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value as ShanaiTone)}>
              {Object.entries(TONE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} loading={saving}>
          作成して次へ
        </Button>
      </div>
    </div>
  )
}
