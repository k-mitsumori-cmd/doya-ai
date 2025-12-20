'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowRight, Sparkles, Crown, LogIn, Zap, Clock, Users, MessageSquare, BarChart3, Target, FileText, Lightbulb, TrendingUp, CheckCircle2, Cpu, Rocket, Brain, ChevronRight } from 'lucide-react'
import { getServiceById } from '@/lib/services'
import { KANTAN_PRICING } from '@/lib/pricing'

// マーケティングAIエージェント一覧
const AI_AGENTS = [
  { 
    id: 'lp-full-text', 
    name: 'LP構成案', 
    icon: <FileText className="w-7 h-7" />,
    desc: '4時間を10分に短縮',
    metric: '24x',
    gradient: 'from-cyan-400 via-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/50',
  },
  { 
    id: 'banner-copy', 
    name: 'バナーコピー', 
    icon: <Lightbulb className="w-7 h-7" />,
    desc: '1分で40案も提案',
    metric: '40案',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/50',
  },
  { 
    id: 'competitor-analysis', 
    name: '広告分析', 
    icon: <BarChart3 className="w-7 h-7" />,
    desc: '5営業日を5分に激減',
    metric: '720x',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/50',
  },
  { 
    id: 'google-ad-title', 
    name: '広告文作成', 
    icon: <Target className="w-7 h-7" />,
    desc: 'Google/Facebook広告文',
    metric: '10案',
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    glow: 'shadow-pink-500/50',
  },
  { 
    id: 'newsletter', 
    name: 'メルマガ', 
    icon: <MessageSquare className="w-7 h-7" />,
    desc: '開封率UPのメール作成',
    metric: '+30%',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/50',
  },
  { 
    id: 'persona-creation', 
    name: '競合分析', 
    icon: <TrendingUp className="w-7 h-7" />,
    desc: '3C・SWOT分析',
    metric: 'Pro',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/50',
  },
]

// 課題セクション
const CHALLENGES = [
  { icon: <Users className="w-10 h-10" />, text: 'AI活用の経験者が少ない', sub: 'スキル不足' },
  { icon: <Zap className="w-10 h-10" />, text: 'AIのアウトプットがイマイチ', sub: '品質問題' },
  { icon: <MessageSquare className="w-10 h-10" />, text: 'プロンプトを使うのが難しい', sub: '操作性' },
]

// 効果セクション
const BENEFITS = [
  { 
    metric: '4時間→10分', 
    multiplier: '24x',
    title: 'LP構成案作成', 
    desc: 'プロのノウハウが詰まったシステムプロンプトで、現場でそのまま使えるアウトプット',
    icon: <FileText className="w-6 h-6" />,
  },
  { 
    metric: '40案/1分', 
    multiplier: '40+',
    title: 'バナーコピー案', 
    desc: '複数パターンを一度に生成。A/Bテストの効率も劇的にアップ',
    icon: <Lightbulb className="w-6 h-6" />,
  },
  { 
    metric: '5日→5分', 
    multiplier: '720x',
    title: '広告データ分析', 
    desc: 'データをアップロードするだけで、改善ポイントを自動抽出',
    icon: <BarChart3 className="w-6 h-6" />,
  },
]

// 特徴
const FEATURES = [
  { metric: '10,000+', title: 'システムプロンプト文字数', icon: <Brain className="w-8 h-8" /> },
  { metric: 'チャット型', title: 'ブラッシュアップ可能', icon: <MessageSquare className="w-8 h-8" /> },
  { metric: 'ブランド対応', title: '貴社仕様にカスタム', icon: <Target className="w-8 h-8" /> },
]

