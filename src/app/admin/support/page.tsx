'use client'

// ============================================
// 管理: サポートチャットの受付（一覧・やり取り・返信・状態）
// ============================================
// 返信は support_message に残り、お客さまが返信を希望していればメールでも届く。
// ⚠️ 表（support_ticket）を本番に流す前は ready: false。受付は「改善点・要望」（serviceId support）に残っている。
// 設計: docs/architecture/support-chat/SUPPORT-CHAT-2026-10-26.md

import { useCallback, useEffect, useState } from 'react'

type Status = 'open' | 'in_progress' | 'waiting_user' | 'closed'
const STATUS_LABEL: Record<Status, string> = { open: '未対応', in_progress: '対応中', waiting_user: 'お返事待ち', closed: '完了' }
const STATUSES: Status[] = ['open', 'in_progress', 'waiting_user', 'closed']
const ROLE_LABEL: Record<string, string> = { user: 'お客さま', ai: 'AI', staff: '運営' }

interface Row {
  id: string
  ticketNo: string
  categoryLabel: string
  status: Status
  severity: string
  summary: string
  pagePath: string | null
  createdAt: string
  firstReplyAt: string | null
  user: string
  plan: string | null
}
interface Detail {
  id: string
  ticketNo: string
  categoryLabel: string
  status: Status
  severity: string
  pagePath: string | null
  env: { userAgent?: string | null; viewport?: string | null; recentErrors?: string[] } | null
  contactOk: boolean
  createdAt: string
  user: { email: string | null; name: string | null; plan: string | null }
  messages: { id: string; role: string; body: string; authorEmail: string | null; emailedAt: string | null; createdAt: string }[]
}

const fmt = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })

