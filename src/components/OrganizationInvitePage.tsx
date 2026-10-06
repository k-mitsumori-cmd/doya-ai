'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavigationSubmissionError, startGoogleSignIn, switchGoogleAccount, useNavigationSubmission } from '@/lib/use-navigation-submission'
import { notifyError } from '@/lib/ui/notify'

const SERVICES = {
  quote: { name: 'ドヤ見積もりAI', destination: '見積もり', access: 'この組織の商材と見積書' },
  mensetsu: { name: 'ドヤ面接官', destination: '面接', access: 'この組織の面接テンプレートと応募者の記録' },
  aishodan: { name: 'ドヤAI商談', destination: '商談', access: 'この組織の商材・商談シナリオと商談ログ' },
} as const

type Service = keyof typeof SERVICES
type Invite = { organizationName: string; roleLabel: string; accepted: boolean }
type State = 'loading' | 'ready' | 'error' | 'expired' | 'success'

/** Used by the three invitation APIs that return { invite } and { ok: true }. */
export function OrganizationInvitePage({ service, token }: { service: Service; token: string }) {
  const router = useRouter()
  const config = SERVICES[service]
  const callbackUrl = `/${service}/invite/${encodeURIComponent(token)}`
  const [state, setState] = useState<State>('loading')
  const [invite, setInvite] = useState<Invite | null>(null)
  const [error, setError] = useState('')
  const [accountAction, setAccountAction] = useState<'signIn' | 'switch' | null>(null)
  const [revision, setRevision] = useState(0)
  const verification = useRef(0)
  const { busy: accepting, run: submitAcceptance } = useNavigationSubmission('参加に失敗しました。招待の状態を再確認してください。')
  const { busy: authenticating, run: submitAccount } = useNavigationSubmission('ログイン処理に失敗しました。もう一度お試しください。')
  const busy = accepting || authenticating

  useEffect(() => {
    let active = true
    const attempt = ++verification.current
    const controller = new AbortController()
    const isCurrent = () => active && verification.current === attempt
    const read = async () => {
      try {
        if (!token) throw new Error('Missing invitation')
        const res = await fetch(`/api/${service}/invite/${encodeURIComponent(token)}`, { cache: 'no-store', signal: controller.signal })
        if (!isCurrent()) return
        if (res.status === 410) { setState('expired'); return }
        const data = await res.json()
        if (!isCurrent()) return
        if (!res.ok) {
          notifyError(setError, typeof data?.error === 'string' ? data.error : '招待を確認できませんでした。もう一度お試しください。')
          setState('error')
          return
        }
        const value = data?.invite
        if (!value || typeof value.organizationName !== 'string' || !value.organizationName.trim() || typeof value.roleLabel !== 'string' || !value.roleLabel.trim() || typeof value.accepted !== 'boolean') throw new Error('Invalid invitation response')
        setInvite(value)
        setState('ready')
      } catch {
        if (!isCurrent()) return
        notifyError(setError, '招待の取得に失敗しました。もう一度お試しください。')
        setState('error')
      }
    }
    void read()
    return () => { active = false; controller.abort() }
  }, [service, token, revision])

  useEffect(() => {
    if (state !== 'success') return
    const timer = setTimeout(() => router.push(`/${service}`), 1200)
    return () => clearTimeout(timer)
  }, [state, router, service])

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      verification.current += 1
      setInvite(null)
      setError('')
      setAccountAction(null)
      setState('loading')
      setRevision(current => current + 1)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  const verifyAgain = () => {
    if (state !== 'error' || busy) return
    verification.current += 1
    setInvite(null)
    setError('')
    setAccountAction(null)
    setState('loading')
    setRevision(current => current + 1)
  }

  const accept = async () => {
    if (state !== 'ready' || !invite || invite.accepted || authenticating) return
    await submitAcceptance(async isCurrent => {
      let expired = false
      try {
        const res = await fetch(`/api/${service}/invite/${encodeURIComponent(token)}`, { method: 'POST' })
        if (!isCurrent()) return
        if (res.status === 401) {
          setAccountAction('signIn')
          throw new NavigationSubmissionError('ログインが必要です。Googleでログインしてから、招待を受けてください。')
        }
        if (res.status === 403) {
          setAccountAction('switch')
          throw new NavigationSubmissionError('招待されたメールアドレスのアカウントでログインしてください。')
        }
        if (res.status === 410) {
          expired = true
          setState('expired')
          throw new NavigationSubmissionError('招待の有効期限が切れています。招待者に再送を依頼してください。')
        }
        if (res.status === 404 || res.status === 409) throw new NavigationSubmissionError('招待が変更されたか、既に使用されています。招待の状態を再確認してください。')
        const data = await res.json()
        if (!isCurrent()) return
        if (!res.ok) throw new NavigationSubmissionError(typeof data?.error === 'string' ? data.error : '参加に失敗しました。もう一度お試しください。')
        if (data?.ok !== true) throw new Error('Invalid participation response')
        setState('success')
      } catch (failure) {
        if (!isCurrent()) return
        const message = failure instanceof NavigationSubmissionError ? failure.message : '参加に失敗しました。招待の状態を再確認してください。'
        setInvite(null)
        setError(message)
        if (!expired) setState('error')
        throw new NavigationSubmissionError(message)
      }
    })
  }

  const handleAccount = async () => {
    if (state !== 'error' || !accountAction || accepting) return
    await submitAccount(async isCurrent => {
      try {
        if (accountAction === 'switch') await switchGoogleAccount(callbackUrl)
        else await startGoogleSignIn(callbackUrl)
      } catch (failure) {
        if (!isCurrent()) return
        const message = failure instanceof NavigationSubmissionError ? failure.message : 'ログイン処理に失敗しました。もう一度お試しください。'
        setError(message)
        throw new NavigationSubmissionError(message)
      }
    })
  }

  const buttonClass = 'mt-6 w-full rounded-lg bg-[#0066ff] px-6 py-3.5 text-sm font-black text-white disabled:bg-[#b9cdf5]'
  if (state === 'loading') return <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff]"><p role="status" className="text-sm font-bold text-[#425071]">読み込んでいます…</p></main>

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f6ff] px-5">
      <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-black text-[#0066ff]">{config.name}</p>
        {state === 'success' ? (
          <>
            <span aria-hidden="true" className="material-symbols-outlined text-4xl text-[#0066ff]">task_alt</span>
            <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">参加しました</h1>
            <p role="status" className="mt-2 text-sm font-semibold text-[#425071]">{config.destination}の管理画面へ移動します…</p>
          </>
        ) : state === 'expired' ? (
          <>
            <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">招待の有効期限が切れています</h1>
            <p className="mt-3 text-sm font-semibold text-[#425071]">招待者に再送を依頼してください。</p>
          </>
        ) : state === 'error' ? (
          <>
            <span aria-hidden="true" className="material-symbols-outlined text-4xl text-[#8a94ad]">error</span>
            <h1 className="mt-3 text-lg font-black text-[#0a0f3c]">招待を確認できませんでした</h1>
            <p role="alert" className="mt-3 text-sm font-semibold leading-relaxed text-[#425071]">{error}</p>
            {accountAction && <button onClick={handleAccount} disabled={busy} className={buttonClass}>{authenticating ? 'ログイン処理中…' : accountAction === 'switch' ? '別のアカウントでログイン' : 'Googleでログイン'}</button>}
            <button onClick={verifyAgain} disabled={busy} className={buttonClass}>招待の状態を再確認</button>
          </>
        ) : invite && (
          <>
            <h1 className="mt-2 text-xl font-black leading-snug text-[#0a0f3c]">{invite.organizationName} に招待されています</h1>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[#425071]">権限: <strong className="font-black text-[#0a0f3c]">{invite.roleLabel}</strong><br />参加すると、{config.access}を扱えるようになります。</p>
            <button onClick={accept} disabled={busy || invite.accepted} className={buttonClass}>{invite.accepted ? 'この招待は使用済みです' : accepting ? '処理中…' : '参加する'}</button>
            <p className="mt-3 text-xs font-semibold text-[#8a94ad]">ログインしていない場合は、参加を押すとログインをご案内します。</p>
          </>
        )}
      </div>
    </main>
  )
}