export default function KantanTopPage() {
  const { data: session } = useSession()
  const service = getServiceById('kantan')!
  const plan = (session?.user as any)?.kantanPlan || 'FREE'
  const isPro = plan === 'PRO'

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* アニメーションバックグラウンド */}
      <div className="fixed inset-0 pointer-events-none">
        {/* オーロラグラデーション */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-[800px] h-[800px] bg-gradient-to-br from-cyan-500/40 via-transparent to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-purple-500/30 via-transparent to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
          <div className="absolute bottom-0 left-1/2 w-[700px] h-[700px] bg-gradient-to-br from-emerald-500/25 via-transparent to-transparent rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
        </div>
        {/* グリッドパターン */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-white/40 hover:text-white/80 transition-all duration-300 flex items-center gap-1">
              <ChevronRight className="w-4 h-4 rotate-180" />
              ポータル
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-emerald-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <Rocket className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <span className="font-black text-xl tracking-tight bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">カンタンマーケAI</span>
                <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-medium">
                  <Cpu className="w-3 h-3" />
                  Gemini 3.0 Powered
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {session ? (
              <>
                {isPro && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 text-sm font-bold rounded-full">
                    <Crown className="w-4 h-4" />
                    PRO
                  </div>
                )}
                <Link href="/kantan/dashboard">
                  <button className="group relative px-6 py-3 overflow-hidden rounded-xl font-bold transition-all duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative flex items-center gap-2">
                      ダッシュボード
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </Link>
              </>
            ) : (
              <Link href="/auth/signin?service=kantan">
                <button className="group relative px-6 py-3 overflow-hidden rounded-xl font-bold transition-all duration-300">
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    はじめる
                  </span>
                </button>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="relative pt-20 pb-32 px-6">
        <div className="max-w-6xl mx-auto">
          {/* バッジ */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-full blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 backdrop-blur-xl border border-white/10 text-white rounded-full text-sm font-medium hover:bg-white/10 transition-all cursor-default">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                もう、プロンプトに悩まない
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-full text-xs font-bold">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Gemini 3.0 Flash</span>
            </div>
          </div>
          
          {/* メインコピー */}
          <div className="text-center mb-12">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 leading-[1.1] tracking-tight">
              <span className="block text-white/90">マーケターが求めた</span>
              <span className="block mt-2 bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                「使えるAI」
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-white/50 max-w-2xl mx-auto leading-relaxed font-light">
              LP構成案、バナーコピー、広告分析、メルマガ…<br />
              <span className="text-white/70">チャット形式のAIエージェント</span>が丸ごとサポート
            </p>
          </div>
          
          {/* CTAボタン */}
          <div className="flex flex-col items-center gap-6 mb-16">
            <Link href={session ? '/kantan/dashboard' : '/auth/signin?service=kantan'}>
              <button className="group relative px-12 py-5 overflow-hidden rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-500 to-teal-500 animate-gradient-x" />
                <div className="absolute inset-[2px] bg-[#0a0a0f] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-[2px] bg-gradient-to-r from-cyan-500/20 via-emerald-500/20 to-teal-500/20 rounded-2xl opacity-0 group-hover:opacity-100" />
                <span className="relative flex items-center gap-3 group-hover:text-cyan-400 transition-colors">
                  {session ? 'AIエージェントを使う' : '無料で試す'}
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
                </span>
              </button>
            </Link>
            <p className="text-white/30 text-sm">クレジットカード不要 • 今すぐ開始</p>
          </div>
          
          {/* 効果ハイライト */}
          <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
            {BENEFITS.map((benefit, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="relative text-center p-6 rounded-2xl border border-white/5 hover:border-white/10 transition-all duration-300">
                  <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                    {benefit.multiplier}
                  </div>
                  <div className="text-sm text-white/40">{benefit.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 課題セクション */}
      <section className="relative py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              生成AIを<span className="bg-gradient-to-r from-rose-400 to-orange-400 bg-clip-text text-transparent">「活用しきれていない」</span>と<br />
              感じていませんか？
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {CHALLENGES.map((challenge, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-orange-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl" />
                <div className="relative h-full p-8 rounded-3xl bg-white/[0.02] backdrop-blur-xl border border-white/5 hover:border-rose-500/30 transition-all duration-500">
                  <div className="text-rose-400 mb-4 transform group-hover:scale-110 transition-transform duration-300">{challenge.icon}</div>
                  <div className="text-xs text-rose-400/60 font-bold uppercase tracking-wider mb-2">{challenge.sub}</div>
                  <p className="text-white/70 text-lg font-medium">{challenge.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AIエージェント一覧 */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-full text-sm font-bold mb-6">
              <Cpu className="w-4 h-4" />
              AIエージェント
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              プロンプトは要らない。<br />
              <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">業務特化のチャット型AI</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              マーケティング業務に特化したAIエージェントが、チャット形式であなたをサポート
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {AI_AGENTS.map((agent, i) => (
              <Link key={agent.id} href={session ? `/kantan/dashboard/text/${agent.id}` : '/auth/signin?service=kantan'}>
                <div className="group relative h-full cursor-pointer">
                  {/* グロー効果 */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} rounded-3xl opacity-0 group-hover:opacity-20 blur-2xl transition-all duration-500`} />
                  
                  {/* カード */}
                  <div className="relative h-full p-6 rounded-3xl bg-white/[0.02] backdrop-blur-xl border border-white/5 group-hover:border-white/20 transition-all duration-500 overflow-hidden">
                    {/* 装飾 */}
                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${agent.gradient} opacity-10 blur-3xl group-hover:opacity-30 transition-opacity`} />
                    
                    <div className="relative">
                      {/* アイコン */}
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${agent.gradient} flex items-center justify-center text-white mb-5 shadow-lg ${agent.glow} group-hover:scale-110 transition-transform duration-300`}>
                        {agent.icon}
                      </div>
                      
                      {/* メトリック */}
                      <div className={`inline-flex px-2 py-1 rounded-md bg-gradient-to-r ${agent.gradient} bg-opacity-20 text-xs font-black mb-3`}>
                        {agent.metric}
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2">{agent.name}</h3>
                      <p className="text-white/40 text-sm mb-4">{agent.desc}</p>
                      
                      <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                        使ってみる
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link href={session ? '/kantan/dashboard' : '/auth/signin?service=kantan'}>
              <button className="group relative px-8 py-4 overflow-hidden rounded-xl font-bold transition-all duration-300 border border-white/10 hover:border-cyan-500/30">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-3 text-white/60 group-hover:text-white transition-colors">
                  68種類以上のAIエージェントを見る
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* 特徴セクション */}
      <section className="relative py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              現場でそのまま使える<br />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">プロ品質のアウトプット</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div key={i} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-xl" />
                <div className="relative h-full p-8 rounded-3xl bg-white/[0.02] backdrop-blur-xl border border-white/5 hover:border-cyan-500/30 transition-all duration-500 text-center">
                  <div className="text-cyan-400 mb-6 flex justify-center transform group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <div className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent mb-3">
                    {feature.metric}
                  </div>
                  <p className="text-white/60">{feature.title}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 導入効果セクション */}
      <section className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              AIエージェントで、<br />
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">現場はどう変わる？</span>
            </h2>
            <p className="text-white/40 text-lg">コスト・リードタイム大幅削減で、マーケ施策を高速で回せる</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* 左カード */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-2xl" />
              <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 backdrop-blur-xl border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-500">
                <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                    <Clock className="w-5 h-5" />
                  </div>
                  コスト・リードタイム削減
                </h3>
                <ul className="space-y-5">
                  {BENEFITS.map((benefit, i) => (
                    <li key={i} className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-cyan-400">
                        {benefit.icon}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-white">{benefit.title}</div>
                        <div className="text-sm text-white/40">{benefit.metric}</div>
                      </div>
                      <div className="text-2xl font-black text-cyan-400">{benefit.multiplier}</div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            
            {/* 右カード */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-500 blur-2xl" />
              <div className="relative h-full p-8 rounded-3xl bg-gradient-to-br from-violet-500/5 to-purple-500/5 backdrop-blur-xl border border-violet-500/20 hover:border-violet-500/40 transition-all duration-500">
                <h3 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  誰でも高品質アウトプット
                </h3>
                <ul className="space-y-4">
                  {[
                    'マーケター1人で制作・ライター業務も',
                    '専門知識がなくても高品質な構成案を作れる',
                    '少人数でも大量にコンテンツ制作可能',
                    '高速でPDCAを回せる',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-white/70">
                      <CheckCircle2 className="w-5 h-5 text-violet-400 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 料金セクション */}
      <section className="relative py-24 px-6">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/5 to-transparent" />
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-4">
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">シンプルな料金体系</span>
            </h2>
            <p className="text-white/40 text-lg">まずは無料でお試し。使い方に合わせてアップグレード。</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {KANTAN_PRICING.plans.map((plan, index) => (
              <div key={plan.id} className="group relative">
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <div className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white text-xs font-black rounded-full shadow-lg shadow-cyan-500/30">
                      POPULAR
                    </div>
                  </div>
                )}
                <div className={`relative h-full p-8 rounded-3xl backdrop-blur-xl transition-all duration-500 ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border-2 border-cyan-500/30 hover:border-cyan-500/50' 
                    : 'bg-white/[0.02] border border-white/5 hover:border-white/20'
                }`}>
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm text-white/40 mb-6">{plan.description}</p>
                  
                  <div className="mb-6">
                    <span className={`text-4xl font-black ${plan.popular ? 'text-cyan-400' : 'text-white'}`}>
                      {plan.priceLabel}
                    </span>
                    {plan.period && <span className="text-white/40 text-sm">{plan.period}</span>}
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    {plan.features.slice(0, 5).map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/60">
                        <CheckCircle2 className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.popular ? 'text-cyan-400' : 'text-white/30'}`} />
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                  
                  {plan.price === 0 ? (
                    <Link href="/kantan/dashboard" className="block">
                      <button className="w-full py-3 rounded-xl font-bold border border-white/10 hover:border-white/30 text-white/60 hover:text-white transition-all">
                        {plan.cta}
                      </button>
                    </Link>
                  ) : plan.priceLabel === '要相談' ? (
                    <a href="mailto:support@doya-ai.com?subject=カンタンマーケAI法人プランお問い合わせ" className="block">
                      <button className="w-full py-3 rounded-xl font-bold border border-white/10 hover:border-white/30 text-white/60 hover:text-white transition-all">
                        {plan.cta}
                      </button>
                    </a>
                  ) : (
                    <Link href="/kantan/pricing" className="block">
                      <button className={`w-full py-3 rounded-xl font-bold transition-all ${
                        plan.popular 
                          ? 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-lg shadow-cyan-500/25' 
                          : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white'
                      }`}>
                        {plan.cta}
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA セクション */}
      <section className="relative py-32 px-6">
        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative">
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            あなたのチームに、<br />
            <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">最強のAIエージェント</span>を。
          </h2>
          
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {['人手が足りていない', '現場がAIを使いこなせない', 'AIエージェント化を知りたい'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full text-white/60 text-sm">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                {item}
              </div>
            ))}
          </div>
          
          <Link href={session ? '/kantan/dashboard' : '/auth/signin?service=kantan'}>
            <button className="group relative px-14 py-6 overflow-hidden rounded-2xl font-black text-xl transition-all duration-500 hover:scale-105">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-500 to-teal-500" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-emerald-400 to-teal-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-3">
                {session ? 'AIエージェントを使う' : '無料で始める'}
                <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform duration-300" />
              </span>
            </button>
          </Link>
        </div>
      </section>

      {/* 他サービス */}
      <section className="relative py-16 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-center text-white/40 text-sm font-bold uppercase tracking-wider mb-8">専門AIツール</h3>
          
          <div className="grid md:grid-cols-2 gap-4">
            <Link href="/banner">
              <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all duration-500 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">ドヤバナーAI</h4>
                    <p className="text-sm text-white/40">A/B/Cの3案を同時に作成</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
            
            <Link href="/seo">
              <div className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-slate-500/30 transition-all duration-500 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/20 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">ドヤSEO</h4>
                    <p className="text-sm text-white/40">5万字超の長文記事も安定生成</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/30">
            <Link href="/" className="hover:text-white/60 transition-colors">ポータル</Link>
            <span className="text-white/10">•</span>
            <Link href="/banner" className="hover:text-purple-400 transition-colors">ドヤバナーAI</Link>
            <span className="text-white/10">•</span>
            <Link href="/seo" className="hover:text-white/60 transition-colors">ドヤSEO</Link>
            <span className="text-white/10">•</span>
            <Link href="/kantan/pricing" className="hover:text-white/60 transition-colors">料金</Link>
            <span className="text-white/10">•</span>
            <Link href="/admin" className="hover:text-white/60 transition-colors">管理画面</Link>
          </div>
          <p className="text-center text-xs text-white/20 mt-8">
            © 2025 ドヤAI. All rights reserved.
          </p>
        </div>
      </footer>

      {/* CSSアニメーション */}
      <style jsx>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  )
}
