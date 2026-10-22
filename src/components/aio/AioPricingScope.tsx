'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { readAioBillingNavigation } from '@/lib/aio/billing-navigation-client'
import { aioBillingReturnPath, saveAioCheckoutHint, saveAioPortalHint, type AioBillingRead } from '@/lib/aio/billing-navigation'
import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'
import type { CheckoutActionGuard } from '@/components/CheckoutButton'
import type { PortalNavigationGuard } from '@/components/UnifiedPricingPlans'

type Expected = { actorId: string; organizationId: string; slug: string; role: string; plan: string }

/** Personal checkout remains User-wide. This scope only controls the navigation back to AIO. */
export function AioPricingScope({ expected }: { expected: Expected }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const actorId = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id || '' : ''
  const [proof, setProof] = useState<{ key: string; value: AioBillingRead } | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const epoch = useRef(0)
  const live = useRef(false)
  const scopeKey = JSON.stringify([status, actorId, expected.actorId, expected.organizationId, expected.slug, expected.role, expected.plan, version])
  const latestScope = useRef(scopeKey); latestScope.current = scopeKey
  const renderEpoch = epoch.current
  const scoped = () => live.current && epoch.current === renderEpoch && latestScope.current === scopeKey &&
    status === 'authenticated' && actorId === expected.actorId &&
    proof?.key === scopeKey && proof.value.current?.id === expected.organizationId &&
    proof.value.current.slug === expected.slug && proof.value.current.role === expected.role &&
    proof.value.current.plan === expected.plan
  const current = () => scoped() && proof?.value.current?.role === 'owner' && proof.value.current.canManageBilling === true

  useEffect(() => {
    const own = ++epoch.current
    live.current = true
    const controller = new AbortController()
    const retire = () => { if (epoch.current === own) { live.current = false; epoch.current++ }; controller.abort() }
    const resume = (event: PageTransitionEvent) => { if (event.persisted) { retire(); setProof(null); setVersion(value => value + 1) } }
    window.addEventListener('pagehide', retire)
    window.addEventListener('pageshow', resume)
    if (status === 'authenticated' && actorId === expected.actorId && validWorkspaceSlug(expected.slug)) {
      void readAioBillingNavigation(actorId, expected.slug, controller.signal).then(value => {
        if (epoch.current === own && !controller.signal.aborted) {
          setProof({ key: scopeKey, value }); setFailedKey(null)
        }
      }).catch(() => { if (epoch.current === own && !controller.signal.aborted) setFailedKey(scopeKey) })
    }
    return () => { retire(); window.removeEventListener('pagehide', retire); window.removeEventListener('pageshow', resume) }
  }, [scopeKey, actorId, status, expected.actorId, expected.slug])

  const verify = async (signal: AbortSignal) => {
    if (!current() || signal.aborted) return false
    const own = epoch.current
    try {
      const value = await readAioBillingNavigation(actorId, expected.slug, signal)
      return own === epoch.current && !signal.aborted && live.current && value.current?.id === expected.organizationId &&
        value.current.slug === expected.slug && value.current.role === 'owner' && value.current.canManageBilling &&
        value.current.plan === expected.plan
    } catch { return false }
  }
  const identity = scopeKey
  const retryEpoch = epoch.current
  const retryCurrent = () => live.current && epoch.current === retryEpoch && latestScope.current === scopeKey &&
    status === 'authenticated' && actorId === expected.actorId
  const checkoutGuard: CheckoutActionGuard = {
    identity, current, verify,
    onReady: ready => {
      if (!current() || ready.actorId !== actorId || ready.provenance !== 'fresh') return ready.provenance === 'recovered' && current()
      try { return saveAioCheckoutHint(sessionStorage, { version: 1, kind: 'checkout', actorId,
        organizationId: expected.organizationId, slug: expected.slug,
        operationId: ready.operationId, sessionId: ready.sessionId }) } catch { return false }
    },
  }
  const portalGuard: PortalNavigationGuard = {
    identity, current, verify,
    prepareReturn: navigationId => { if (!current()) return false
      try { return saveAioPortalHint(sessionStorage, { version: 1, kind: 'portal', actorId,
        organizationId: expected.organizationId, slug: expected.slug, navigationId }) } catch { return false }
    },
    returnPath: navigationId => aioBillingReturnPath('portal', navigationId) || '/aio/billing-return/unknown',
  }
  const home = `/aio/${encodeURIComponent(expected.slug)}`
  const changed = proof?.key === scopeKey && proof.value.current?.id === expected.organizationId &&
    proof.value.current.slug === expected.slug &&
    (proof.value.current.role !== expected.role || proof.value.current.plan !== expected.plan)
  if (status === 'loading' || status === 'authenticated' && !proof && failedKey !== scopeKey) return <p role="status">組織の契約を確認しています…</p>
  if (status !== 'authenticated' || actorId !== expected.actorId) return <p role="alert">ログイン情報を確認してください。<Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/aio/pricing?org=${encodeURIComponent(expected.slug)}`)}`}>ログインする</Link></p>
  if (!scoped()) return <div role="alert"><p>{changed ? '組織の役割またはプランが更新されました。ページを再読み込みして確認してください。' :
    '組織の契約を確認できませんでした。契約変更には進めません。'}</p>
    <button type="button" onClick={() => { if (!retryCurrent()) return
      if (changed) router.refresh()
      else { setProof(null); setFailedKey(null); setVersion(value => value + 1) }
    }}>{changed ? 'ページを再読み込みする' : '再確認する'}</button>
    <Link href={home}>組織の作業画面に戻る</Link></div>
  return <UnifiedPricingPlans serviceId="aio" currentPlan={expected.plan} planSource="organization" canPurchase={current()}
    checkoutActionGuard={current() ? checkoutGuard : undefined} portalNavigationGuard={current() ? portalGuard : undefined}
    loginCallbackUrl={`/aio/pricing?org=${encodeURIComponent(expected.slug)}`} workspaceHomeHref={home} />
}
