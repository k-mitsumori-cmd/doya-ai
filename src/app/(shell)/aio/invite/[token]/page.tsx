'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { NavigationSubmissionError, startGoogleSignIn, switchGoogleAccount, useNavigationSubmission } from '@/lib/use-navigation-submission'
import toast from 'react-hot-toast'
import { BgDots, DoyaKun } from '@/components/aio/ui'

type State = 'loading' | 'ready' | 'error' | 'expired' | 'account-mismatch'

export default function AioInvitePage() {
  const params = useParams<{ token: string }>()
  const token = String(params.token)
  return <InvitationContent key={token} token={token} />
}

function InvitationContent({ token }: { token: string }) {
  const router = useRouter()
  const [state, setState] = useState<State>('loading')
  const [info, setInfo] = useState<{ organizationName: string; organizationSlug: string; email: string; role: string } | null>(null)
  const [errMsg, setErrMsg] = useState('')
  const [verificationRevision, setVerificationRevision] = useState(0)
  const { busy: accepting, run: submit } = useNavigationSubmission('参加に失敗しました。もう一度お試しください。')

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    fetch(`/api/aio/invite/${encodeURIComponent(token)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (r) => {
        if (!active) return
        if (r.status === 410) { setState('expired'); return }
        const d = await r.json()
        if (!active) return
        if (!r.ok) { setErrMsg(typeof d.error === 'string' ? d.error : '招待が見つかりません'); setState('error'); return }
        if (![d.organizationName, d.organizationSlug, d.email, d.role].every(value => typeof value === 'string' && value.length > 0)) {
          throw new Error('Invalid invitation response')
        }
        setInfo(d); setState('ready')
      })
      .catch(() => { if (active) { setErrMsg('招待の取得に失敗しました'); setState('error') } })
    return () => { active = false; controller.abort() }
  }, [token, verificationRevision])

  const verifyAgain = () => {
    if (state !== 'error' || accepting) return
    setInfo(null)
    setErrMsg('')
    setState('loading')
    setVerificationRevision(current => current + 1)
  }

  const accept = async () => {
    if (state !== 'ready' || !info) return
    await submit(async (isCurrent) => {
      const res = await fetch(`/api/aio/invite/${encodeURIComponent(token)}`, { method: 'POST' })
      if (!isCurrent()) return
      if (res.status === 401) { await startGoogleSignIn(`/aio/invite/${encodeURIComponent(token)}`); return }
      if (res.status === 403) {
        setState('account-mismatch')
        throw new NavigationSubmissionError('招待されたメールアドレスのアカウントへ切り替えてください。')
      }
      if (res.status === 410) {
        setState('expired')
        throw new NavigationSubmissionError('招待の有効期限が切れています。招待者に再送を依頼してください。')
      }
      if (res.status === 404 || res.status === 409) {
        setInfo(null)
        setErrMsg('招待が変更されたか、既に使用されています。招待の状態を再確認してください。')
        setState('error')
        throw new NavigationSubmissionError('招待の状態を再確認してください。')
      }
      const d = await res.json()
      if (!isCurrent()) return
      if (!res.ok) throw new NavigationSubmissionError(typeof d.error === 'string' ? d.error : '参加に失敗しました')
      if (typeof d.organizationSlug !== 'string' || !d.organizationSlug) throw new Error('Invalid participation response')
      toast.success('参加しました')
      router.replace(`/aio/${encodeURIComponent(d.organizationSlug)}`)
    })
  }

  const switchAccount = async () => {
    if (state !== 'account-mismatch') return
    await submit(async () => { await switchGoogleAccount(`/aio/invite/${encodeURIComponent(token)}`) })
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-purple-50 to-fuchsia-100/50 flex items-center justify-center p-6">
      <BgDots />
      <div className="relative z-10 bg-white rounded-3xl shadow-xl shadow-purple-500/10 border border-purple-100 p-8 w-full max-w-md text-center">
        <div className="flex justify-center mb-2">
          <DoyaKun mood={state === 'error' || state === 'expired' || state === 'account-mismatch' ? 'error' : accepting ? 'jump' : 'hello'} size={110} />
        </div>
        {state === 'loading' && <p className="text-slate-400 font-bold">読み込み中…</p>}
        {state === 'expired' && <><h1 className="text-xl font-black text-slate-900">招待の有効期限が切れています</h1><p className="text-sm font-bold text-slate-400 mt-2">招待者に再送を依頼してください。</p></>}
        {state === 'error' && (
          <>
            <h1 className="text-xl font-black text-slate-900">招待を確認できませんでした</h1>
            <p className="text-sm font-bold text-slate-400 mt-2">{errMsg}</p>
            <button onClick={verifyAgain} disabled={accepting} className="w-full mt-6 py-4 rounded-2xl bg-purple-600 text-white font-bold disabled:opacity-50">
              招待の状態を再確認
            </button>
          </>
        )}
        {state === 'account-mismatch' && info && (
          <>
            <h1 className="text-xl font-black text-slate-900">別のアカウントでログインしています</h1>
            <p className="text-sm font-bold text-slate-500 mt-3">{info.email} 宛ての招待です。</p>
            <p className="text-sm text-slate-500 mt-2">現在のアカウントからログアウトし、招待されたメールアドレスでログインしてください。</p>
            <button onClick={switchAccount} disabled={accepting} className="w-full mt-6 py-4 rounded-2xl bg-purple-600 text-white font-bold disabled:opacity-50">
              {accepting ? '切り替え中…' : '別のアカウントでログイン'}
            </button>
          </>
        )}
        {state === 'ready' && info && (
          <>
            <h1 className="text-xl font-black text-slate-900">ドヤAIOへの招待</h1>
            <p className="text-sm font-bold text-slate-500 mt-3">
              <span className="text-purple-700 font-black">{info.organizationName}</span> に招待されています
            </p>
            <p className="text-xs font-bold text-slate-400 mt-1 mb-6">{info.email} 宛て</p>
            <button
              onClick={accept}
              disabled={accepting}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white font-black text-lg shadow-lg shadow-purple-500/30 hover:shadow-xl transition-all disabled:opacity-50"
            >
              {accepting ? '参加中…' : '招待を受けて参加する'}
            </button>
            <p className="text-[11px] font-bold text-slate-400 mt-3">招待されたメールアドレスでログインしてください。</p>
          </>
        )}
      </div>
    </div>
  )
}
