'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { notifyError } from '@/lib/ui/notify'
import { NavigationSubmissionError, startGoogleSignIn, switchGoogleAccount, useNavigationSubmission } from '@/lib/use-navigation-submission'

type Service = 'sfa' | 'promane' | 'kintai'
type State = 'loading' | 'ready' | 'error' | 'unavailable'
export type InvitationDetails = {
  name: string
  email: string
  role: string
  slug?: string
  employeeName?: string
  invitedByName?: string | null
  expiresAt?: string
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

function invitationDetails(service: Service, data: any): InvitationDetails | null {
  if (service === 'promane') {
    const value = data?.invitation
    if (data?.success !== true || !value || ![value.workspaceName, value.workspaceSlug, value.email, value.role].every(text) || !text(value.expiresAt) || !Number.isFinite(Date.parse(value.expiresAt)) || !(value.invitedByName === null || typeof value.invitedByName === 'string')) return null
    return { name: value.workspaceName, slug: value.workspaceSlug, email: value.email, role: value.role, invitedByName: value.invitedByName, expiresAt: value.expiresAt }
  }
  if (!data || ![data.organizationName, data.email, data.role].every(text)) return null
  if (service === 'sfa' && !text(data.organizationSlug)) return null
  if (service === 'kintai' && typeof data.employeeName !== 'string') return null
  return { name: data.organizationName, email: data.email, role: data.role, slug: data.organizationSlug, employeeName: data.employeeName }
}

function unavailableMessage(service: Service, data: any): string {
  if (service === 'promane' && data?.code === 'PROMANE_INVITE_ACCEPTED') return 'この招待は既に承諾済みです。'
  if (service === 'promane' && data?.code !== 'PROMANE_INVITE_EXPIRED') return 'この招待は使用済み、または有効期限が切れています。招待者に新しい招待を依頼してください。'
  return '招待の有効期限が切れています。招待者に再送を依頼してください。'
}

/** Keep each service's API contract while sharing cancellation and retry behavior. */
export function useInvitationRecovery(service: Service, token: string) {
  const router = useRouter()
  const { status: sessionStatus } = useSession()
  const [state, setState] = useState<State>('loading')
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState('')
  const [accountAction, setAccountAction] = useState<'signIn' | 'switch' | null>(null)
  const [revision, setRevision] = useState(0)
  const verification = useRef(0)
  const { busy, run } = useNavigationSubmission('処理に失敗しました。もう一度お試しください。')
  const callbackUrl = `/${service}/invite/${encodeURIComponent(token)}`

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
        let data: any
        try { data = await res.json() } catch {
          if (res.status !== 410) throw new Error('Invalid invitation response')
        }
        if (!isCurrent()) return
        if (res.status === 410) {
          setError(unavailableMessage(service, data))
          setState('unavailable')
          return
        }
        if (!res.ok) {
          notifyError(setError, typeof data?.error === 'string' ? data.error : '招待を確認できませんでした。もう一度お試しください。')
          setState('error')
          return
        }
        const value = invitationDetails(service, data)
        if (!value) throw new Error('Invalid invitation response')
        setInvitation(value)
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

  const reset = () => {
    verification.current += 1
    setInvitation(null)
    setError('')
    setAccountAction(null)
    setState('loading')
    setRevision(value => value + 1)
  }

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      verification.current += 1
      setInvitation(null)
      setError('')
      setAccountAction(null)
      setState('loading')
      setRevision(value => value + 1)
    }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  const signInOrSwitch = async () => {
    if (state !== 'error' || !accountAction) return
    await run(async isCurrent => {
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

  const accept = async () => {
    if (state !== 'ready' || !invitation || sessionStatus === 'loading') return
    await run(async isCurrent => {
      let unavailable = false
      try {
        if (sessionStatus !== 'authenticated') {
          setAccountAction('signIn')
          await startGoogleSignIn(callbackUrl)
          return
        }
        const res = await fetch(`/api/${service}/invite/${encodeURIComponent(token)}`, { method: 'POST' })
        if (!isCurrent()) return
        if (res.status === 401) {
          setAccountAction('signIn')
          throw new NavigationSubmissionError('ログインが必要です。Googleでログインしてから、招待を受けてください。')
        }
        let data: any
        try { data = await res.json() } catch {
          if (![403, 404, 409, 410].includes(res.status)) throw new Error('Invalid participation response')
        }
        if (!isCurrent()) return
        if (res.status === 410) {
          unavailable = true
          throw new NavigationSubmissionError(unavailableMessage(service, data))
        }
        if (res.status === 403 && (service !== 'promane' || data?.code === 'email_mismatch')) {
          setAccountAction('switch')
          throw new NavigationSubmissionError('招待されたメールアドレスのアカウントでログインしてください。')
        }
        if (res.status === 404 || res.status === 409) throw new NavigationSubmissionError(typeof data?.error === 'string' ? data.error : '招待が変更されたか、既に使用されています。招待の状態を再確認してください。')
        if (!res.ok) throw new NavigationSubmissionError(typeof data?.error === 'string' ? data.error : '参加に失敗しました。招待の状態を再確認してください。')
        let destination: string
        if (service === 'kintai') {
          if (data?.success !== true || !text(data.organizationId) || !text(data.organizationName)) throw new Error('Invalid participation response')
          destination = '/kintai/clock'
        } else {
          const slug = service === 'promane' ? data?.workspaceSlug : data?.organizationSlug
          if ((service === 'promane' ? data?.success !== true : data?.ok !== true) || !text(slug)) throw new Error('Invalid participation response')
          destination = `/${service}/${encodeURIComponent(slug)}`
        }
        // Kintai changes the active organization; reload its shared layout and access state.
        if (service === 'kintai') window.location.assign(destination)
        else router.push(destination)
      } catch (failure) {
        if (!isCurrent()) return
        const message = failure instanceof NavigationSubmissionError ? failure.message : '処理に失敗しました。招待の状態を再確認してください。'
        setInvitation(null)
        setError(message)
        setState(unavailable ? 'unavailable' : 'error')
        throw new NavigationSubmissionError(message)
      }
    })
  }

  return { state, invitation, error, accountAction, busy, sessionStatus, accept, signInOrSwitch, verifyAgain: () => { if (state === 'error' && !busy) reset() } }
}
