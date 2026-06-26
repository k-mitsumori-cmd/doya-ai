'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Check, Sparkles } from 'lucide-react'
import { CheckoutButton } from '@/components/CheckoutButton'
import { getServiceById } from '@/lib/services'
import {
  UNIFIED_PRO_PRICE_LABEL,
  UNIFIED_PRO_PLAN_ID,
  UNIFIED_PLAN_COPY,
} from '@/lib/unified-plan'

const BRAND = '#7f19e6'

/**
 * 全サービス共通の「無料 / プロ(¥9,980)」2プラン料金表。
 * 上限・機能は services.ts（単一ソース）から読み、価格は統一プラン設定から読む。
 *
 * @param serviceId services.ts の id（例: 'banner'）
 * @param currentPlan ログインユーザーの現在プラン（'FREE'|'PRO'等。あれば「現在のプラン」表示）
 */
export function UnifiedPricingPlans({
  serviceId,
  currentPlan,
  className,
}: {
  serviceId: string
  currentPlan?: string | null
  className?: string
}) {
  const pathname = usePathname()
  const returnTo = pathname || `/${serviceId}/pricing`

  const svc = getServiceById(serviceId)
  if (!svc) return null

  const freeLimit = svc.pricing?.free?.limit || '無料でお試し'
  const proLimit = svc.pricing?.pro?.limit || '上限が大幅アップ'
  const features = svc.features || []
  const plan = (currentPlan || '').toUpperCase()
  const isPro = plan === 'PRO' || plan === 'BUNDLE' || plan === 'ENTERPRISE'
  const isFree = !isPro && plan === 'FREE'

  return (
    <section className={className || ''}>
      <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
        {/* 無料プラン */}
        <div className="rounded-3xl border border-gray-200 bg-white p-7 flex flex-col">
          <div className="mb-1 text-sm font-bold text-gray-500">{UNIFIED_PLAN_COPY.freeName}</div>
          <div className="mb-1 flex items-end gap-1">
            <span className="text-4xl font-black text-gray-900">¥0</span>
          </div>
          <p className="mb-5 text-xs font-bold text-gray-400">{UNIFIED_PLAN_COPY.freeTagline}</p>

          <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold text-gray-500">利用上限</p>
            <p className="text-sm font-black text-gray-800">{freeLimit}</p>
          </div>

          <ul className="mb-6 space-y-2.5 flex-1">
            {features.slice(0, 5).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isFree ? (
            <span className="block w-full rounded-full bg-gray-100 px-6 py-3 text-center text-sm font-black text-gray-500 ring-1 ring-gray-200">
              現在のプラン
            </span>
          ) : (
            <Link
              href={svc.dashboardHref}
              className="block w-full rounded-full bg-white px-6 py-3 text-center text-sm font-black text-gray-900 ring-2 ring-gray-300 transition hover:bg-gray-50"
            >
              無料ではじめる
            </Link>
          )}
        </div>

        {/* プロプラン */}
        <div
          className="relative rounded-3xl p-7 flex flex-col text-white shadow-xl"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #5b0fb3)` }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1 text-[11px] font-black text-amber-950 shadow">
            おすすめ
          </div>

          <div className="mb-1 flex items-center gap-1.5 text-sm font-bold text-white/80">
            <Sparkles className="h-4 w-4" />
            {UNIFIED_PLAN_COPY.proName}
          </div>
          <div className="mb-1 flex items-end gap-2">
            <span className="text-4xl font-black">{UNIFIED_PRO_PRICE_LABEL}</span>
            <span className="mb-1 text-sm font-bold text-white/80">/ 月（税込）</span>
            <span className="mb-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-black text-amber-950">
              {UNIFIED_PLAN_COPY.proTrialBadge}
            </span>
          </div>
          <p className="mb-1 text-xs font-bold text-white/80">{UNIFIED_PLAN_COPY.proTagline}</p>
          <p className="mb-5 text-[11px] font-bold text-amber-200">{UNIFIED_PLAN_COPY.proTrialNote}</p>

          <div className="mb-4 rounded-xl bg-white/15 px-4 py-3">
            <p className="text-xs font-bold text-white/70">利用上限</p>
            <p className="text-sm font-black text-white">{proLimit}</p>
          </div>

          <ul className="mb-4 space-y-2.5 flex-1">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/95">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mb-4 rounded-xl bg-white/10 px-4 py-2.5 text-[11px] font-bold leading-relaxed text-white/90">
            {UNIFIED_PLAN_COPY.proNote}
          </div>

          {isPro ? (
            <span className="block w-full rounded-full bg-white/20 px-6 py-3 text-center text-sm font-black text-white ring-1 ring-white/30">
              ご利用中のプラン
            </span>
          ) : (
            <CheckoutButton
              planId={UNIFIED_PRO_PLAN_ID}
              loginCallbackUrl={returnTo}
              variant="secondary"
              className="block w-full rounded-full bg-amber-400 px-6 py-3.5 text-center text-base font-black text-amber-950 shadow-lg ring-1 ring-amber-300 transition hover:bg-amber-300"
            >
              初月無料でプロを試す
            </CheckoutButton>
          )}
        </div>
      </div>

      {/* 全サービス解放の訴求 + 詳細リンク */}
      <div className="mt-6 text-center">
        <Link
          href="/all-in-one"
          className="inline-flex items-center gap-1.5 text-sm font-bold transition hover:underline"
          style={{ color: BRAND }}
        >
          <Sparkles className="h-4 w-4" />
          プロプラン1つで、全サービスのプロ機能が使えます（詳しく見る）
        </Link>
      </div>

      {/* プラン管理・解約（Stripeカスタマーポータルへ。契約中の方向け） */}
      <div className="mt-3 text-center">
        <a
          href={`/api/stripe/portal?returnTo=${encodeURIComponent(returnTo)}`}
          className="text-xs font-bold text-gray-400 transition hover:text-gray-600 hover:underline"
        >
          ご契約中の方：お支払い方法の変更・プランの解約はこちら
        </a>
      </div>
    </section>
  )
}
