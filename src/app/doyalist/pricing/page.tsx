'use client'

import { useCallback, useEffect, useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { UnifiedPricingPlans } from '@/components/UnifiedPricingPlans'

type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE'

function normalizePlan(rawTier: unknown): PlanId | null {
  const s = String(rawTier || '').toUpperCase()
  if (s.includes('ENTERPRISE')) return 'ENTERPRISE'
  // 統一プラン方式: PRO / LIGHT / BUSINESS / STARTER / BASIC は全て PRO 扱い
  if (s.includes('PRO') || s.includes('LIGHT') || s.includes('BUSINESS') || s.includes('STARTER') || s.includes('BASIC')) return 'PRO'
  return s === 'FREE' ? 'FREE' : null
}

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null)
  const [planError, setPlanError] = useState(false)

  const loadPlan = useCallback(async () => {
    setPlanError(false)
    try {
      const response = await fetch('/api/doyalist/usage', { cache: 'no-store' })
      if (response.status === 401) {
        setCurrentPlan(null)
        return
      }
      if (!response.ok) throw new Error('プランを確認できませんでした')
      const data = await response.json()
      const planRaw = data?.plan
      const tier = typeof planRaw === 'object' && planRaw !== null ? planRaw.tier || planRaw.raw : planRaw
      const verifiedPlan = normalizePlan(tier)
      if (!verifiedPlan) throw new Error('プランの応答が不正です')
      setCurrentPlan(verifiedPlan)
    } catch {
      setCurrentPlan(null)
      setPlanError(true)
    }
  }, [])

  useEffect(() => {
    void loadPlan()
  }, [loadPlan])

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-center" />

      <div className="p-4 lg:p-10 max-w-6xl mx-auto pb-20">
        {/* ===== Page Header ===== */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 mb-4">
            <span className="material-symbols-outlined text-cyan-600 text-base">diamond</span>
            <span className="text-xs font-black text-cyan-700">料金プラン</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-[#0a1530] mb-3">
            シンプルな2プラン
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto">
            無料ではじめて、必要になったらプロへ。<br className="sm:hidden" />
            いつでも変更・解約可能です。
          </p>
        </div>

        {/* ===== Unified Pricing Plans (無料 / プロ ¥9,980) ===== */}
        {planError && <div role="alert" className="mb-6 rounded-xl bg-rose-50 p-4 text-sm font-bold text-rose-700">現在のプランを確認できませんでした。<button type="button" onClick={() => void loadPlan()} className="ml-2 underline">再読み込み</button></div>}
        <UnifiedPricingPlans serviceId="doyalist" currentPlan={currentPlan} className="my-12" />

        {/* ===== FAQ ===== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8 mt-12">
          <h3 className="text-lg font-black text-[#0a1530] mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-600">help</span>
            よくある質問
          </h3>
          <div className="space-y-5 text-sm">
            <Faq q="プランはいつでも変更できますか?" a="はい。いつでもアップグレード・ダウングレードが可能です。Stripeのカスタマーポータルから簡単に変更できます。" />
            <Faq q="月の途中で契約した場合は?" a="日割り計算が適用されます。残日数分の料金のみご請求します。" />
            <Faq q="無料プランの上限を超えるとどうなりますか?" a="月初にリセットされます。途中でPROプランに変更すれば即時に拡張上限が適用されます。" />
            <Faq q="他のドヤAIサービスも使えますか?" a="PROに加入いただくと、ドヤリスト・ドヤ勤怠・ドヤバナーAI・ドヤライティングAI・ドヤインタビュー等、すべてのドヤAIサービスのPROプランをご利用いただけます（統一プラン方式）。" />
            <Faq q="支払い方法は?" a="クレジットカード（Visa / Mastercard / JCB / American Express）に対応しています。Stripeで安全に処理されます。" />
            <Faq q="解約方法は?" a="サブスクリプション管理からいつでも解約できます。解約後も契約期間終了まではご利用いただけます。" />
          </div>
          <div className="mt-8 pt-5 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-600">用語について:</strong><br />
            <strong>ドヤAI</strong>: スリスタが提供するAI SaaSプラットフォームの総称 / <strong>ドヤリスト</strong>: 営業リスト抽出・営業文作成ツール（本サービス） / <strong>ドヤ勤怠 / ドヤバナーAI / ドヤライティングAI 等</strong>: ドヤAIのサブサービス
          </div>
        </div>
      </div>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-black text-[#0a1530] mb-1.5">Q. {q}</p>
      <p className="text-slate-600 leading-relaxed pl-4 border-l-2 border-cyan-200">{a}</p>
    </div>
  )
}
