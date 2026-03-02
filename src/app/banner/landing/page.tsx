'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Crown, LogIn, Check, Zap, MessageSquare, BarChart3, Layers, Clock, ShieldCheck, Zap as ZapIcon, Users } from 'lucide-react'
import { getServiceById } from '@/lib/services'
import { BANNER_PRICING } from '@/lib/pricing'
import { motion } from 'framer-motion'

// カテゴリ一覧
const categories = [
  { id: 'telecom', name: '通信向け', icon: '📱', desc: '格安SIM・光回線', color: 'from-blue-600 to-blue-700' },
  { id: 'marketing', name: 'マーケティング', icon: '📊', desc: 'リード獲得', color: 'from-blue-600 to-blue-700' },
  { id: 'ec', name: 'EC向け', icon: '🛒', desc: 'セール・キャンペーン', color: 'from-orange-500 to-orange-600' },
  { id: 'recruit', name: '採用向け', icon: '👥', desc: '求人・説明会', color: 'from-blue-600 to-blue-700' },
  { id: 'beauty', name: '美容・コスメ', icon: '💄', desc: 'スキンケア・化粧品', color: 'from-amber-400 to-amber-500' },
  { id: 'food', name: '飲食・フード', icon: '🍽️', desc: 'レストラン・デリバリー', color: 'from-orange-500 to-orange-600' },
]

