'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { errorReportPath, type ErrorReportInput, type ErrorReportType } from '@/lib/error-report-input'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { kunSrc } from '@/components/ds/kun-src'

// Inline fallbacks also work when the root layout (and its stylesheet) failed.
const panel: CSSProperties = { marginTop: 24, padding: 16, border: '1px solid var(--line, #e2e8f0)', borderRadius: 'var(--r, 12px)', textAlign: 'left', background: 'var(--paper, #fff)', color: 'var(--ink, #111827)', fontSize: 14, lineHeight: 1.5 }
const field: CSSProperties = { display: 'block', boxSizing: 'border-box', width: '100%', minHeight: 80, marginTop: 8, padding: 12, border: '1px solid var(--line, #cbd5e1)', borderRadius: 'var(--r, 12px)', color: 'inherit', background: 'var(--paper, #fff)', font: 'inherit', resize: 'vertical' }

export function ErrorContactFooter() {
  return <footer style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--line, #e2e8f0)', textAlign: 'center', fontSize: 12 }}><a href={SUPPORT_CONTACT_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--muted, #64748b)' }}>ご不明な点はお問い合わせください</a></footer>
}

export default function ErrorReportForm({ errorType = 'unknown' }: { errorType?: ErrorReportType }) {
  const id = useId()
  const [path, setPath] = useState('/')
  const [ready, setReady] = useState(false)
  const [description, setDescription] = useState(''), [suggestion, setSuggestion] = useState('')
  const [busy, setBusy] = useState(false), [sent, setSent] = useState(false), [message, setMessage] = useState('')
  const operation = useRef<ErrorReportInput | null>(null), inFlight = useRef(false), alive = useRef(true), controller = useRef<AbortController | null>(null)
  useEffect(() => {
    alive.current = true
    setPath(errorReportPath(window.location.pathname))
    setReady(true)
    return () => { alive.current = false; controller.current?.abort() }
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || sent) return
    inFlight.current = true
    setBusy(true)
    setMessage('')
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      // Rechecking always uses the same immutable request. Never automatically send a new report.
      operation.current ??= { reportId: crypto.randomUUID(), errorType, errorUrl: errorReportPath(window.location.pathname), userDescription: description, userSuggestion: suggestion }
      const request = operation.current
      controller.current = new AbortController()
      const currentController = controller.current
      timer = setTimeout(() => currentController.abort(), 15000)
      const response = await fetch('/api/feedback/error-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: controller.current.signal, cache: 'no-store' })
      const result: unknown = await response.json()
      if (!alive.current) return
      const value = result && typeof result === 'object' ? result as Record<string, unknown> : {}
      if (response.status === 200 && value.success === true && value.reportId === request.reportId) { setSent(true); return }
      setMessage(response.status === 202 ? '送信処理中です。少し待ってから送信結果を確認してください。' : response.status === 429 ? '本日の報告回数の上限に達しました。内容は残っています。お問い合わせをご利用ください。' : '送信結果を確認できません。内容は残っています。結果を確認するか、お問い合わせをご利用ください。')
    } catch { if (alive.current) setMessage('送信結果を確認できません。内容は残っています。結果を確認するか、お問い合わせをご利用ください。') }
    finally { if (timer) clearTimeout(timer); inFlight.current = false; if (alive.current) setBusy(false) }
  }
  return <section aria-label="エラーを報告する" style={panel}>
    {/* A plain image also works outside the failed root layout. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={kunSrc(sent ? 'thumbsup' : 'error')} alt="" width={64} height={64} style={{ display: 'block', margin: '0 auto 12px' }} />
    {sent ? <p role="status">報告を送信しました。ご協力ありがとうございます。</p> : <form onSubmit={submit} aria-busy={busy}>
      <p style={{ margin: '0 0 16px', fontWeight: 700 }}>解決しない場合は、状況をお知らせください</p>
      <p style={{ margin: '0 0 16px' }}>個人情報・パスワード・認証情報は記入しないでください。記入は任意です。</p>
      <label htmlFor={id + '-description'}>何をしていましたか？（任意）</label>
      <textarea id={id + '-description'} value={description} onChange={e => setDescription(e.target.value)} maxLength={1500} readOnly={!!operation.current} style={field} />
      <label htmlFor={id + '-suggestion'} style={{ display: 'block', marginTop: 16 }}>改善してほしい点（任意）</label>
      <textarea id={id + '-suggestion'} value={suggestion} onChange={e => setSuggestion(e.target.value)} maxLength={1500} readOnly={!!operation.current} style={field} />
      <details style={{ marginTop: 16 }}><summary>自動で送信する情報</summary><p>エラー種別: {errorType}<br />画面: {path}<br />送信時刻・報告IDと、ログイン中の場合はアカウントの識別情報を送信します。URLの検索条件・個別ID・例外の本文は送りません。</p></details>
      {message ? <p role="alert">{message}</p> : null}
      {operation.current ? <p style={{ overflowWrap: 'anywhere' }}>報告ID: {operation.current.reportId}</p> : null}
      <button type="submit" disabled={!ready || busy} style={{ marginTop: 16, padding: '12px 16px', border: 0, borderRadius: 'var(--r, 12px)', background: 'var(--blue, #2463eb)', color: '#fff', font: 'inherit', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>{busy ? '送信結果を確認しています' : operation.current ? '送信結果を確認する' : '報告する'}</button>
    </form>}
    <ErrorContactFooter />
  </section>
}
