'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

type PlanId = 'FREE' | 'PRO' | 'ENTERPRISE'

interface Plan {
  id: PlanId
  name: string
  tagline: string
  price: string
  priceSub: string
  highlight?: boolean
  badge?: string
  cta: string
  ctaSub?: string
  features: string[]
}

const PLANS: Plan[] = [
  {
    id: 'FREE',
    name: '無料プラン',
    tagline: 'まずは試してみる',
    price: '¥0',
    priceSub: '永久無料',
    cta: '無料で始める',
    features: [
      '月 1,000社まで抽出',
      'AIキーワード変換',
      'CSV/Excelエクスポート',
      '営業文・メール・スクリプト生成（月30回）',
    ],
  },
  {
    id: 'PRO',
    name: 'プロ',
    tagline: '営業チームの定番',
    price: '¥9,800',
    priceSub: '/月（税抜）',
    highlight: true,
    badge: '人気',
    cta: 'プロを始める',
    ctaSub: 'いつでも解約可',
    features: [
      '月 50,000社まで抽出',
      'AIキーワード変換 / 詳細データ全件',
      '営業文・メール・スクリプト生成（月500回）',
      'プロジェクト数 無制限',
      'ドヤAI 全サービスPRO利用可（バナー/SEO/インタビュー他）',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'エンタープライズ',
    tagline: '大規模組織向け',
    price: 'お問い合わせ',
    priceSub: 'カスタム見積もり',
    cta: 'お問い合わせ',
    features: [
      '月 無制限の抽出',
      '営業文等 無制限生成',
      'SSO / SAML 認証',
      'SLA契約 / オンプレ対応',
      'API連携 / カスタム開発',
    ],
  },
]

// 機能比較表
const COMPARISON: { label: string; values: [string, string, string] }[] = [
  { label: '月間 抽出社数', values: ['1,000社', '50,000社', '無制限'] },
  { label: 'プロジェクト数', values: ['無制限', '無制限', '無制限'] },
  { label: '営業文・メール・スクリプト生成', values: ['月30回', '月500回', '無制限'] },
  { label: 'AIキーワード変換', values: ['◯', '◯', '◯'] },
  { label: '詳細データ取得（代表者・資本金等）', values: ['◯', '◯', '◯'] },
  { label: 'CSV/Excelエクスポート', values: ['◯', '◯', '◯'] },
  { label: 'ドヤAI 全サービスPRO（バナー/SEO/インタビュー他）', values: ['—', '◯', '◯'] },
  { label: 'SSO/SAML', values: ['—', '—', '◯'] },
  { label: 'API連携 / カスタム開発', values: ['—', '—', '◯'] },
  { label: 'SLA契約', values: ['—', '—', '◯'] },
]

function normalizePlan(rawTier: unknown): PlanId {
  const s = String(rawTier || '').toUpperCase()
  if (s.includes('ENTERPRISE')) return 'ENTERPRISE'
  // 統一プラン方式: PRO / LIGHT / BUSINESS / STARTER / BASIC は全て PRO 扱い
  if (s.includes('PRO') || s.includes('LIGHT') || s.includes('BUSINESS') || s.includes('STARTER') || s.includes('BASIC')) return 'PRO'
  return 'FREE'
}

export default function PricingPage() {
  const { data: session, status: sessionStatus } = useSession()
  const [currentPlan, setCurrentPlan] = useState<PlanId>('FREE')
  const [periodEnd, setPeriodEnd] = useState<string | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [planLoading, setPlanLoading] = useState(true)

  useEffect(() => {
    setPlanLoading(true)
    fetch('/api/doyalist/usage')
      .then((r) => r.json())
      .then((d) => {
        // 1) API から tier 取得（最優先・DBから最新値）
        const planRaw: any = d?.plan
        const apiTier = typeof planRaw === 'object' && planRaw !== null
          ? planRaw.tier || planRaw.raw
          : planRaw
        // 2) NextAuth セッションの user.plan も予備
        const sessionPlan = (session?.user as any)?.plan
        // 3) 両方を見て、より上位のプランを採用（ダウングレード誤表示防止）
        const apiPlan = normalizePlan(apiTier)
        const sessPlan = normalizePlan(sessionPlan)
        const priority = { FREE: 0, PRO: 1, ENTERPRISE: 2 }
        const best: PlanId = priority[apiPlan] >= priority[sessPlan] ? apiPlan : sessPlan
        setCurrentPlan(best)
        if (planRaw?.periodEnd) setPeriodEnd(planRaw.periodEnd)
      })
      .catch(() => {
        // API失敗時はセッションだけで判定
        const sessionPlan = (session?.user as any)?.plan
        setCurrentPlan(normalizePlan(sessionPlan))
      })
      .finally(() => setPlanLoading(false))
  }, [session])

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
        body: JSON.stringify({ plan: 'pro' }),
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
            シンプルな3プラン
          </h1>
          <p className="text-base text-slate-500 max-w-xl mx-auto">
            営業の規模に合わせて選べる3プラン。<br className="sm:hidden" />
            いつでも変更・解約可能です。
          </p>
        </div>

        {/* ===== Current Plan Banner ===== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center text-white shadow">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>diamond</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">現在のプラン</p>
              {planLoading || sessionStatus === 'loading' ? (
                <p className="text-lg font-black text-slate-300 animate-pulse">読み込み中...</p>
              ) : (
                <>
                  <p className="text-lg font-black text-[#0a1530]">
                    {PLANS.find((p) => p.id === currentPlan)?.name || '無料プラン'}
                  </p>
                  {periodEnd && currentPlan !== 'FREE' && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      次回更新: {new Date(periodEnd).toLocaleDateString('ja-JP')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          {currentPlan !== 'FREE' && (
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-base">settings</span>
              サブスクリプション管理
            </button>
          )}
        </div>

        {/* ===== Plans Grid (3 cards) ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-3xl p-7 transition-all ${
                  plan.highlight
                    ? 'ring-2 ring-cyan-500 shadow-2xl shadow-cyan-500/20 lg:-translate-y-3'
                    : 'border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white text-xs font-black rounded-full shadow-lg shadow-cyan-500/30">
                    {plan.badge}
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4 px-3 py-1 bg-emerald-500 text-white text-[10px] font-black rounded-full shadow-lg">
                    現在のプラン
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-black text-[#0a1530]">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{plan.tagline}</p>
                </div>

                <div className="mb-6 pb-6 border-b border-slate-100">
                  <p className="text-4xl font-black text-[#0a1530]">{plan.price}</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">{plan.priceSub}</p>
                </div>

                <ul className="space-y-3 mb-6 min-h-[280px]">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <span className="material-symbols-outlined text-base text-emerald-500 flex-shrink-0 mt-0.5">check_circle</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={isCurrent}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : plan.highlight
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white shadow-lg shadow-cyan-500/30'
                        : 'bg-[#0a1530] hover:bg-[#13234d] text-white'
                  }`}
                >
                  {isCurrent ? '利用中' : plan.cta}
                </button>
                {plan.ctaSub && !isCurrent && (
                  <p className="text-[10px] text-slate-400 text-center mt-2">{plan.ctaSub}</p>
                )}
              </div>
            )
          })}
        </div>

        {/* ===== Comparison Table ===== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-black text-[#0a1530] flex items-center gap-2">
              <span className="material-symbols-outlined text-cyan-600">compare</span>
              機能比較表
            </h2>
            <p className="text-xs text-slate-500 mt-1">プラン別の機能差をまとめて確認できます</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-4 text-left font-bold text-slate-600 text-xs w-1/3">機能</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className={`px-5 py-4 text-center font-black text-xs ${p.highlight ? 'bg-cyan-50 text-cyan-700' : 'text-[#0a1530]'}`}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, idx) => (
                  <tr key={row.label} className={`border-b border-slate-100 ${idx % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                    <td className="px-5 py-3 text-sm text-slate-700 font-medium">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className={`px-5 py-3 text-center text-sm ${i === 1 ? 'bg-cyan-50/50' : ''}`}>
                        {v === '◯' ? (
                          <span className="material-symbols-outlined text-emerald-500" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        ) : v === '—' ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <span className="font-bold text-[#0a1530]">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== FAQ ===== */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 lg:p-8">
          <h3 className="text-lg font-black text-[#0a1530] mb-5 flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-600">help</span>
            よくある質問
          </h3>
          <div className="space-y-5 text-sm">
            <Faq q="プランはいつでも変更できますか?" a="はい。いつでもアップグレード・ダウングレードが可能です。Stripeのカスタマーポータルから簡単に変更できます。" />
            <Faq q="月の途中で契約した場合は?" a="日割り計算が適用されます。残日数分の料金のみご請求します。" />
            <Faq q="無料プランの上限を超えるとどうなりますか?" a="月初にリセットされます。途中でPROプランに変更すれば即時に拡張上限が適用されます。" />
            <Faq q="他のドヤAIサービスも使えますか?" a="PRO以上に加入いただくと、ドヤリスト・ドヤ勤怠・ドヤバナーAI・ドヤライティングAI・ドヤインタビュー等、すべてのドヤAIサービスのPROプランをご利用いただけます（統一プラン方式）。" />
            <Faq q="支払い方法は?" a="クレジットカード（Visa / Mastercard / JCB / American Express）に対応しています。Stripeで安全に処理されます。" />
            <Faq q="解約方法は?" a="サブスクリプション管理ボタンからいつでも解約できます。解約後も契約期間終了まではご利用いただけます。" />
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
