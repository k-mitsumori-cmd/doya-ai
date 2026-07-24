'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CheckoutButton } from '@/components/CheckoutButton'
import { TrialBadge, TrialNote, useTrialEligible } from '@/components/TrialCallout'
import { getServiceById, getActiveServices } from '@/lib/services'
import {
  UNIFIED_PRO_PRICE_LABEL,
  UNIFIED_PRO_PLAN_ID,
  UNIFIED_PLAN_COPY,
} from '@/lib/unified-plan'

const BRAND = '#0066ff'
const ACCENT = '#ff1e72'

function Sym({ name, size = 20, className = '', fill = false }: { name: string; size?: number; className?: string; fill?: boolean }) {
  return (
    <span className={`material-symbols-outlined leading-none ${className}`} style={{ fontSize: size, fontVariationSettings: fill ? "'FILL' 1" : undefined }} aria-hidden="true">{name}</span>
  )
}

/**
 * 全サービス共通の「無料 / プロ(¥9,980)」2プラン料金表（統一プラン）。
 * 「1契約で全サービス使い放題」を主役にした購入喚起デザイン。
 * 上限・機能は services.ts（単一ソース）から、価格は統一プラン設定から読む。
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
  const trialEligible = useTrialEligible()

  const svc = getServiceById(serviceId)
  if (!svc) return null

  const freeLimit = svc.pricing?.free?.limit || '無料でお試し'
  const proLimit = svc.pricing?.pro?.limit || '上限が大幅アップ'
  const features = svc.features || []
  const plan = (currentPlan || '').toUpperCase()
  const isPro = plan === 'PRO' || plan === 'BUNDLE' || plan === 'ENTERPRISE'
  const isFree = !isPro && plan === 'FREE'

  // 「使い放題」の価値づけ：全公開サービスの単体プロ料金の合計（＝個別契約したら相当）
  const activeServices = getActiveServices()
  const serviceCount = activeServices.length
  const totalProValue = activeServices.reduce((sum, s) => sum + (s.pricing?.pro?.price || 0), 0)

  return (
    <section className={className || ''}>
      {/* ===== 価値ヘッダー：1契約で全サービス使い放題 ===== */}
      <div className="relative overflow-hidden rounded-[2rem] mb-8 px-6 py-9 text-center text-white"
        style={{ background: `linear-gradient(135deg, #0047b3, ${BRAND} 55%, #3d80ff)` }}>
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, white 1.5px, transparent 1.5px)', backgroundSize: '28px 28px' }} aria-hidden="true" />
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-widest uppercase mb-3 px-3 py-1 rounded-full bg-white/15">
            <Sym name="all_inclusive" size={16} />統一プラン
          </span>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            プロ1つで、<span style={{ color: '#ffd400' }}>{serviceCount}サービス</span>ぜんぶ使い放題。
          </h2>
          <p className="mt-3 text-sm md:text-base font-bold text-white/85">
            ドヤAIの全ツールのプロ機能が、月々{UNIFIED_PRO_PRICE_LABEL}で。個別契約も、組み合わせも不要です。
          </p>
          {totalProValue > 0 && (
            <div className="mt-5 inline-flex items-center gap-2.5 rounded-2xl bg-white/12 px-5 py-3">
              <span className="text-sm font-bold text-white/70 line-through">単体合計 ¥{totalProValue.toLocaleString()}/月 相当</span>
              <Sym name="arrow_forward" size={18} className="text-white/70" />
              <span className="text-xl font-black" style={{ color: '#ffd400' }}>{UNIFIED_PRO_PRICE_LABEL}/月</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== 2プランカード ===== */}
      <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
        {/* 無料プラン */}
        <div className="rounded-3xl border border-slate-200 bg-white p-7 flex flex-col">
          <div className="mb-1 text-sm font-black text-slate-500">{UNIFIED_PLAN_COPY.freeName}</div>
          <div className="mb-1 flex items-end gap-1"><span className="text-5xl font-black text-slate-900">¥0</span></div>
          <p className="mb-5 text-xs font-bold text-slate-400">{UNIFIED_PLAN_COPY.freeTagline}</p>

          <div className="mb-5 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-slate-500">このサービスの利用上限</p>
            <p className="text-sm font-black text-slate-800">{freeLimit}</p>
          </div>

          <ul className="mb-6 space-y-2.5 flex-1">
            {features.slice(0, 5).map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <Sym name="check" size={18} className="mt-0.5 flex-shrink-0 text-slate-400" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {isFree ? (
            <span className="block w-full rounded-full bg-slate-100 px-6 py-3.5 text-center text-sm font-black text-slate-500 ring-1 ring-slate-200">現在のプラン</span>
          ) : (
            <Link href={svc.dashboardHref} className="block w-full rounded-full bg-white px-6 py-3.5 text-center text-sm font-black text-slate-900 ring-2 ring-slate-300 transition hover:bg-slate-50">
              無料ではじめる
            </Link>
          )}
        </div>

        {/* プロプラン（主役） */}
        <div className="relative rounded-3xl p-7 pt-9 flex flex-col text-white shadow-2xl"
          style={{ background: `linear-gradient(150deg, ${BRAND}, #0047b3 70%, #6d28d9)`, boxShadow: '0 24px 60px -12px rgba(0,102,255,0.5)' }}>
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] font-black text-white shadow-lg whitespace-nowrap"
            style={{ background: `linear-gradient(90deg, ${ACCENT}, #ff5c1e)` }}>
            いちばん人気・いちばんお得
          </div>

          <div className="mb-1 flex items-center gap-1.5 text-sm font-black text-white/85">
            <Sym name="workspace_premium" size={18} style={{ color: '#ffd400' }} />{UNIFIED_PLAN_COPY.proName}
          </div>
          <div className="mb-1 flex items-end gap-2 flex-wrap">
            <span className="text-5xl font-black">{UNIFIED_PRO_PRICE_LABEL}</span>
            <span className="mb-1.5 text-sm font-bold text-white/80">/ 月（税込）</span>
            <TrialBadge tone="dark" className="mb-1.5" />
          </div>
          <TrialNote tone="dark" className="mb-4" />

          {/* 使い放題の強調 */}
          <div className="mb-4 rounded-2xl bg-white/12 px-4 py-3 flex items-center gap-3">
            <span className="grid place-items-center w-9 h-9 rounded-xl shrink-0" style={{ background: '#ffd400', color: '#0047b3' }}><Sym name="all_inclusive" size={20} fill /></span>
            <div>
              <p className="text-sm font-black leading-tight">全{serviceCount}サービスのプロ機能が使い放題</p>
              <p className="text-[11px] font-bold text-white/75">このサービスの上限：{proLimit}</p>
            </div>
          </div>

          <ul className="mb-4 space-y-2.5 flex-1">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/95">
                <Sym name="check_circle" size={18} className="mt-0.5 flex-shrink-0" style={{ color: '#ffd400' }} fill />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mb-5 rounded-xl bg-white/10 px-4 py-2.5 text-[11px] font-bold leading-relaxed text-white/90">
            {UNIFIED_PLAN_COPY.proNote}
          </div>

          {isPro ? (
            <span className="block w-full rounded-full bg-white/20 px-6 py-3.5 text-center text-sm font-black text-white ring-1 ring-white/30">ご利用中のプラン</span>
          ) : (
            <CheckoutButton
              planId={UNIFIED_PRO_PLAN_ID}
              loginCallbackUrl={returnTo}
              variant="secondary"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffd400] px-6 py-4 text-center text-base font-black text-[#0a2540] shadow-xl ring-1 ring-[#ffe066] transition hover:bg-[#ffdd33] hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }} aria-hidden="true">bolt</span>
              {trialEligible ? '初月無料でプロを試す' : 'プロにアップグレード'}
            </CheckoutButton>
          )}
          <p className="mt-2.5 text-center text-[11px] font-bold text-white/70">いつでも解約OK・{trialEligible ? '初月無料' : '月額のみ'}・追加課金なし</p>
        </div>
      </div>

      {/* ===== プロで解放される全サービス（使い放題の可視化） ===== */}
      <div className="max-w-4xl mx-auto mt-10">
        <p className="text-center text-sm font-black text-slate-500 mb-4">
          <Sym name="lock_open" size={16} className="align-middle mr-1" style={{ color: BRAND }} />
          プロプラン1つで、この{serviceCount}サービスすべてが使い放題に
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {activeServices.map((s) => {
            const on = s.id === serviceId
            return (
              <span key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border"
                style={on
                  ? { background: BRAND, color: 'white', borderColor: BRAND }
                  : { background: 'white', color: '#334155', borderColor: '#e2e8f0' }}>
                <Sym name="check" size={14} style={{ color: on ? '#ffd400' : BRAND }} />
                {s.name}
              </span>
            )
          })}
        </div>
        <div className="mt-6 text-center">
          <Link href="/all-in-one" className="inline-flex items-center gap-1.5 text-sm font-black transition hover:underline" style={{ color: BRAND }}>
            統一プランの詳細を見る<Sym name="arrow_forward" size={16} />
          </Link>
        </div>
      </div>

      {/* プラン管理・解約 */}
      <div className="mt-4 text-center">
        <a href={`/api/stripe/portal?returnTo=${encodeURIComponent(returnTo)}`} className="text-xs font-bold text-slate-400 transition hover:text-slate-600 hover:underline">
          ご契約中の方：お支払い方法の変更・プランの解約はこちら
        </a>
      </div>
    </section>
  )
}
