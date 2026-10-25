'use client'
// ============================================
// サポートチャット（右下の丸いボタンと、チャットの画面）
// ============================================
// 旗 SUPPORT_CHAT_ROLLOUT が出すと決めた人だけ、ShellGate が描く（off なら描かない）。
// 使い方の質問は AI（今はモック）が答え、運営が対応するものは「運営に伝える」から Slack に送る。
// ⚠️ ドヤパワーは減らさない。書いている途中の文は端末（sessionStorage）だけに残す。
// 設計: docs/architecture/support-chat/SUPPORT-CHAT-2026-10-26.md
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { UiIcon } from '@/components/icons'
import { suggestedQuestions, toolIdForPath, toolNameOf, SUPPORT_HOURS_LABEL } from '@/lib/support-chat/knowledge'
import { SUPPORT_CATEGORY_CHOICES, SUPPORT_CATEGORY_LABEL, type SupportCategory } from '@/lib/support-chat/rules'
import styles from './support-chat.module.css'

type Source = { label: string; href: string }
type Msg = { id: number; role: 'user' | 'assistant'; text: string; sources?: Source[]; kind?: 'answer' | 'unknown' | 'staff'; category?: SupportCategory | null }
type View = 'chat' | 'staff' | 'done' | 'tickets' | 'ticket'
type TicketSummary = { ticketNo: string; category: SupportCategory; status: string; summary: string; createdAt: string; unread: boolean }
type TicketDetail = { ticketNo: string; category: SupportCategory; status: string; createdAt: string; messages: { role: 'user' | 'ai' | 'staff'; body: string; createdAt: string }[] }

const STATUS_LABEL: Record<string, string> = { open: '受付済み', in_progress: '対応中', waiting_user: '運営から返信あり', closed: '完了' }
const fmtDate = (iso: string) => new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

const DRAFT_KEY = 'doya:support-chat:draft'
const MAX_ERRORS = 5

function readDraft(): string {
  try { return sessionStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
}
function writeDraft(v: string) {
  try { if (v) sessionStorage.setItem(DRAFT_KEY, v); else sessionStorage.removeItem(DRAFT_KEY) } catch { /* 保存できなくても動かす */ }
}

/** 直近のエラーを集める（不具合の再現の情報。中身はサーバーで伏せ字をかける） */
function useRecentErrors() {
  const ref = useRef<string[]>([])
  useEffect(() => {
    const push = (m: string) => { ref.current = [...ref.current, m.slice(0, 300)].slice(-MAX_ERRORS) }
    const onError = (e: ErrorEvent) => push(`${e.message || 'エラー'}${e.filename ? `（${e.filename.split('?')[0].split('/').pop()}:${e.lineno}）` : ''}`)
    const onRejection = (e: PromiseRejectionEvent) => push(`未処理の失敗: ${String((e.reason as { message?: string })?.message ?? e.reason).slice(0, 200)}`)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection) }
  }, [])
  return ref
}