export default function BannerLandingPage() {
  const { data: session } = useSession()
  const service = getServiceById('banner')!
  const plan = (session?.user as any)?.bannerPlan || 'FREE'
  const isPro = plan === 'PRO'

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-blue-100">
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="hidden sm:flex items-center gap-1.5 text-slate-400 hover:text-blue-600 transition-colors text-sm font-bold">
              <ArrowRight className="w-4 h-4 rotate-180" />
              ポータル
            </Link>
            <div className="hidden sm:block w-px h-6 bg-slate-200"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="font-black text-slate-800 text-xl tracking-tighter uppercase">ドヤバナーAI</span>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="#pricing" className="hidden md:block text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors">
              料金プラン
            </Link>
            {session ? (
              <div className="flex items-center gap-3">
                {isPro && (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full uppercase tracking-wider border border-amber-100">
                    <Crown className="w-3.5 h-3.5" />
                    PRO MEMBER
                  </div>
                )}
                <Link href="/banner" className="px-5 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-blue-100 hover:scale-105 active:scale-95">
                  ダッシュボード
                </Link>
              </div>
            ) : (
              <Link href="/auth/doyamarke/signin?callbackUrl=%2Fbanner" className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-black rounded-xl transition-all shadow-lg shadow-blue-100 hover:scale-105 active:scale-95">
                <LogIn className="w-4 h-4" />
                ログイン
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ヒーロー */}
      <section className="relative pt-32 sm:pt-48 pb-20 sm:pb-32 px-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-blue-50 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 opacity-60 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-orange-50 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 opacity-40 pointer-events-none" />
        
        <div className="max-w-[1200px] mx-auto text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-widest mb-8 border border-blue-100"
          >
            <ZapIcon className="w-4 h-4 fill-blue-600" />
            AI-Driven Banner Generation
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-7xl font-black text-slate-800 mb-8 tracking-tight leading-[1.1]"
          >
            プロ品質のバナーを<br />
            <span className="text-blue-600">一瞬で可視化する</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl text-slate-500 mb-12 leading-relaxed max-w-2xl mx-auto font-medium"
          >
            カテゴリを選んでキーワードを入力するだけ。<br />
            ドヤバナーAIが戦略に基づいた3つのクリエイティブを瞬時に提案。
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {session ? (
              <Link href="/banner">
                <button className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black rounded-2xl shadow-2xl shadow-blue-200 transition-all flex items-center gap-3 hover:scale-105 active:scale-95">
                  ダッシュボードを開く
                  <ArrowRight className="w-6 h-6" />
                </button>
              </Link>
            ) : (
              <Link href="/auth/doyamarke/signin?callbackUrl=%2Fbanner">
                <button className="px-10 py-5 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black rounded-2xl shadow-2xl shadow-blue-200 transition-all flex items-center gap-3 hover:scale-105 active:scale-95">
                  無料でバナーを作る
                  <ArrowRight className="w-6 h-6" />
                </button>
              </Link>
            )}
            <Link href="#features">
              <button className="px-10 py-5 bg-white hover:bg-slate-50 text-slate-600 text-lg font-black rounded-2xl border border-slate-200 transition-all">
                詳細を見る
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 実績・統計 */}
      <section className="py-12 px-4 border-y border-slate-50 bg-slate-50/30">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: '利用ユーザー', value: '1,200+', icon: Users },
              { label: '生成バナー数', value: '45,000+', icon: Layers },
              { label: '平均削減時間', value: '45min', icon: Clock },
              { label: '平均CTR上昇', value: '128%', icon: BarChart3 },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="flex justify-center mb-3 text-blue-600">
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-800 mb-1">{stat.value}</div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 特徴 */}
      <section id="features" className="py-24 sm:py-32 px-4 bg-white relative overflow-hidden">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Core Features</h2>
            <h3 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight">
              広告効果を最大化する<br />
              革新的な機能
            </h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                title: '3案同時戦略生成', 
                desc: '「共感」「ベネフィット」「緊急性」など、異なる心理アプローチに基づいた3案を一度に生成。',
                icon: Layers,
                color: 'bg-blue-600 shadow-blue-100'
              },
              { 
                title: 'AIアドバイザー', 
                desc: '生成したバナーへの修正指示も日本語でOK。AIとチャットしながら微調整が可能です。',
                icon: MessageSquare,
                color: 'bg-orange-500 shadow-orange-100'
              },
              { 
                title: '日本語特化レイアウト', 
                desc: '海外ツールでは難しい、日本語の文字詰めやフォント感にこだわった読みやすいデザイン。',
                icon: ShieldCheck,
                color: 'bg-amber-500 shadow-amber-100'
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                <div className={`w-14 h-14 rounded-2xl ${feature.color} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7" />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-4">{feature.title}</h4>
                <p className="text-slate-500 font-medium leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* カテゴリ一覧 */}
      <section className="py-24 sm:py-32 px-4 bg-slate-50">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Industry Optimized</h2>
            <h3 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight">あらゆる業種に最適化</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <div key={cat.id} className="bg-white rounded-2xl p-6 border border-slate-100 hover:border-blue-300 transition-all hover:shadow-lg text-center group">
                <div className={`w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-inner`}>
                  <span className="text-3xl">{cat.icon}</span>
                </div>
                <h3 className="font-black text-slate-800 mb-1">{cat.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 料金 */}
      <section id="pricing" className="py-24 sm:py-32 px-4 bg-white">
        <div className="max-w-[1000px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-4">Pricing Plans</h2>
            <h3 className="text-3xl sm:text-5xl font-black text-slate-800 tracking-tight">シンプルな料金体系</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {BANNER_PRICING.plans.map((plan) => (
              <div
                key={plan.id}
                className={`p-10 rounded-[2.5rem] relative flex flex-col ${
                  plan.popular
                    ? 'bg-slate-900 text-white shadow-2xl shadow-blue-100 ring-4 ring-blue-600/10'
                    : 'bg-white text-slate-800 border-2 border-slate-100'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-blue-600 text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] shadow-lg">
                    Recommended
                  </div>
                )}
                <div className="mb-8">
                  <h3 className="text-xl font-black uppercase tracking-widest mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{plan.priceLabel}</span>
                    <span className={`text-sm font-bold ${plan.popular ? 'text-slate-400' : 'text-slate-400'}`}>{plan.period}</span>
                  </div>
                  <p className={`mt-4 text-sm font-medium ${plan.popular ? 'text-slate-400' : 'text-slate-500'}`}>{plan.description}</p>
                </div>

                <div className={`h-px w-full mb-8 ${plan.popular ? 'bg-white/10' : 'bg-slate-100'}`} />

                <ul className="space-y-4 mb-10 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${plan.popular ? 'bg-blue-600' : 'bg-blue-50'}`}>
                        <Check className={`w-3 h-3 ${plan.popular ? 'text-white' : 'text-blue-600'}`} />
                      </div>
                      <span className="text-sm font-bold leading-none pt-1">{feature.text}</span>
                    </li>
                  ))}
                </ul>

                <Link href={plan.price === 0 ? "/banner" : "/banner/pricing"}>
                  <button className={`w-full py-5 rounded-2xl font-black text-sm transition-all shadow-lg active:scale-95 ${
                    plan.popular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-900/20'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
                  }`}>
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing CTA */}
      <section className="py-24 px-4 bg-blue-600 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="max-w-[1000px] mx-auto relative z-10">
          <a
            href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1"
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="bg-white/10 backdrop-blur-md rounded-[2.5rem] p-8 sm:p-12 border border-white/20 hover:bg-white/15 transition-all">
              <div className="flex flex-col md:flex-row items-center gap-8 sm:gap-12">
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-3xl flex items-center justify-center flex-shrink-0 shadow-2xl group-hover:scale-105 transition-transform">
                  <span className="text-5xl sm:text-6xl">💬</span>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full text-[10px] font-black text-white uppercase tracking-widest mb-4">
                    Expert Consultation
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight">
                    マーケティングのお悩み、<br />プロに相談しませんか？
                  </h3>
                  <p className="text-white/80 font-medium leading-relaxed mb-0">
                    バナー制作・広告運用・SNS戦略など、ドヤマーケのプロフェッショナルがあなたのビジネス成長を直接サポート。
                  </p>
                </div>
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform flex-shrink-0">
                  <ArrowRight className="w-8 h-8 text-blue-600" />
                </div>
              </div>
            </div>
          </a>
        </div>
      </section>

      {/* 他サービスへの誘導 */}
      <section className="py-24 px-4 bg-slate-50">
        <div className="max-w-[1000px] mx-auto">
          <h2 className="text-2xl font-black text-slate-800 text-center mb-12 uppercase tracking-widest">Other AI Services</h2>

          <Link href="/seo">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 hover:border-blue-400 hover:shadow-2xl transition-all cursor-pointer group">
              <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                  <ZapIcon className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-2xl font-black text-slate-800 mb-2">ドヤライティングAI</h3>
                  <p className="text-slate-500 font-medium leading-relaxed">SEO記事をAIが自動作成。アウトラインから本文まで、最大20,000字の記事を一括生成。</p>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <ArrowRight className="w-6 h-6" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-16 px-4 bg-white border-t border-slate-100">
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="font-black text-slate-800 text-xl tracking-tighter uppercase">ドヤバナーAI</span>
            </div>
            
            <div className="flex items-center gap-8">
              <Link href="/" className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">ポータル</Link>
              <Link href="/seo" className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">ドヤライティングAI</Link>
              <Link href="/admin" className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">管理者</Link>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
              © 2025 ドヤバナーAI. Powered by DOYA AI.
            </p>
            <div className="flex items-center gap-6 text-[10px] font-black text-slate-300 uppercase tracking-widest">
              <Link href="#" className="hover:text-slate-400">Privacy Policy</Link>
              <Link href="#" className="hover:text-slate-400">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
