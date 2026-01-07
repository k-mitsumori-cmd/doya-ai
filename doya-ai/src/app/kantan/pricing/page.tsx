'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowLeft, Sparkles, Crown, Zap, Star, Building2, CheckCircle2, ChevronRight, Rocket, Cpu, ArrowRight, HelpCircle, Clock, Users, FileText, BarChart3, Lightbulb } from 'lucide-react'
import { KANTAN_PRICING, getAnnualMonthlyPrice } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

const BENEFITS = [
  { metric: '4時間→10分', multiplier: '24x', title: 'LP構成案作成', icon: <FileText className="w-5 h-5" /> },
  { metric: '40案/1分', multiplier: '40+', title: 'バナーコピー', icon: <Lightbulb className="w-5 h-5" /> },
  { metric: '5日→5分', multiplier: '720x', title: '広告分析', icon: <BarChart3 className="w-5 h-5" /> },
]

export default function KantanPricingPage() {
  const { data: session } = useSession()
  const plans = KANTAN_PRICING.plans

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* アニメーション背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/30 via-transparent to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '3s' }} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/kantan" className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-all duration-300">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-medium">トップ</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl blur opacity-50" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Rocket className="w-4 h-4 text-white" />
              </div>
            </div>
            <span className="font-bold hidden sm:inline">カンタンマーケAI</span>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full text-xs font-bold">
            <Cpu className="w-3 h-3 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Gemini 2.0</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-6xl mx-auto px-6 py-16 relative">
        {/* タイトル */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-sm font-bold mb-6">
            <Sparkles className="w-4 h-4" />
            シンプルな料金体系
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-4">
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">料金プラン</span>
          </h1>
          <p className="text-xl text-white/40 max-w-xl mx-auto">
            あなたのマーケティング業務に合ったプランをお選びください
          </p>
        </div>

        {/* 料金カード */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-20">
          {plans.map((plan, index) => {
            const isPopular = plan.popular
            const isEnterprise = plan.priceLabel === '要相談'
            const Icon = index === 0 ? Sparkles : index === 1 ? Star : Building2
            const gradients = [
              'from-slate-500/20 to-gray-500/20',
              'from-cyan-500/20 to-emerald-500/20',
              'from-amber-500/20 to-orange-500/20',
            ]
            const borderColors = [
              'border-white/5 hover:border-white/10',
              'border-cyan-500/30 hover:border-cyan-500/50',
              'border-amber-500/20 hover:border-amber-500/30',
            ]
            
            return (
              <div key={plan.id} className="group relative">
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white text-xs font-black rounded-full shadow-lg shadow-cyan-500/30">
                      MOST POPULAR
                    </div>
                  </div>
                )}
                
                <div className={`relative h-full p-8 rounded-3xl backdrop-blur-xl transition-all duration-500 bg-gradient-to-br ${gradients[index]} border ${borderColors[index]}`}>
                  {/* 装飾 */}
                  {isPopular && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-2xl" />
                  )}
                  
                  <div className="relative">
                    {/* アイコン */}
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${
                      isPopular 
                        ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/30' 
                        : 'bg-white/5'
                    }`}>
                      <Icon className={`w-7 h-7 ${isPopular ? 'text-white' : 'text-white/40'}`} />
                    </div>
                    
                    {/* プラン名 */}
                    <h2 className="text-2xl font-bold text-white mb-1">{plan.name}</h2>
                    <p className="text-sm text-white/40 mb-6">{plan.description}</p>
                    
                    {/* 価格 */}
                    <div className="mb-6">
                      <span className={`text-4xl font-black ${isPopular ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent' : 'text-white'}`}>
                        {plan.priceLabel}
                      </span>
                      {plan.period && (
                        <span className="text-white/40 text-sm">{plan.period}</span>
                      )}
                      {plan.price > 0 && (
                        <p className="text-xs text-white/30 mt-1">
                          年払いなら ¥{getAnnualMonthlyPrice(plan.price).toLocaleString()}/月
                        </p>
                      )}
                    </div>
                    
                    {/* 機能一覧 */}
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                          <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${isPopular ? 'text-cyan-400' : 'text-white/30'}`} />
                          {feature.text}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {plan.price === 0 ? (
                      <Link href="/kantan/dashboard" className="block">
                        <button className="w-full py-4 rounded-xl font-bold border border-white/10 hover:border-white/30 text-white/60 hover:text-white transition-all duration-300">
                          {plan.cta}
                        </button>
                      </Link>
                    ) : isEnterprise ? (
                      <a href="mailto:support@doya-ai.com?subject=カンタンマーケAI法人プランお問い合わせ" className="block">
                        <button className="w-full py-4 rounded-xl font-bold border border-amber-500/30 hover:border-amber-500/50 text-amber-400 hover:text-amber-300 transition-all duration-300">
                          {plan.cta}
                        </button>
                      </a>
                    ) : (
                      <CheckoutButton
                        planId={plan.id}
                        className={`w-full py-4 ${
                          isPopular
                            ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-lg shadow-cyan-500/25'
                            : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
                        }`}
                        variant={isPopular ? 'primary' : 'secondary'}
                      >
                        {plan.cta}
                      </CheckoutButton>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 導入効果 */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h3 className="text-2xl md:text-3xl font-black text-white mb-2">
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">劇的な効率化</span>を実現
            </h3>
            <p className="text-white/40">コスト・リードタイム大幅削減</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl hover:border-cyan-500/20 transition-all duration-300 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-cyan-400 group-hover:scale-110 transition-transform">
                    {benefit.icon}
                  </div>
                  <div className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-1">
                    {benefit.multiplier}
                  </div>
                  <div className="text-white font-bold mb-1">{benefit.title}</div>
                  <p className="text-xs text-white/40">{benefit.metric}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-white/60 rounded-full text-sm font-bold mb-4">
              <HelpCircle className="w-4 h-4" />
              よくある質問
            </div>
          </div>
          
          <div className="space-y-4">
            {[
              { q: '無料プランでどこまで使えますか？', a: `ゲストは1日${KANTAN_PRICING.guestLimit}回、ログイン後は1日${KANTAN_PRICING.freeLimit}回まで使用できます。すべてのAIエージェントを試すことができます。` },
              { q: 'プロンプトの知識は必要ですか？', a: 'いいえ、プロンプトの知識は不要です。チャット形式で質問するだけで、AIエージェントが最適なアウトプットを生成します。' },
              { q: 'チャット形式とは何ですか？', a: '生成されたアウトプットに対して、追加の指示や修正依頼をチャットで行えます。対話しながらより良い成果物に磨き上げられます。' },
              { q: 'いつでも解約できますか？', a: 'はい、いつでも解約可能です。解約後も期間終了まで利用できます。' },
              { q: '年払いはできますか？', a: 'はい、年払いで20%オフになります。お支払い画面で選択できます。' },
              { q: '法人プランとは何ですか？', a: '業務プロセス全体をAI化するカスタムAIエージェントの構築支援です。貴社のセキュリティ要件に合わせた設計も可能です。' },
            ].map((faq, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative p-6 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl hover:border-white/10 transition-all duration-300">
                  <h4 className="font-bold text-white mb-2">{faq.q}</h4>
                  <p className="text-white/40 text-sm leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="relative text-center">
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-transparent to-transparent rounded-3xl" />
          <div className="relative py-16">
            <h3 className="text-3xl md:text-4xl font-black text-white mb-4">
              まずは<span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">無料</span>で試してみませんか？
            </h3>
            <p className="text-white/40 mb-10 text-lg">
              ログインすると1日10回まで無料でお試しいただけます
            </p>
            <Link href="/auth/signin?service=kantan">
              <button className="group relative px-12 py-5 overflow-hidden rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-500 to-teal-500" />
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-3">
                  無料で始める
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
