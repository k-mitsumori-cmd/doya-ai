'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'
import { planLabel, tierFrom } from '@/lib/plan-utils'
import type { OrganizationService } from '@/lib/organization-billing'

type BillingState =
  | { kind: 'loading' | 'missing' | 'error'; identity: string }
  | { kind: 'ready'; identity: string; plan: string; canManageBilling: boolean }

export function OrganizationPricingPlans({ serviceId }: { serviceId: OrganizationService }) {
  const { data: session, status } = useSession()
  const identity = String((session?.user as { id?: string } | undefined)?.id || session?.user?.email || '')
  const [billing, setBilling] = useState<BillingState>({ kind: 'loading', identity: '' })
  const request = useRef(0)
  const loadBilling = useCallback(async () => {
    const sequence = ++request.current
    setBilling({ kind: 'loading', identity })
    try {
      const org = new URLSearchParams(window.location.search).get('org')
      const url = `/api/organization-billing/${serviceId}${org ? `?org=${encodeURIComponent(org)}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })
      if (sequence !== request.current) return
      if (response.status === 403) {
        setBilling({ kind: 'missing', identity })
        return
      }
      if (!response.ok) throw new Error('組織の契約を確認できませんでした')
      const data = await response.json()
      if (sequence !== request.current) return
      if (typeof data.plan !== 'string' || typeof data.canManageBilling !== 'boolean') throw new Error('契約情報が不正です')
      setBilling({ kind: 'ready', identity, plan: data.plan, canManageBilling: data.canManageBilling })
    } catch {
      if (sequence === request.current) setBilling({ kind: 'error', identity })
    }
  }, [serviceId, identity])

  useEffect(() => {
    const requestRef = request
    if (status === 'authenticated') void loadBilling()
    return () => { requestRef.current++ }
  }, [status, loadBilling])

  if (status === 'loading' || (status === 'authenticated' && (billing.identity !== identity || billing.kind === 'loading'))) {
    return <p className="text-center text-sm font-bold text-slate-500">組織のプランを確認しています…</p>
  }
  if (status === 'unauthenticated') return <UnifiedPricingPlans serviceId={serviceId} />
  if (billing.kind === 'missing') {
    return <div role="status" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700">
      組織を確認できませんでした。<Link href={`/${serviceId}`} className="font-bold text-blue-700 underline">サービスの画面で組織を確認する</Link>
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
  return billing.kind === 'ready'
    ? <UnifiedPricingPlans serviceId={serviceId} currentPlan={billing.plan} planSource="organization" />
    : null
}
