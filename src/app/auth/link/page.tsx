'use client'

import { Suspense, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DoyaLogo from '@/components/brand/DoyaLogo'
import { afterConfirm, afterSend, canSubmitCode, initialView, sanitizeCodeInput, stepText, type LinkView } from '@/lib/auth-link/link-flow'

async function post(path: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    const json = await res.json().catch(() => null)
    return { status: res.status, body: json as Record<string, unknown> | null }
  } catch {
    return { status: 0, body: null }
  }
}

function LinkContent() {
  const params = useSearchParams()
  const request = params.get('request')
  const [view, setView] = useState<LinkView>(() => initialView({ request, error: params.get('error') }))
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const { title, body } = stepText(view.step)

  const send = async () => {
    if (inFlight.current || !request) return
    inFlight.current = true; setBusy(true)
    setView(afterSend(await post('/api/app/auth/link/send-code', { requestId: request })))
    inFlight.current = false; setBusy(false)
  }
  const confirm = async () => {
    if (inFlight.current || !request || !canSubmitCode(code)) return
    inFlight.current = true; setBusy(true)
    const r = await post('/api/app/auth/link/confirm', { requestId: request, code, platform: 'web' })
    setView((prev) => afterConfirm(prev, r))
    setCode('')
    inFlight.current = false; setBusy(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.35)] p-7 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black text-slate-400 tracking-widest uppercase">Link account</p>
            <h1 className="mt-2 text-xl font-black text-slate-900 [text-wrap:balance] [word-break:auto-phrase]">{title}</h1>
          </div>
          <DoyaLogo size={40} className="hidden sm:inline-flex flex-none" textClassName="text-lg font-black text-slate-900" />
        </div>
        <p className="mt-3 text-sm text-slate-600 font-bold leading-relaxed [text-wrap:pretty] [word-break:auto-phrase]">{body}</p>

        {view.error && (
          <div role="alert" className="mt-5 rounded-2xl bg-red-50 border border-red-200 text-red-800 px-4 py-3">
            <p className="text-sm font-bold">{view.error}</p>
          </div>
        )}
        {view.notice && <p role="status" className="mt-4 text-sm font-bold text-slate-700">{view.notice}</p>}

        {view.step === 'intro' && (
          <button type="button" onClick={send} disabled={busy}
            className="mt-6 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 transition-colors px-5 py-4 font-black text-white disabled:opacity-60 min-h-[56px]">
            {busy ? '送信しています…' : '確認コードを送る'}
          </button>
        )}

        {view.step === 'code' && (
          <form className="mt-6" onSubmit={(e) => { e.preventDefault(); confirm() }}>
            {view.emailHint && <p className="text-xs font-bold text-slate-500">送り先: {view.emailHint}</p>}
            <label htmlFor="link-code" className="mt-3 block text-sm font-black text-slate-800">確認コード（6桁）</label>
            <input id="link-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(sanitizeCodeInput(e.target.value))}
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-2xl font-black tracking-[0.5em] text-slate-900 focus:border-blue-600 focus:outline-none" />
            <button type="submit" disabled={busy || !canSubmitCode(code)}
              className="mt-4 w-full rounded-2xl bg-blue-600 hover:bg-blue-700 transition-colors px-5 py-4 font-black text-white disabled:opacity-50 min-h-[56px]">
              {busy ? '確認しています…' : '確認する'}
            </button>
          </form>
        )}

        {view.step === 'done' && (
          <Link href="/auth/signin" className="mt-6 block w-full rounded-2xl bg-blue-600 hover:bg-blue-700 transition-colors px-5 py-4 text-center font-black text-white min-h-[56px]">ログインの画面へ</Link>
        )}
        {(view.step === 'expired' || view.step === 'locked' || view.step === 'invalid') && (
          <Link href="/auth/signin" className="mt-6 block w-full rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors px-5 py-4 text-center font-black text-slate-800 min-h-[56px]">ログインの画面へ戻る</Link>
        )}
      </div>
    </div>
  )
}

export default function AuthLinkPage() {
  return (
    <Suspense fallback={null}>
      <LinkContent />
    </Suspense>
  )
}
