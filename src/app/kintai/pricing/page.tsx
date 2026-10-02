'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

export default function KintaiPricingPage() {
  const { data: session, status } = useSession()
  const identity = status === 'authenticated'
    ? String((session?.user as { id?: string } | undefined)?.id || session?.user?.email || '')
    : status
  const [userPlan, setUserPlan] = useState<string | null>(null)
  const [canManageBilling, setCanManageBilling] = useState(false)
  const [hasOrganization, setHasOrganization] = useState(false)
  const [planError, setPlanError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadedIdentity, setLoadedIdentity] = useState('')
  const request = useRef(0)
  const loadPlan = useCallback(async () => {
    const sequence = ++request.current
    setPlanError(false)
    setLoading(true)
    try {
      const response = await fetch('/api/kintai/usage', { cache: 'no-store' })
      if (sequence !== request.current) return
      if (!response.ok) throw new Error('プランを確認できませんでした')
      const data = await response.json()
      if (sequence !== request.current) return
      if (data.organizationId === null) {
        setUserPlan(null)
        setCanManageBilling(false)
        setHasOrganization(false)
        return
      }
      if (typeof data.plan !== 'string' || typeof data.canManageBilling !== 'boolean') throw new Error('プランの応答が不正です')
      setUserPlan(data.plan)
      setCanManageBilling(data.canManageBilling)
      setHasOrganization(true)
    } catch {
      if (sequence === request.current) {
        setUserPlan(null)
        setCanManageBilling(false)
        setHasOrganization(false)
        setPlanError(true)
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
    if (status !== 'loading') void loadPlan()
    return () => { requestRef.current++ }
  }, [status, loadPlan])
  const verifying = status === 'loading' || loading || loadedIdentity !== identity

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-violet-50">

      <div className="p-6 lg:p-10 max-w-6xl mx-auto relative">
        {/* Floating bears */}
        <img
          src="/kintai/characters/thumbsup_%E3%81%84%E3%81%84%E3%81%AD.png"
          alt=""
          className="bear-float hidden lg:block absolute -left-4 top-40 opacity-40"
          style={{ width: 80, height: 80, objectFit: 'contain' }}
        />
        <img
          src="/kintai/characters/jump_%E5%A4%A7%E5%96%9C%E3%81%B3.png"
          alt=""
          className="bear-float-2 hidden lg:block absolute -right-4 top-96 opacity-40"
          style={{ width: 70, height: 70, objectFit: 'contain' }}
        />

        {/* Header */}
        <div className="text-center mb-12 pricing-fade-in">
          <img
            src="/kintai/characters/present_%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3.png"
            alt="プレゼンするクマ"
            className="bear-float mx-auto mb-4"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 mb-3">
            ドヤ勤怠 料金プラン
          </h1>
          <p className="text-slate-500 max-w-lg mx-auto text-base">
            チームの成長に合わせて最適なプランを選択できます。
          </p>
          <div className="inline-flex items-center gap-2 mt-4 px-5 py-2 bg-gradient-to-r from-[#7f19e6]/10 to-violet-100 rounded-full">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              celebration
            </span>
            <span className="text-sm font-bold text-[#7f19e6]">
              従業員5名まで永久無料
            </span>
          </div>
        </div>

        {/* Plans grid (統一プラン: 無料 / プロ¥9,980) */}
        {!verifying && planError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">現在のプランを確認できませんでした。<button type="button" onClick={() => void loadPlan()} className="ml-2 underline">再読み込み</button></div>}
        {verifying && <p className="text-center text-sm font-bold text-slate-500">組織のプランを確認しています…</p>}
        {!verifying && !planError && hasOrganization && !canManageBilling && (
          <div role="status" className="mx-auto my-12 max-w-xl rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm leading-7 text-violet-900">
            この組織の現在のプランは{userPlan}です。ご自身の契約を変更しても組織の従業員上限は増えません。利用枠の変更は組織の契約者にご相談ください。
          </div>
        )}
        {!verifying && !planError && (!hasOrganization || canManageBilling) && <UnifiedPricingPlans serviceId="kintai" currentPlan={userPlan} className="my-12" />}

        {/* Trial notice */}
        {(!hasOrganization || canManageBilling) && !verifying && !planError && <div className="text-center mb-8">
          <p className="text-sm text-slate-500">
            <span className="material-symbols-outlined text-sm align-middle mr-1">info</span>
            新規の月額プロプラン対象者は30日間無料。対象可否は申込時に確認できます。
          </p>
        </div>}

        {/* CTA section */}
        {!verifying && !planError && !hasOrganization && <div className="bg-white rounded-3xl shadow-lg p-8 text-center pricing-fade-in-4">
          <img
            src="/kintai/characters/hello_%E6%8C%A8%E6%8B%B6.png"
            alt="挨拶するクマ"
            className="bear-float-2 mx-auto mb-4"
            style={{ width: 100, height: 100, objectFit: 'contain' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">まずは無料で始めてみませんか？</h3>
          <p className="text-base text-slate-600 mb-6 max-w-lg mx-auto">
            クレジットカード不要、従業員5名までの勤怠管理が永久無料でお使いいただけます。
            アップグレードはいつでも可能です。
          </p>
          <Link
            href="/kintai/dashboard"
            className="inline-flex items-center gap-2 px-10 py-4 bg-[#7f19e6] text-white rounded-full text-base font-bold shadow-lg shadow-[#7f19e6]/25 hover:shadow-xl hover:bg-[#6b14c4] transition-all"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            無料で始める
          </Link>
        </div>}
      </div>
    </div>
  )
}
