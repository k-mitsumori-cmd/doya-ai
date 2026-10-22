'use client'

// ドヤ社内インタビュー 新規作成: 方法（録音 / アンケート）と社員の基本情報
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Mic } from 'lucide-react'
import { ActionError, api, Button, Card, describeError, Field, inputCls, Notice, SectionTitle, PageTitle } from '@/components/shanai/ui'
import { useUiNext } from '@/components/shell/ui-next-context'
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
  // 新しい見た目: 入力の誤りは欄の下に（aria-describedby でつなぐ）、送信の失敗は ErrorNotice で出す
  const uiNext = useUiNext()
  const [nameMissing, setNameMissing] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api<{ company: { sources: Source[] } | null }>('/api/shanai/company')
      .then((d) => setSources((d.company?.sources || []).filter((s) => s.kind === 'service')))
      .catch(() => {})
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.intervieweeName.trim()) {
      setError('社員のお名前を入力してください。')
      setNameMissing(true)
      if (uiNext) nameRef.current?.focus()
      return
    }
    setSaving(true)
    setError(null)
    setNameMissing(false)
    setFailure(null)
    try {
      const res = await api<{ id: string }>('/api/shanai/interviews', { method: 'POST', json: { ...form, mode, purpose, tone, serviceSourceIds: serviceIds } })
      router.push(`/shanai/interviews/${res.id}`)
    } catch (e) {
      setError((e as Error).message)
      setFailure(e)
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <PageTitle>インタビューを作る</PageTitle>
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
              aria-pressed={uiNext ? mode === m.key : undefined}
              className={`${uiNext ? 'min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] focus-visible:ring-offset-2 ' : ''}rounded-[var(--r)] border p-4 text-left transition-colors ${mode === m.key ? 'border-[var(--blue)] bg-[var(--blue-soft)] ring-2 ring-[var(--blue-line)]' : 'border-[var(--line)] bg-[var(--paper)] hover:border-[var(--blue-line)]'}`}
            >
              <m.icon aria-hidden="true" className={`h-5 w-5 ${mode === m.key ? 'text-[var(--blue-deep)]' : 'text-[var(--muted)]'}`} />
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
            {uiNext ? (
              <>
                <input
                  ref={nameRef}
                  className={`${inputCls} ${nameMissing ? 'border-rose-400' : ''}`}
                  value={form.intervieweeName}
                  onChange={(e) => {
                    set('intervieweeName')(e)
                    if (nameMissing && e.target.value.trim()) setNameMissing(false)
                  }}
                  placeholder="山田 花子"
                  maxLength={60}
                  required
                  aria-required="true"
                  aria-invalid={nameMissing || undefined}
                  aria-describedby={nameMissing ? 'shanai-new-name-error' : undefined}
                />
                {nameMissing && (
                  <span id="shanai-new-name-error" role="alert" className="mt-1 block text-xs font-bold text-rose-700">
                    社員のお名前を入力してください。
                  </span>
                )}
              </>
            ) : (
              <input className={inputCls} value={form.intervieweeName} onChange={set('intervieweeName')} placeholder="山田 花子" maxLength={60} />
            )}
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
                    aria-pressed={uiNext ? on : undefined}
                    className={`${uiNext ? 'min-h-11 max-w-full truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] ' : ''}rounded-full border px-3 py-1.5 text-xs font-black ${on ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue-deep)]' : 'border-[var(--line)] bg-[var(--paper)] text-[var(--sub)]'}`}
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

      {uiNext ? (
        failure ? (
          <div className="mt-4">
            <ActionError error={describeError(failure)} onRetry={() => void submit()} />
          </div>
        ) : null
      ) : (
        error && (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        )
      )}
      <div className="mt-6 flex justify-end">
        <Button onClick={submit} loading={saving}>
          作成して次へ
        </Button>
      </div>
    </div>
  )
}
