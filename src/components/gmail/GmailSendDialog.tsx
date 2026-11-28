'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  open: boolean
  onClose: () => void
  initialText: string // 生成結果（「件名:」行があれば件名に分ける）
  source: string
}

export function splitSubject(raw: string): { subject: string; body: string } {
  const m = raw.match(/^\s*(?:件名|題名|Subject)\s*[:：]\s*(.+?)\s*\r?\n+([\s\S]*)$/i)
  if (m) return { subject: m[1].trim(), body: m[2].trim() }
  return { subject: '', body: raw.trim() }
}

type Phase = 'edit' | 'sending' | 'done'

export default function GmailSendDialog({ open, onClose, initialText, source }: Props) {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [from, setFrom] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [configured, setConfigured] = useState(true)
  const [phase, setPhase] = useState<Phase>('edit')
  const [error, setError] = useState('')
  const [reauth, setReauth] = useState(false)

  useEffect(() => {
    if (!open) return
    const s = splitSubject(initialText)
    setSubject(s.subject)
    setBody(s.body)
    setPhase('edit')
    setError('')
    setReauth(false)
    fetch('/api/gmail/status', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setConfigured(d?.configured !== false)
        const ok = d?.connection?.status === 'ACTIVE'
        setConnected(ok)
        setFrom(ok ? d.connection.email : null)
        if (d?.connection?.status === 'REVOKED') setReauth(true)
      })
      .catch(() => setConnected(false))
  }, [open, initialText])

  if (!open) return null

  const send = async () => {
    setError('')
    setPhase('sending')
    try {
      const res = await fetch('/api/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text: body, replyTo: replyTo || undefined, source, confirmed: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || '送信に失敗しました')
        if (data?.code === 'REAUTH_REQUIRED' || data?.code === 'NOT_CONNECTED') setReauth(true)
        setPhase('edit')
        return
      }
      setPhase('done')
    } catch {
      setError('通信に失敗しました。もう一度お試しください。')
      setPhase('edit')
    }
  }

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Gmail で送る">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">Gmail で送る：内容の確認</h2>

        {phase === 'done' ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-800">{to} 宛てに送信しました。送信済みは、Gmail の「送信済み」で確認できます。</p>
            <button onClick={onClose} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white">閉じる</button>
          </div>
        ) : !configured ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-700">Gmail で送る機能は、まだ準備中です。いまは「コピー」して、お使いのメールで送ってください。</p>
            <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">閉じる</button>
          </div>
        ) : connected === false || reauth ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-700">
              {reauth ? 'Gmail の連携が取り消されています。連携し直してください。' : 'Gmail と連携されていません。設定から連携すると、ご自身の Gmail から送れます。'}
            </p>
            <div className="flex gap-2">
              <Link href="/settings/gmail" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">設定で連携する</Link>
              <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">閉じる</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">送信元：{from || '確認中'}。内容を確かめ、必要なら直してから送信してください。</p>
            <label className="block text-sm font-bold text-slate-800">宛先
              <input value={to} onChange={(e) => setTo(e.target.value)} type="email" placeholder="example@company.co.jp" className={`${field} mt-1 font-normal`} />
            </label>
            <label className="block text-sm font-bold text-slate-800">件名
              <input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={`${field} mt-1 font-normal`} />
            </label>
            <label className="block text-sm font-bold text-slate-800">本文
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} className={`${field} mt-1 font-normal leading-relaxed`} />
            </label>
            <label className="block text-sm font-bold text-slate-800">返信先（任意）
              <input value={replyTo} onChange={(e) => setReplyTo(e.target.value)} type="email" placeholder="未入力なら送信元と同じ" className={`${field} mt-1 font-normal`} />
            </label>
            <p className="text-xs text-slate-500">企業名・担当者名が仮置きのままになっていないか、送信前にご確認ください。</p>
            {error && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                onClick={send}
                disabled={phase === 'sending' || !to.trim() || !subject.trim() || !body.trim() || connected !== true}
                className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {phase === 'sending' ? '送信中' : 'この内容で送信する'}
              </button>
              <button onClick={onClose} disabled={phase === 'sending'} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700">
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
