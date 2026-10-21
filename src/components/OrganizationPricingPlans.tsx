'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UnifiedPricingPlans, type PortalNavigationGuard } from '@/components/UnifiedPricingPlans'
import { planLabel, tierFrom } from '@/lib/plan-utils'
import type { OrganizationService } from '@/lib/organization-billing'
import type { WorkspaceProof } from '@/lib/organization-workspace-selection'
import { readBillingResponse } from '@/lib/billing-response-client'
import type { CheckoutActionGuard } from '@/components/CheckoutButton'
import { readPortalOriginHint, saveCheckoutOriginHint, savePortalOriginHint } from '@/lib/aishodan/checkout-origin-hint'
import { readQuotePortalHint, saveQuoteCheckoutHint, saveQuotePortalHint } from '@/lib/quote/checkout-origin-hint'

type BillingState =
  | { kind: 'loading' | 'missing' | 'error'; identity: string }
  | { kind: 'ready'; identity: string; plan: string; canManageBilling: boolean }

export function OrganizationPricingPlans({ serviceId, workspaceProof }: { serviceId: OrganizationService; workspaceProof?: WorkspaceProof }) {
  const strict = serviceId === 'aishodan' || serviceId === 'quote' && !!workspaceProof
  const { data: session, status } = useSession()
  const actorId = String((session?.user as { id?: string } | undefined)?.id || '')
  const identity = strict ? JSON.stringify([actorId, workspaceProof?.actorId, workspaceProof?.organization.id, workspaceProof?.organization.slug, workspaceProof?.revision])
    : String(actorId || session?.user?.email || '')
  const [billing, setBilling] = useState<BillingState>({ kind: 'loading', identity: '' })
  const request = useRef(0)
  const loadBilling = useCallback(async () => {
    const sequence = ++request.current
    const controller = new AbortController()
    setBilling({ kind: 'loading', identity })
    try {
      if (strict && (!workspaceProof?.current() || !actorId || actorId !== workspaceProof.actorId)) throw new Error('組織を確認できませんでした')
      const org = strict ? workspaceProof!.organization.slug : new URLSearchParams(window.location.search).get('org')
      const url = `/api/organization-billing/${serviceId}${org ? `?org=${encodeURIComponent(org)}` : ''}`
      const response = await readBillingResponse(url, { headers: strict ? { 'x-doya-workspace-actor': actorId } : {} }, controller.signal)
      if (sequence !== request.current || strict && !workspaceProof!.current()) return
      if (response.status === 403) {
        setBilling({ kind: 'missing', identity })
        return
      }
      if (!response.ok) throw new Error('組織の契約を確認できませんでした')
      const data = response.data
      if (sequence !== request.current || strict && !workspaceProof!.current()) return
      if (typeof data.plan !== 'string' || typeof data.canManageBilling !== 'boolean' || strict && (data.actorId !== actorId || data.organizationId !== workspaceProof!.organization.id || data.organizationSlug !== workspaceProof!.organization.slug || workspaceProof!.organization.role !== 'owner' && data.canManageBilling)) throw new Error('契約情報が不正です')
      setBilling({ kind: 'ready', identity, plan: data.plan, canManageBilling: data.canManageBilling })
    } catch {
      if (sequence === request.current && (!strict || workspaceProof?.current())) setBilling({ kind: 'error', identity })
    } finally {
      controller.abort()
    }
  }, [serviceId, identity, workspaceProof, actorId, strict])

  useEffect(() => {
    const requestRef = request
    if (status === 'authenticated') void loadBilling()
    return () => { requestRef.current++ }
  }, [status, loadBilling])

  if (status === 'loading' || (status === 'authenticated' && (billing.identity !== identity || billing.kind === 'loading' || strict && !workspaceProof?.current()))) {
    return <p className="text-center text-sm font-bold text-slate-500">組織のプランを確認しています…</p>
  }
  if (status === 'unauthenticated') return <UnifiedPricingPlans serviceId={serviceId} />
  if (billing.kind === 'missing') {
    return <div role="status" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700">
      組織を確認できませんでした。<Link href={workspaceProof?.href(`/${serviceId}`) || `/${serviceId}`} className="font-bold text-blue-700 underline">サービスの画面で組織を確認する</Link>
    </div>
  }
  if (billing.kind === 'error') {
    return <div role="alert" className="mx-auto max-w-xl rounded-2xl bg-rose-50 p-6 text-sm font-bold text-rose-700">
      組織のプランを確認できませんでした。<button type="button" onClick={() => void loadBilling()} className="ml-2 underline">再読み込み</button>
    </div>
  }
  if (billing.kind === 'ready' && !billing.canManageBilling) {
    const label = planLabel(tierFrom(billing.plan))
    return <div role="status" className="mx-auto max-w-xl rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-900">
      この組織の現在のプランは{label}です。ご自身の契約を変更しても組織の利用枠は増えません。利用枠の変更は組織のオーナーにご相談ください。
    </div>
  }
  const checkoutActionGuard: CheckoutActionGuard | undefined = strict && workspaceProof && billing.kind === 'ready' && billing.canManageBilling ? {
    identity,
    current: () => workspaceProof.current() && workspaceProof.actorId === actorId && workspaceProof.organization.role === 'owner',
    verify: async signal => {
      if (!workspaceProof.current() || workspaceProof.actorId !== actorId || workspaceProof.organization.role !== 'owner') return false
      try {
        const response = await readBillingResponse(`/api/organization-billing/${serviceId}?org=${encodeURIComponent(workspaceProof.organization.slug)}`,
          { headers: { 'x-doya-workspace-actor': actorId } }, signal)
        const data = response.data
        return response.ok && workspaceProof.current() && data.actorId === actorId && data.organizationId === workspaceProof.organization.id &&
          data.organizationSlug === workspaceProof.organization.slug && data.canManageBilling === true && typeof data.plan === 'string'
      } catch { return false }
    },
    onCanonical: (operationId, actor) => {
      if (!workspaceProof.current() || actor !== workspaceProof.actorId) return
      if (serviceId === 'quote') saveQuoteCheckoutHint(window.sessionStorage, { version: 1, actorId: actor, operationId,
        organizationId: workspaceProof.organization.id, slug: workspaceProof.organization.slug, returnPath: '/quote' })
      else saveCheckoutOriginHint(window.sessionStorage, { version: 1, actorId: actor, operationId,
        organizationId: workspaceProof.organization.id, slug: workspaceProof.organization.slug, returnPath: '/aishodan' })
    },
  } : undefined
  const portalNavigationGuard: PortalNavigationGuard | undefined = checkoutActionGuard && workspaceProof ? {
    identity,
    current: checkoutActionGuard.current,
    verify: checkoutActionGuard.verify,
    prepareReturn: navigationId => {
      if (!checkoutActionGuard.current()) return false
      const hint = { version: 1 as const, actorId, navigationId, organizationId: workspaceProof.organization.id,
        slug: workspaceProof.organization.slug }
      try {
        if (!(serviceId === 'quote' ? saveQuotePortalHint(window.sessionStorage, { ...hint, returnPath: '/quote' }) :
          savePortalOriginHint(window.sessionStorage, { ...hint, returnPath: '/aishodan' }))) return false
        const stored = serviceId === 'quote' ? readQuotePortalHint(window.sessionStorage, actorId, navigationId) : readPortalOriginHint(window.sessionStorage, actorId, navigationId)
        return typeof stored === 'object' && stored.organizationId === hint.organizationId && stored.slug === hint.slug && checkoutActionGuard.current()
      } catch { return false }
    },
    returnPath: navigationId => `/${serviceId}/billing-return/${navigationId}`,
  } : undefined
  return billing.kind === 'ready'
    ? <UnifiedPricingPlans serviceId={serviceId} currentPlan={billing.plan} planSource="organization" checkoutActionGuard={checkoutActionGuard}
        portalNavigationGuard={portalNavigationGuard}
        loginCallbackUrl={strict ? workspaceProof?.href(`/${serviceId}/pricing`) : undefined}
        workspaceHomeHref={strict ? workspaceProof?.href(`/${serviceId}`) : undefined} />
    : null
}