export default function SupportChat() {
  const pathname = usePathname() || '/'
  const toolId = useMemo(() => toolIdForPath(pathname), [pathname])
  const toolName = toolNameOf(toolId)
  const suggestions = useMemo(() => suggestedQuestions(toolId), [toolId])
  const errors = useRecentErrors()

  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('chat')
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<SupportCategory>('howto')
  const [staffText, setStaffText] = useState('')
  const [contactOk, setContactOk] = useState(true)
  const [done, setDone] = useState<{ ticketNo: string; replyEta: string; history: boolean } | null>(null)
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)
  const [unread, setUnread] = useState(0)
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [followUp, setFollowUp] = useState('')
  const nextId = useRef(1)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => { setDraft(readDraft()) }, [])
  useEffect(() => { writeDraft(draft) }, [draft])

  // 開いたら入力欄へ。閉じたらボタンへフォーカスを戻す。Esc で閉じる
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [open, view])

  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, busy, view])

  const loadTickets = useCallback(async () => {
    try {
      const res = await fetch('/api/support-chat/tickets')
      if (!res.ok) return
      const data = await res.json()
      setTickets(Array.isArray(data.tickets) ? data.tickets : [])
      setUnread(Number(data.unread) || 0)
    } catch { /* 履歴が読めなくてもチャットは使える */ }
  }, [])

  const openTicket = useCallback(async (no: string) => {
    setError(null)
    setBusy(true)
    setView('ticket')
    try {
      const res = await fetch(`/api/support-chat/tickets/${encodeURIComponent(no)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof data?.error === 'string' ? data.error : 'お問い合わせを開けませんでした。'); setTicket(null); return }
      setTicket(data.ticket)
      void loadTickets()
    } catch {
      setError('通信がうまくいきませんでした。つながってから、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }, [loadTickets])

  // 運営の返信の未読の印（開く前から右下のボタンに出す）。メールのリンク（?support=受付番号）からは、その受付を開く
  useEffect(() => {
    void loadTickets()
    const no = new URLSearchParams(window.location.search).get('support')
    if (no && /^DY-\d{6}-[2-9A-HJ-NP-Z]{4}$/.test(no)) { setOpen(true); void openTicket(no) }
  }, [loadTickets, openTicket])

  const sendFollowUp = useCallback(async () => {
    const text = followUp.trim()
    if (!text || busy || !ticket) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/support-chat/tickets/${encodeURIComponent(ticket.ticketNo)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof data?.error === 'string' ? data.error : '送れませんでした。'); return }
      setFollowUp('')
      if (data.ticket) setTicket(data.ticket)
    } catch {
      setError('通信がうまくいきませんでした。つながってから、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }, [busy, followUp, ticket])

  const close = useCallback(() => { setOpen(false); window.setTimeout(() => fabRef.current?.focus(), 0) }, [])

  const openStaff = useCallback((cat?: SupportCategory | null) => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.text ?? draft
    setCategory(cat ?? 'other')
    setStaffText((cur) => cur || lastUser)
    setError(null)
    setView('staff')
  }, [messages, draft])

  const ask = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || busy) return
    setError(null)
    const history = messages.map((m) => ({ role: m.role, text: m.text }))
    setMessages((cur) => [...cur, { id: nextId.current++, role: 'user', text: q }])
    setDraft('')
    setBusy(true)
    try {
      const res = await fetch('/api/support-chat/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, path: pathname }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'いまお答えできませんでした。少し待ってからお試しください。')
        return
      }
      setMessages((cur) => [...cur, { id: nextId.current++, role: 'assistant', text: String(data.text ?? ''), sources: Array.isArray(data.sources) ? data.sources : [], kind: data.kind, category: data.category ?? null }])
    } catch {
      setError('通信がうまくいきませんでした。つながってから、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }, [busy, messages, pathname])

  const sendTicket = useCallback(async () => {
    const text = staffText.trim()
    if (!text || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/support-chat/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: text,
          transcript: messages.map((m) => ({ role: m.role, text: m.text })),
          path: pathname,
          contactOk,
          env: { userAgent: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}`, url: window.location.pathname, recentErrors: errors.current },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : '送れませんでした。時間をおいてもう一度お試しください。')
        return
      }
      setDone({ ticketNo: String(data.ticketNo), replyEta: String(data.replyEta ?? ''), history: data.history === true })
      void loadTickets()
      setStaffText('')
      setView('done')
    } catch {
      setError('通信がうまくいきませんでした。つながってから、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }, [busy, category, contactOk, errors, loadTickets, messages, pathname, staffText])

  const headTitle = view === 'staff' ? '運営に伝える' : view === 'done' ? '受け付けました' : view === 'tickets' ? 'お問い合わせの履歴' : view === 'ticket' ? (ticket?.ticketNo ?? 'お問い合わせ') : 'お気軽にご質問ください'
  const backTo: View | null = view === 'staff' || view === 'tickets' ? 'chat' : view === 'ticket' ? 'tickets' : null

  return (
    <div className={styles.root}>
      <button
        ref={fabRef}
        type="button"
        className={styles.fab}
        data-open={open}
        aria-label="質問・お問い合わせのチャットを開く"
        aria-expanded={open}
        aria-controls="support-chat-panel"
        onClick={() => setOpen(true)}
      >
        <UiIcon name="chat" size={26} />
        {unread > 0 ? <span className={styles.badge} aria-label={`運営からの返信 ${unread}件`}>{unread}</span> : null}
      </button>
      <div className={styles.scrim} data-open={open} onClick={close} aria-hidden="true" />
      <section
        id="support-chat-panel"
        className={styles.panel}
        data-open={open}
        role="dialog"
        aria-modal="false"
        aria-labelledby="support-chat-title"
      >
        <header className={styles.head}>
          {backTo ? (
            <button type="button" className={styles.back} onClick={() => { setError(null); setView(backTo); if (backTo === 'tickets') void loadTickets() }} aria-label="戻る"><UiIcon name="back" size={18} /></button>
          ) : (
            <img src="/character/hello-256.webp" alt="" width={44} height={44} className={styles.kun} />
          )}
          <div className={styles.headText}>
            <span className={styles.eyebrow}>{toolName ? `${toolName}を表示中` : 'ドヤAI サポート'}</span>
            <h2 id="support-chat-title" className={styles.title}>{headTitle}</h2>
          </div>
          <button type="button" className={styles.x} onClick={close} aria-label="閉じる"><UiIcon name="close" size={18} /></button>
        </header>

        <div ref={bodyRef} className={styles.body} aria-live="polite">
          {view === 'chat' ? (
            <>
              <div className={styles.msg} data-role="assistant">
                使い方や料金のご質問に、AIがお答えします。不具合・お支払い・解約などは、運営の担当者におつなぎします。
              </div>
              {messages.length === 0 ? (
                <div className={styles.chips}>
                  {suggestions.map((s) => (
                    <button key={s} type="button" className={styles.chip} onClick={() => ask(s)}>{s}</button>
                  ))}
                </div>
              ) : null}
              {messages.map((m) => (
                <div key={m.id} className={styles.msg} data-role={m.role} data-kind={m.kind}>
                  {m.text}
                  {m.sources && m.sources.length ? (
                    <div className={styles.sources}>
                      {m.sources.map((s) => (
                        <a key={s.href} href={s.href} className={styles.link}>{s.label}<UiIcon name="external" size={13} /></a>
                      ))}
                    </div>
                  ) : null}
                  {m.kind === 'staff' || m.kind === 'unknown' ? (
                    <div className={styles.msgAction}>
                      <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => openStaff(m.category)}>運営に伝える</button>
                    </div>
                  ) : null}
                </div>
              ))}
              {busy ? <div className={styles.typing} aria-label="答えを作っています"><i /><i /><i /></div> : null}
            </>
          ) : null}

          {view === 'staff' ? (
            <div className={styles.form}>
              <p className={styles.intro}>運営の担当者がお答えします。今の画面と、このチャットのやり取りも一緒にお送りします。</p>
              <label className={styles.field}>
                ご用件
                <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)}>
                  {SUPPORT_CATEGORY_CHOICES.map((c) => <option key={c} value={c}>{SUPPORT_CATEGORY_LABEL[c]}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                内容
                <textarea
                  ref={inputRef}
                  className={styles.textarea}
                  value={staffText}
                  maxLength={2000}
                  onChange={(e) => setStaffText(e.target.value)}
                  placeholder="困っていることを、分かる範囲でお書きください"
                />
              </label>
              <label className={styles.check}>
                <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} />
                <span>ログインに使っているメールアドレスへの返信を希望します</span>
              </label>
              <p className={styles.note}>パスワードやカードの番号は書かないでください。運営の受付時間は {SUPPORT_HOURS_LABEL} です。</p>
            </div>
          ) : null}

          {view === 'tickets' ? (
            tickets === null ? <div className={styles.typing} aria-label="読み込んでいます"><i /><i /><i /></div>
            : tickets.length === 0 ? <p className={styles.intro}>まだお問い合わせはありません。</p>
            : (
              <ul className={styles.tickets}>
                {tickets.map((t) => (
                  <li key={t.ticketNo}>
                    <button type="button" className={styles.ticketRow} data-unread={t.unread} onClick={() => void openTicket(t.ticketNo)}>
                      <span className={styles.meta}>{t.ticketNo}・{SUPPORT_CATEGORY_LABEL[t.category] ?? 'その他'}・{fmtDate(t.createdAt)}</span>
                      <span className={styles.ticketSummary}>{t.summary}</span>
                      <span className={styles.ticketStatus}>{t.unread ? '新しい返信があります' : STATUS_LABEL[t.status] ?? '受付済み'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}

          {view === 'ticket' ? (
            !ticket ? (busy ? <div className={styles.typing} aria-label="読み込んでいます"><i /><i /><i /></div> : null) : (
              <>
                <p className={styles.note}>{SUPPORT_CATEGORY_LABEL[ticket.category] ?? 'その他'}・{STATUS_LABEL[ticket.status] ?? '受付済み'}・{fmtDate(ticket.createdAt)} に受付</p>
                {ticket.messages.map((m, i) => (
                  <div key={i} className={styles.msg} data-role={m.role === 'user' ? 'user' : 'assistant'} data-kind={m.role === 'staff' ? 'staff' : undefined}>
                    {m.role === 'staff' ? <span className={styles.from}>運営の担当者</span> : m.role === 'ai' ? <span className={styles.from}>AI</span> : null}
                    {m.body}
                    <span className={styles.time}>{fmtDate(m.createdAt)}</span>
                  </div>
                ))}
              </>
            )
          ) : null}

          {view === 'done' && done ? (
            <div className={styles.done}>
              <img src="/character/love-256.webp" alt="" width={96} height={96} className={styles.kunLarge} />
              <p className={styles.doneTitle}>お問い合わせを受け付けました</p>
              <div className={styles.box}>受付番号<br /><span className={styles.ticket}>{done.ticketNo}</span></div>
              <p className={styles.intro}>{done.replyEta}</p>
              <p className={styles.note}>運営からの返信は、このチャットの「お問い合わせの履歴」にも届きます。</p>
            </div>
          ) : null}
        </div>

        <footer className={styles.foot}>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {view === 'chat' ? (
            <>
              <form className={styles.inputRow} onSubmit={(e) => { e.preventDefault(); void ask(draft) }}>
                <textarea
                  ref={inputRef}
                  className={styles.input}
                  rows={1}
                  value={draft}
                  maxLength={500}
                  placeholder="質問を書いてください"
                  aria-label="質問"
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(draft) }
                  }}
                />
                <button type="submit" className={styles.send} disabled={!draft.trim() || busy} aria-label="送る"><UiIcon name="send" size={18} /></button>
              </form>
              <div className={styles.footLinks}>
                <button type="button" className={styles.staffLink} onClick={() => openStaff(null)}>運営の担当者に直接伝える</button>
                <button type="button" className={styles.staffLink} onClick={() => { setError(null); setView('tickets'); void loadTickets() }}>
                  お問い合わせの履歴{unread > 0 ? `（返信 ${unread}件）` : ''}
                </button>
              </div>
            </>
          ) : null}
          {view === 'staff' ? (
            <button type="button" className={styles.btn} disabled={!staffText.trim() || busy} onClick={() => void sendTicket()}>
              {busy ? '送っています' : '運営に送る'}
            </button>
          ) : null}
          {view === 'ticket' && ticket ? (
            <form className={styles.inputRow} onSubmit={(e) => { e.preventDefault(); void sendFollowUp() }}>
              <textarea
                ref={inputRef}
                className={styles.input}
                rows={1}
                value={followUp}
                maxLength={2000}
                placeholder="運営への返信を書いてください"
                aria-label="運営への返信"
                onChange={(e) => setFollowUp(e.target.value)}
              />
              <button type="submit" className={styles.send} disabled={!followUp.trim() || busy} aria-label="送る"><UiIcon name="send" size={18} /></button>
            </form>
          ) : null}
          {view === 'done' ? (
            <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => { setView('chat'); setDone(null) }}>チャットに戻る</button>
          ) : null}
        </footer>
      </section>
    </div>
  )
}
