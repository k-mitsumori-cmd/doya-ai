'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'

type EntryService = 'sfa' | 'shodan'
type EntryPhase = 'loading' | 'guest' | 'onboard' | 'error'

/** A new identity must not reuse a previous identity's read, draft or submission. */
export function useEntryActorScope() {
  const { data: session, status } = useSession()
  const actor = status === 'authenticated' ? session?.user?.id || '' : ''
  const identity = useRef({ actor, status, version: 0 })
  if (identity.current.actor !== actor || identity.current.status !== status) {
    identity.current = { actor, status, version: identity.current.version + 1 }
  }
  const version = identity.current.version
  const current = useCallback(() => identity.current.version === version, [version])
  return { actor, status, version, current }
}

type EntryScope = ReturnType<typeof useEntryActorScope>

function slug(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 180 || /[\s/\\?#\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('Invalid organization slug')
  }
  return value
}

/** A failed or malformed read is unknown, not proof that membership is absent. */
async function readEntryOrganization(service: EntryService, signal: AbortSignal) {
  const { ok, data } = await readBillingResponse(service === 'sfa' ? '/api/sfa/usage' : '/api/shodan/me', { method: 'GET' }, signal)
  if (!ok || typeof data.onboarded !== 'boolean' || !Array.isArray(data.memberships)) throw new Error('Organization could not be confirmed')
  const memberships = data.memberships.map(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid membership')
    return slug((value as { slug?: unknown }).slug)
  })
  if (service === 'shodan') {
    if (typeof data.authenticated !== 'boolean') throw new Error('Authentication could not be confirmed')
    if (!data.authenticated) {
      if (data.onboarded || memberships.length) throw new Error('Inconsistent guest response')
      return { guest: true, target: null }
    }
  }
  if (data.onboarded) {
    const target = service === 'sfa' ? slug((data.organization as { slug?: unknown } | undefined)?.slug) : memberships[0]
    if (!target || !memberships.includes(target)) throw new Error('Organization membership could not be confirmed')
    return { guest: false, target }
  }
  if (memberships.length) return { guest: false, target: memberships[0] }
  return { guest: false, target: null }
}

export function useEntryOrganization(service: EntryService, scope: EntryScope, router: { replace: (url: string) => void }) {
  const [phase, setPhase] = useState<EntryPhase>('loading')
  const [attempt, setAttempt] = useState(0)
  const { actor, status, version, current } = scope

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => { if (event.persisted) setAttempt(value => value + 1) }
    window.addEventListener('pageshow', restore)
    return () => window.removeEventListener('pageshow', restore)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const active = () => !controller.signal.aborted && current()
    setPhase('loading')
    if (status === 'authenticated' && !actor) {
      setPhase('error')
      return () => controller.abort()
    }
    // Cookie-authenticated reads can complete even while the session SDK is loading.
    void readEntryOrganization(service, controller.signal).then(result => {
      if (!active()) return
      if (result.target) router.replace(`/${service}/${encodeURIComponent(result.target)}`)
      else setPhase(result.guest || service === 'sfa' && status !== 'authenticated' ? 'guest' : 'onboard')
    }).catch(() => { if (active()) setPhase('error') })
    return () => controller.abort()
  }, [service, actor, status, version, current, attempt, router])

  return { phase, reload: () => setAttempt(value => value + 1) }
}
