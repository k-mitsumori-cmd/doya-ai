'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { 
  ArrowRight, ArrowLeft, Sparkles, LogIn, 
  FileText, Lightbulb, BarChart3, Target, MessageSquare, 
  TrendingUp, Users, PenTool, Mail, Search, Megaphone,
  Layers, Briefcase, Palette, Globe, Zap, Cpu, Rocket,
  ChevronRight, Star, Clock, Activity
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// マーケティングAIエージェント一覧（全カテゴリ）
const MARKETING_AGENTS = [
  // LP・Web制作
  { 
    id: 'lp-full-text', 
    name: 'LP構成案・テキスト作成', 
    icon: <FileText className="w-6 h-6" />,
    desc: '4時間→10分で構成案完成',
    category: 'LP・Web',
    gradient: 'from-cyan-400 via-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/40',
    popular: true,
  },
  { 
    id: 'lp-headline', 
    name: 'LPキャッチコピー作成', 
    icon: <Sparkles className="w-6 h-6" />,
    desc: 'ファーストビュー用コピー10案',
    category: 'LP・Web',
    gradient: 'from-cyan-400 via-cyan-500 to-teal-500',
    glow: 'shadow-cyan-500/40',
  },
  
  // バナー・広告コピー
  { 
    id: 'banner-copy', 
    name: 'バナーコピー作成', 
    icon: <Lightbulb className="w-6 h-6" />,
    desc: '1分で40案を一気に生成',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
    popular: true,
  },
  { 
    id: 'google-ad-title', 
    name: 'Google広告タイトル作成', 
    icon: <Target className="w-6 h-6" />,
    desc: '高CTRタイトル10パターン',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },
  { 
    id: 'google-ad-description', 
    name: 'Google広告説明文作成', 
    icon: <Target className="w-6 h-6" />,
    desc: '90文字以内の説明文5案',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },
  { 
    id: 'facebook-ad-copy', 
    name: 'Facebook広告文作成', 
    icon: <Megaphone className="w-6 h-6" />,
    desc: 'FB広告用コピー3パターン',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },
  { 
    id: 'instagram-ad', 
    name: 'Instagram広告文作成', 
    icon: <Palette className="w-6 h-6" />,
    desc: 'キャプション+ハッシュタグ',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },
  { 
    id: 'twitter-ad', 
    name: 'Twitter/X広告文作成', 
    icon: <MessageSquare className="w-6 h-6" />,
    desc: '140文字ツイート5パターン',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },
  { 
    id: 'ab-test-copy', 
    name: 'A/Bテスト用コピー', 
    icon: <Layers className="w-6 h-6" />,
    desc: '5つのアプローチで比較',
    category: 'バナー・広告',
    gradient: 'from-amber-400 via-orange-500 to-red-500',
    glow: 'shadow-orange-500/40',
  },

  // 分析・リサーチ
  { 
    id: 'competitor-analysis', 
    name: '競合分析レポート', 
    icon: <BarChart3 className="w-6 h-6" />,
    desc: '競合の強み・弱みを整理',
    category: '分析',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/40',
    popular: true,
  },
  { 
    id: 'persona-creation', 
    name: 'ペルソナ作成', 
    icon: <Users className="w-6 h-6" />,
    desc: '詳細な顧客ペルソナを生成',
    category: '分析',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/40',
  },
  { 
    id: 'market-analysis', 
    name: '市場分析レポート', 
    icon: <TrendingUp className="w-6 h-6" />,
    desc: '市場規模・トレンド分析',
    category: '分析',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/40',
  },
  { 
    id: 'swot-analysis', 
    name: 'SWOT分析', 
    icon: <BarChart3 className="w-6 h-6" />,
    desc: '強み・弱み・機会・脅威',
    category: '分析',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/40',
  },
  { 
    id: 'user-journey', 
    name: 'カスタマージャーニー', 
    icon: <Users className="w-6 h-6" />,
    desc: '顧客体験を可視化',
    category: '分析',
    gradient: 'from-violet-400 via-purple-500 to-fuchsia-500',
    glow: 'shadow-purple-500/40',
  },

  // コンテンツ制作
  { 
    id: 'newsletter', 
    name: 'メルマガ作成', 
    icon: <Mail className="w-6 h-6" />,
    desc: '開封率UPのメール文面',
    category: 'コンテンツ',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/40',
    popular: true,
  },
  { 
    id: 'blog-article', 
    name: 'ブログ記事作成', 
    icon: <PenTool className="w-6 h-6" />,
    desc: 'SEOを意識した記事構成',
    category: 'コンテンツ',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/40',
  },
  { 
    id: 'article-outline', 
    name: '記事構成案作成', 
    icon: <FileText className="w-6 h-6" />,
    desc: '見出し構成を自動生成',
    category: 'コンテンツ',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/40',
  },
  { 
    id: 'seo-title-meta', 
    name: 'SEOタイトル・メタ作成', 
    icon: <Search className="w-6 h-6" />,
    desc: 'CTR向上のタイトル案',
    category: 'コンテンツ',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/40',
  },
  { 
    id: 'press-release', 
    name: 'プレスリリース作成', 
    icon: <Globe className="w-6 h-6" />,
    desc: 'PR TIMES形式で生成',
    category: 'コンテンツ',
    gradient: 'from-blue-400 via-indigo-500 to-violet-500',
    glow: 'shadow-indigo-500/40',
  },

  // SNS運用
  { 
    id: 'instagram-caption', 
    name: 'Instagram投稿文', 
    icon: <Palette className="w-6 h-6" />,
    desc: 'エンゲージUPキャプション',
    category: 'SNS',
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    glow: 'shadow-pink-500/40',
  },
  { 
    id: 'twitter-thread', 
    name: 'Twitter/Xスレッド', 
    icon: <MessageSquare className="w-6 h-6" />,
    desc: 'バズりやすいスレッド',
    category: 'SNS',
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    glow: 'shadow-pink-500/40',
  },
  { 
    id: 'linkedin-post', 
    name: 'LinkedIn投稿文', 
    icon: <Briefcase className="w-6 h-6" />,
    desc: 'ビジネス向け投稿',
    category: 'SNS',
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    glow: 'shadow-pink-500/40',
  },
  { 
    id: 'sns-content-calendar', 
    name: 'SNSコンテンツカレンダー', 
    icon: <Layers className="w-6 h-6" />,
    desc: '1ヶ月分の投稿計画',
    category: 'SNS',
    gradient: 'from-rose-400 via-pink-500 to-red-500',
    glow: 'shadow-pink-500/40',
  },

  // 営業・セールス
  { 
    id: 'sales-pitch', 
    name: 'セールスピッチ作成', 
    icon: <Zap className="w-6 h-6" />,
    desc: '商談で使えるピッチ',
    category: '営業',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/40',
  },
  { 
    id: 'product-description', 
    name: '商品説明文作成', 
    icon: <FileText className="w-6 h-6" />,
    desc: '魅力的な商品説明',
    category: '営業',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/40',
  },
  { 
    id: 'sales-email', 
    name: '営業メール作成', 
    icon: <Mail className="w-6 h-6" />,
    desc: '新規開拓・フォローアップ',
    category: '営業',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/40',
  },
  { 
    id: 'case-study', 
    name: '導入事例作成', 
    icon: <TrendingUp className="w-6 h-6" />,
    desc: '顧客成功事例を構成',
    category: '営業',
    gradient: 'from-emerald-400 via-green-500 to-teal-500',
    glow: 'shadow-emerald-500/40',
  },

  // クリエイティブ
  { 
    id: 'catchcopy', 
    name: 'キャッチコピー作成', 
    icon: <Sparkles className="w-6 h-6" />,
    desc: 'インパクト重視の10案',
    category: 'クリエイティブ',
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-500',
    glow: 'shadow-fuchsia-500/40',
  },
  { 
    id: 'naming', 
    name: 'ネーミング作成', 
    icon: <Lightbulb className="w-6 h-6" />,
    desc: '商品・サービス名20案',
    category: 'クリエイティブ',
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-500',
    glow: 'shadow-fuchsia-500/40',
  },
  { 
    id: 'slogan', 
    name: 'スローガン作成', 
    icon: <Megaphone className="w-6 h-6" />,
    desc: 'ブランドタグライン10案',
    category: 'クリエイティブ',
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-500',
    glow: 'shadow-fuchsia-500/40',
  },
  { 
    id: 'brand-story', 
    name: 'ブランドストーリー', 
    icon: <PenTool className="w-6 h-6" />,
    desc: '感情に訴えるストーリー',
    category: 'クリエイティブ',
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-500',
    glow: 'shadow-fuchsia-500/40',
  },
]