export default function AdminSupportPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [counts, setCounts] = useState<Partial<Record<Status, number>>>({})
  const [ready, setReady] = useState(true)
  const [status, setStatus] = useState<Status | ''>('open')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [reply, setReply] = useState('')
  const [closeAfter, setCloseAfter] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetch(`/api/admin/support${status ? `?status=${status}` : ''}`)
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || '読み込めませんでした')
      setRows(data.tickets)
      setCounts(data.counts)
      setReady(data.ready)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込めませんでした')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { void load() }, [load])

  const open = useCallback(async (id: string) => {
    setNotice('')
    const r = await fetch(`/api/admin/support/${id}`)
    const data = await r.json().catch(() => ({}))
    if (r.ok) setDetail(data.ticket)
    else setError(data?.error || '開けませんでした')
  }, [])

  // Slack のリンク（?ticket=受付番号）から来たときは、その受付を開く
  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get('ticket')
    if (!no) return
    setStatus('')
  }, [])
  useEffect(() => {
    const no = new URLSearchParams(window.location.search).get('ticket')
    const hit = no ? rows.find((r) => r.ticketNo === no) : null
    if (hit && !detail) void open(hit.id)
  }, [rows, detail, open])

  const post = useCallback(async (body: Record<string, unknown>) => {
    if (!detail) return
    setSending(true)
    setNotice('')
    try {
      const r = await fetch(`/api/admin/support/${detail.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || '保存できませんでした')
      setDetail(data.ticket)
      if (body.reply) {
        setReply('')
        setNotice(data.mail === 'sent' ? '返信を保存し、メールで送りました。' : data.mail === 'failed' ? '返信を保存しました。メールは送れませんでした（お客さまは画面で読めます）。' : '返信を保存しました（メールは送っていません）。')
      } else {
        setNotice('状態を変えました。')
      }
      void load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存できませんでした')
    } finally {
      setSending(false)
    }
  }, [detail, load])

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">サポートの受付</h1>
          <p className="text-xs text-slate-500">サポートチャットの「運営に伝える」から届いたお問い合わせです。返信はお客さまの画面に出て、希望があればメールでも届きます。</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 lg:col-span-2">{error}</div>}
        {!ready && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 lg:col-span-2">
            受付の表がまだ本番のデータベースにありません。それまでの受付は「改善点・要望」（サポートチャット）に残っています。
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap gap-2">
            {(['', ...STATUSES] as const).map((s) => (
              <button
                key={s || 'all'}
                onClick={() => setStatus(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm ${status === s ? 'bg-[#0066ff] text-white' : 'border border-slate-300 bg-white text-slate-700'}`}
              >
                {s ? `${STATUS_LABEL[s]} ${counts[s] ?? 0}件` : 'すべて'}
              </button>
            ))}
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {loading ? (
              <p className="py-4 text-sm text-slate-500">読み込み中...</p>
            ) : rows.length === 0 ? (
              <p className="py-4 text-sm text-slate-500">この状態の受付はありません。</p>
            ) : rows.map((r) => (
              <button key={r.id} onClick={() => void open(r.id)} className={`block w-full py-3 text-left ${detail?.id === r.id ? 'bg-[#f2f6ff]' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono font-bold text-slate-800">{r.ticketNo}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${r.severity === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{r.categoryLabel}</span>
                  <span>{STATUS_LABEL[r.status] ?? r.status}</span>
                  <span>{fmt(r.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-800">{r.summary}</p>
                <p className="mt-0.5 text-xs text-slate-500">{r.user}（{r.plan || 'プラン不明'}）</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {!detail ? (
            <p className="text-sm text-slate-500">左の一覧から受付を選んでください。</p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-mono text-base font-bold text-slate-900">{detail.ticketNo}</p>
                <p className="text-xs text-slate-500">
                  {detail.categoryLabel} ／ {detail.user.name || '名前なし'}（{detail.user.email || 'メールなし'}・{detail.user.plan || 'プラン不明'}）／ {fmt(detail.createdAt)}
                </p>
                <p className="text-xs text-slate-500">画面: {detail.pagePath || '不明'} ／ 返信のメール: {detail.contactOk ? '希望あり' : '希望なし'}</p>
                {detail.env?.recentErrors?.length ? <p className="mt-1 text-xs text-rose-700">直近のエラー: {detail.env.recentErrors.join(' / ')}</p> : null}
                {detail.env?.userAgent ? <p className="text-xs text-slate-400">{detail.env.viewport} {detail.env.userAgent}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button key={s} disabled={sending || detail.status === s} onClick={() => void post({ status: s })}
                    className={`rounded-full px-3 py-1 text-xs ${detail.status === s ? 'bg-slate-800 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <ol className="space-y-2">
                {detail.messages.map((m) => (
                  <li key={m.id} className={`rounded-xl p-3 text-sm ${m.role === 'staff' ? 'bg-[#f2f6ff]' : m.role === 'ai' ? 'bg-slate-50' : 'bg-white ring-1 ring-slate-200'}`}>
                    <p className="text-xs text-slate-500">
                      {ROLE_LABEL[m.role] ?? m.role}{m.authorEmail ? `（${m.authorEmail}）` : ''} ／ {fmt(m.createdAt)}{m.role === 'staff' ? (m.emailedAt ? ' ／ メール送信済み' : ' ／ メール未送信') : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-800">{m.body}</p>
                  </li>
                ))}
              </ol>
              <div className="space-y-2">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={6} maxLength={4000}
                  placeholder="お客さまへの返信を、丁寧な敬語で書いてください（絵文字は使わない）"
                  className="w-full rounded-xl border border-slate-300 p-3 text-sm" />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={closeAfter} onChange={(e) => setCloseAfter(e.target.checked)} />
                  返信と一緒に「完了」にする（しないときは「お返事待ち」になります）
                </label>
                <button disabled={sending || !reply.trim()} onClick={() => void post({ reply, status: closeAfter ? 'closed' : undefined })}
                  className="rounded-full bg-[#0066ff] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {sending ? '送っています' : detail.contactOk ? '返信する（メールでも送る）' : '返信する（画面だけ）'}
                </button>
                {notice && <p className="text-xs text-emerald-700">{notice}</p>}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
