'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

type OrgBilling = { plan: string; planLabel: string; canManageBilling: boolean }

export default function HrPricingPage() {
  const { data: session, status } = useSession()
  const identity = String((session?.user as { id?: string } | undefined)?.id || session?.user?.email || '')
  const [billing, setBilling] = useState<OrgBilling | null>(null)
  const [needsOrganization, setNeedsOrganization] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedIdentity, setLoadedIdentity] = useState('')
  const request = useRef(0)
  const loadBilling = useCallback(async () => {
    const sequence = ++request.current
    setLoading(true)
    setLoadError(false)
    setNeedsOrganization(false)
    try {
      const response = await fetch('/api/hr/usage', { cache: 'no-store' })
      if (sequence !== request.current) return
      if (response.status === 401) {
        setBilling(null)
        setNeedsOrganization(true)
        return
      }
      if (!response.ok) throw new Error('組織のプランを確認できませんでした')
      const data = await response.json()
      if (sequence !== request.current) return
      if (typeof data.plan !== 'string' || typeof data.planLabel !== 'string' || typeof data.canManageBilling !== 'boolean') {
        throw new Error('プランの応答が不正です')
      }
      setBilling(data)
    } catch {
      if (sequence === request.current) {
        setBilling(null)
        setLoadError(true)
      }
    } finally {
      if (sequence === request.current) {
        setLoadedIdentity(identity)
        setLoading(false)
      }
    }
  }, [identity])
  useEffect(() => {
    const requestRef = request
    if (status === 'authenticated') void loadBilling()
    if (status === 'unauthenticated') setLoading(false)
    return () => { requestRef.current++ }
  }, [status, loadBilling])

  const verifying = status === 'loading' || (status === 'authenticated' && (loading || loadedIdentity !== identity))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="text-center mb-10">
            <Link
              href="/hr/dashboard"
              className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              ダッシュボードに戻る
            </Link>
            <h1 className="text-3xl font-black text-slate-900">料金プラン</h1>
            <p className="mt-2 text-slate-500 font-bold max-w-xl mx-auto">
              ドヤHR は5名まで永久無料。プロプラン1つで、ドヤAIの全サービスのプロ機能をプラン別の上限内で利用できます。
            </p>
          </div>

          {verifying && <p className="text-center text-sm font-bold text-slate-500">組織のプランを確認しています…</p>}
          {status === 'authenticated' && !verifying && loadError && (
            <div role="alert" className="mx-auto max-w-xl rounded-2xl bg-rose-50 p-6 text-sm font-bold text-rose-700">
              組織のプランを確認できませんでした。<button type="button" onClick={() => void loadBilling()} className="ml-2 underline">再読み込み</button>
            </div>
          )}
          {status === 'authenticated' && !verifying && needsOrganization && (
            <div role="status" className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-700">
              組織を確認できませんでした。<Link href="/hr" className="ml-1 font-bold text-blue-700 underline">ドヤHRで設定状況を確認する</Link>
            </div>
          )}
          {status === 'authenticated' && !verifying && !loadError && billing && !billing.canManageBilling && (
            <div role="status" className="mx-auto max-w-xl rounded-2xl border border-blue-200 bg-blue-50 p-6 text-sm leading-7 text-blue-900">
              この組織の現在のプランは{billing.planLabel}です。ご自身の契約を変更しても組織の利用枠は増えません。利用枠の変更は組織のオーナーにご相談ください。
            </div>
          )}
          {status === 'authenticated' && !verifying && !loadError && billing?.canManageBilling && (
            <UnifiedPricingPlans serviceId="hr" currentPlan={billing.plan} />
          )}
          {status === 'unauthenticated' && <UnifiedPricingPlans serviceId="hr" />}
        </motion.div>
      </div>
    </div>
  )
}