const CATEGORIES = [
  { id: 'すべて', icon: <Layers className="w-4 h-4" />, color: 'from-white/20 to-white/10' },
  { id: 'LP・Web', icon: <FileText className="w-4 h-4" />, color: 'from-cyan-500/30 to-teal-500/20' },
  { id: 'バナー・広告', icon: <Target className="w-4 h-4" />, color: 'from-orange-500/30 to-red-500/20' },
  { id: '分析', icon: <BarChart3 className="w-4 h-4" />, color: 'from-purple-500/30 to-fuchsia-500/20' },
  { id: 'コンテンツ', icon: <PenTool className="w-4 h-4" />, color: 'from-indigo-500/30 to-violet-500/20' },
  { id: 'SNS', icon: <MessageSquare className="w-4 h-4" />, color: 'from-pink-500/30 to-red-500/20' },
  { id: '営業', icon: <Briefcase className="w-4 h-4" />, color: 'from-emerald-500/30 to-teal-500/20' },
  { id: 'クリエイティブ', icon: <Sparkles className="w-4 h-4" />, color: 'from-fuchsia-500/30 to-violet-500/20' },
]

export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [selectedCategory, setSelectedCategory] = useState('すべて')
  const [searchQuery, setSearchQuery] = useState('')
  
  const isGuest = !session
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  // フィルター処理
  const filteredAgents = MARKETING_AGENTS.filter(agent => {
    const matchesCategory = selectedCategory === 'すべて' || agent.category === selectedCategory
    const matchesSearch = agent.name.includes(searchQuery) || agent.desc.includes(searchQuery)
    return matchesCategory && matchesSearch
  })

  // 人気エージェント
  const popularAgents = MARKETING_AGENTS.filter(a => a.popular)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-2xl blur-2xl opacity-50 animate-pulse" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-6">
              <Rocket className="w-10 h-10 text-white animate-bounce" />
            </div>
          </div>
          <p className="text-white/40 font-medium">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden">
      {/* アニメーション背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/30 via-transparent to-transparent rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/20 via-transparent to-transparent rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '3s' }} />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      {/* ヘッダー */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-all duration-300">
            <ChevronRight className="w-4 h-4 rotate-180" />
            <span className="text-sm font-medium">ポータル</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-xl blur opacity-50" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                <Rocket className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="font-black text-lg">カンタンマーケAI</span>
              <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-medium">
                <Cpu className="w-3 h-3" />
                Gemini 3.0
              </div>
            </div>
          </div>
          
          {session ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full text-xs text-white/60">
                <Activity className="w-3 h-3 text-emerald-400" />
                ログイン中
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 border border-cyan-500/30 flex items-center justify-center">
                <span className="text-cyan-400 text-sm font-bold">{userName[0]}</span>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin?service=kantan">
              <button className="group relative px-5 py-2.5 overflow-hidden rounded-full font-bold text-sm transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500" />
                <span className="relative flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  ログイン
                </span>
              </button>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-8 relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative p-6 bg-gradient-to-r from-cyan-500/10 to-emerald-500/10 backdrop-blur-xl border border-cyan-500/20 rounded-3xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center border border-cyan-500/20">
                    <Sparkles className="w-7 h-7 text-cyan-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full">FREE TRIAL</span>
                    </div>
                    <p className="text-white/60">
                      残り <span className="font-black text-2xl text-cyan-400 mx-1">{guestRemainingCount}</span> 
                      <span className="text-white/40 text-sm">/ {KANTAN_PRICING.guestLimit}回（1日）</span>
                    </p>
                  </div>
                </div>
                <Link href="/auth/signin?service=kantan">
                  <button className="group/btn relative px-6 py-3 overflow-hidden rounded-xl font-bold transition-all duration-300 hover:scale-105">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                    <span className="relative flex items-center gap-2">
                      <LogIn className="w-4 h-4" />
                      ログインで10回/日に！
                    </span>
                  </button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* タイトル */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-black mb-3">
            <span className="bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">AIエージェントを選択</span>
          </h1>
          <p className="text-white/40 text-lg">
            チャット形式でマーケティング業務を効率化
          </p>
        </div>

        {/* 人気エージェント */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">人気のエージェント</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularAgents.map((agent, i) => (
              <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`} className="group">
                <div className={`
                  relative h-full overflow-hidden rounded-2xl
                  transition-all duration-500
                  hover:scale-[1.02] hover:-translate-y-1
                  cursor-pointer
                `}>
                  {/* グロー */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} opacity-0 group-hover:opacity-30 blur-2xl transition-all duration-500`} />
                  
                  {/* カード */}
                  <div className={`relative h-full p-6 bg-gradient-to-br ${agent.gradient} rounded-2xl`}>
                    {/* 装飾 */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 bg-black/10 rounded-full blur-xl" />
                    
                    <div className="relative">
                      <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform duration-300">
                        {agent.icon}
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">{agent.name}</h3>
                      <p className="text-sm text-white/70">{agent.desc}</p>
                      
                      <div className="mt-4 flex items-center gap-2 text-white/80 text-sm font-medium opacity-0 group-hover:opacity-100 transition-all duration-300">
                        使う
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* 検索・フィルター */}
        <div className="mb-8 space-y-5">
          {/* 検索 */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="AIエージェントを検索..."
                className="w-full pl-14 pr-6 py-4 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl text-white placeholder-white/30 focus:border-cyan-500/30 focus:bg-white/[0.05] outline-none transition-all duration-300"
              />
            </div>
          </div>
          
          {/* カテゴリフィルター */}
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`group/cat relative px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {selectedCategory === category.id && (
                  <div className={`absolute inset-0 bg-gradient-to-r ${category.color} rounded-xl border border-white/10`} />
                )}
                <span className="relative flex items-center gap-2">
                  {category.icon}
                  {category.id}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* エージェント一覧 */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {filteredAgents.map((agent) => (
            <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`} className="group">
              <div className="relative h-full">
                {/* グロー */}
                <div className={`absolute inset-0 bg-gradient-to-br ${agent.gradient} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-all duration-500`} />
                
                {/* カード */}
                <div className="relative h-full p-5 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl hover:border-white/10 transition-all duration-300 overflow-hidden">
                  {/* 装飾 */}
                  <div className={`absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br ${agent.gradient} opacity-10 blur-2xl group-hover:opacity-30 transition-opacity`} />
                  
                  <div className="relative flex items-start gap-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${agent.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg ${agent.glow} group-hover:scale-110 transition-transform duration-300`}>
                      {agent.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white truncate mb-1">{agent.name}</h3>
                      <p className="text-sm text-white/40 mb-2">{agent.desc}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/5 text-white/30 text-xs rounded-full">
                        {agent.category}
                      </span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/30 text-lg">該当するAIエージェントが見つかりません</p>
          </div>
        )}

        {/* 使い方 */}
        <div className="relative mb-12">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-3xl blur-xl" />
          <div className="relative p-8 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-3xl">
            <div className="flex items-center justify-center gap-3 mb-8">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h2 className="text-xl font-bold">3ステップで完了</h2>
            </div>
            <div className="flex items-center justify-center gap-6 sm:gap-12">
              {[
                { step: '1', text: 'エージェントを選ぶ', icon: '👆', color: 'from-cyan-500 to-teal-500' },
                { step: '2', text: '情報を入力', icon: '✍️', color: 'from-purple-500 to-fuchsia-500' },
                { step: '3', text: 'チャットで磨く', icon: '💬', color: 'from-orange-500 to-red-500' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center group">
                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-3xl">{item.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-white/60">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 他サービス */}
        <div className="space-y-4">
          <h3 className="text-center text-white/30 text-sm font-bold uppercase tracking-wider mb-6">専門AIツール</h3>
          
          <Link href="/banner" className="block group">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-purple-500/20 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🎨</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Banner AI</p>
                    <h4 className="font-bold text-white text-lg">ドヤバナーAI</h4>
                    <p className="text-sm text-white/40">A/B/Cの3案を同時に作成</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-purple-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </Link>

          <Link href="/seo" className="block group">
            <div className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-500/20 to-gray-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-slate-500/20 transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center shadow-lg shadow-slate-500/20 group-hover:scale-110 transition-transform">
                    <span className="text-2xl">🧠</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">SEO AI</p>
                    <h4 className="font-bold text-white text-lg">ドヤSEO</h4>
                    <p className="text-sm text-white/40">5万字超の長文記事も安定生成</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/10 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* フッター */}
      <footer className="py-8 px-6 border-t border-white/5 mt-12">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-white/20">
          <Link href="/" className="hover:text-white/50 transition-colors">ドヤAI</Link>
          <div className="flex items-center gap-6">
            <Link href="/kantan/dashboard/history" className="hover:text-white/50 transition-colors">履歴</Link>
            <Link href="/kantan/pricing" className="hover:text-white/50 transition-colors">料金</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
