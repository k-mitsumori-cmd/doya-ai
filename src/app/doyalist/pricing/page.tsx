'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

type PlanId = 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

interface Plan {
  id: PlanId
  name: string
  tagline: string
  price: string
  priceSub: string
  highlight?: boolean
  badge?: string
  limits: { label: string; value: string }[]
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'FREE',
    name: '無料プラン',
    tagline: 'まずは試してみる',
    price: '¥0',
    priceSub: '永久無料',
    limits: [
      { label: 'プロジェクト数', value: '1件' },
      { label: '企業数 / 月', value: '20社' },
      { label: 'アプローチ / 月', value: '10件' },
    ],
    features: ['基本的なAI企業収集', 'CSV/Excelエクスポート', 'メールサポート'],
  },
  {
    id: 'LIGHT',
    name: 'ライト',
    tagline: '個人事業主・スタートアップ向け',
    price: '¥2,980',
    priceSub: '/月',
    limits: [
      { label: 'プロジェクト数', value: '5件' },
      { label: '企業数 / 月', value: '300社' },
      { label: 'アプローチ / 月', value: '100件' },
    ],
    features: [
      'AI企業収集（高精度）',
      'AI分析・スコアリング',
      'アプローチ文面生成',
      'メール・チャットサポート',
    ],
  },
  {
    id: 'PRO',
    name: 'プロ',
    tagline: '営業チーム向け（人気）',
    price: '¥9,800',
    priceSub: '/月',
    highlight: true,
    badge: '人気',
    limits: [
      { label: 'プロジェクト数', value: '50件' },
      { label: '企業数 / 月', value: '3,000社' },
      { label: 'アプローチ / 月', value: '1,000件' },
    ],
    features: [
      'すべてのライト機能',
      '一括アプローチ生成',
      'テンプレート無制限',
      '優先サポート',
      'API連携（β）',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'エンタープライズ',
    tagline: '大規模組織向け',
    price: 'お問い合わせ',
    priceSub: 'カスタム見積もり',
    limits: [
      { label: 'プロジェクト数', value: '無制限' },
      { label: '企業数 / 月', value: '無制限' },
      { label: 'アプローチ / 月', value: '無制限' },
    ],
    features: [
      'すべてのプロ機能',
      'SSO / SAML 認証',
      '専任カスタマーサクセス',
      'SLA契約',
      'オンプレ対応',
    ],
  },
]

export default function PricingPage() {
  const [currentPlan, setCurrentPlan] = useState('FREE' as PlanId)
  const [portalLoading, setPortalLoading] = useState(false)

  useEffect(() => {
    fetch('/api/doyalist/usage')
      .then((r) => r.json())
      .then((d) => setCurrentPlan(String(d?.plan || 'FREE').toUpperCase() as PlanId))
      .catch(() => {})
  }, [])

  const handlePortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      } else {
        toast.error('ポータルを開けませんでした')
      }
    } catch {
      toast.error('ポータルを開けませんでした')
    } finally {
      setPortalLoading(false)
    }
  }

  const handleCheckout = async (planId: PlanId) => {
    if (planId === 'ENTERPRISE') {
      window.location.href = 'mailto:support@surisuta.jp?subject=ドヤリスト エンタープライズプランお問い合わせ'
      return
    }
    if (planId === 'FREE') {
      toast.success('無料プランは登録済みです')
      return
    }
    const tid = toast.loading('決済ページへ移動中...')
    try {
      const res = await fetch('/api/doyalist/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId.toLowerCase() }),
      })
      const data = await res.json()
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error(data?.error || 'チェックアウトに失敗しました')
      }
    } catch (e: any) {
      toast.error(e?.message || 'チェックアウトに失敗しました', { id: tid })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1530] via-white to-[#0a1530]">
      <div className="p-6 lg:p-10 max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7f19e6]/10 mb-4">
            <span className="material-symbols-outlined text-[#7f19e6] text-base">diamond</span>
            <span className="text-xs font-black text-[#7f19e6]">料金プラン</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-800 mb-3">
            ドヤリスト 料金プラン
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto">
            営業の規模・チームサイズに合わせて選べる4つのプラン。いつでも変更・解約可能です。
          </p>
        </div>

        {/* Current plan banner */}
        <div className="bg-white rounded-3xl border border-purple-200 shadow-sm p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 flex items-center justify-center text-[#7f19e6]">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                diamond
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">現在のプラン</p>
              <p className="text-lg font-black text-slate-800">
                {PLANS.find((p) => p.id === currentPlan)?.name || '無料プラン'}
              </p>
            </div>
          </div>
          {currentPlan !== 'FREE' && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">settings</span>
              サブスク管理
            </button>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-3xl p-6 transition-all ${
                  plan.highlight
                    ? 'ring-2 ring-[#7f19e6] shadow-2xl shadow-[#7f19e6]/20 lg:-translate-y-2'
                    : 'border border-slate-100 shadow-sm hover:shadow-md'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#7f19e6] text-white text-xs font-black rounded-full shadow-lg shadow-[#7f19e6]/30">
                    {plan.badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-lg">
                    現在のプラン
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="text-lg font-black text-slate-800">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{plan.tagline}</p>
                </div>

                <div className="mb-5">
                  <p className="text-3xl font-black text-slate-800">{plan.price}</p>
                  <p className="text-xs font-bold text-slate-400 mt-0.5">{plan.priceSub}</p>
                </div>

                {/* Limits */}
                <div className="mb-5 pb-5 border-b border-slate-100 space-y-2">
                  {plan.limits.map((l) => (
                    <div key={l.label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{l.label}</span>
                      <span className="font-black text-slate-800">{l.value}</span>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <span className="material-symbols-outlined text-base text-emerald-500 mt-px">
                        check_circle
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-2.5 rounded-full font-bold text-sm transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : plan.highlight
                        ? 'bg-[#7f19e6] hover:bg-[#5b0fb3] text-white shadow-lg shadow-[#7f19e6]/30'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCurrent
                    ? '利用中'
                    : plan.id === 'ENTERPRISE'
                      ? 'お問い合わせ'
                      : plan.id === 'FREE'
                        ? '無料で始める'
                        : 'このプランにする'}
                </button>
              </div>
            )
          })}
        </div>

        {/* FAQ / Notes */}
        <div className="bg-white rounded-3xl border border-slate-100 p-6 lg:p-8 shadow-sm">
          <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#7f19e6]">help</span>
            よくある質問
          </h3>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-black text-slate-700 mb-1">プランはいつでも変更できますか?</p>
              <p className="text-slate-500">
                はい。いつでもアップグレード・ダウングレードが可能です。Stripeのカスタマーポータルから簡単に変更できます。
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700 mb-1">月の途中で契約した場合は?</p>
              <p className="text-slate-500">
                日割り計算が適用されます。残日数分の料金のみご請求します。
              </p>
            </div>
            <div>
              <p className="font-black text-slate-700 mb-1">他のドヤAIサービスも使えますか?</p>
              <p className="text-slate-500">
                ドヤマーケAIの統一プランに加入いただくと、すべてのドヤAIサービスのPROプランをご利用いただけます。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
