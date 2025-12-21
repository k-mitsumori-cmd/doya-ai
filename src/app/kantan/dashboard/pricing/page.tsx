'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { 
  Check, X, Star, Zap, Crown, Rocket, ArrowRight, Sparkles,
  Home, Cpu, Clock, Settings, HelpCircle, DollarSign, Bell,
  MessageSquare, BarChart3, ChevronRight, Shield, Users,
  TrendingUp, Gift, ArrowUpRight, CheckCircle2, Timer, Calendar,
  CreditCard, Receipt, AlertCircle, RefreshCw
} from 'lucide-react'
import { KANTAN_PRICING, getUserUsage, getGuestUsage } from '@/lib/pricing'

// サイドバーメニュー
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
  { id: 'notifications', label: 'お知らせ', icon: <Bell className="w-5 h-5" />, href: '#', badge: 3 },
  { id: 'mail', label: 'メール', icon: <Calendar className="w-5 h-5" />, href: '#' },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="w-5 h-5" />, href: '#' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'plan', label: 'サービスプラン', icon: <Users className="w-5 h-5" />, href: '/kantan/dashboard/plan' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'analytics', label: 'アナリティクス', icon: <TrendingUp className="w-5 h-5" />, href: '#' },
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
]

// プランのアイコン
const PLAN_ICONS: Record<string, React.ReactNode> = {
  'kantan-free': <Gift className="w-6 h-6" />,
  'kantan-pro': <Crown className="w-6 h-6" />,
  'kantan-enterprise': <Shield className="w-6 h-6" />,
}

// プランのカラー
const PLAN_COLORS: Record<string, { bg: string; border: string; text: string; gradient: string }> = {
  'kantan-free': {
    bg: 'bg-gray-100',
    border: 'border-gray-200',
    text: 'text-gray-600',
    gradient: 'from-gray-400 to-gray-500',
  },
  'kantan-pro': {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-600',
    gradient: 'from-emerald-400 to-teal-500',
  },
  'kantan-enterprise': {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    gradient: 'from-slate-400 to-gray-500',
  },
}

// アップグレードのメリット
const UPGRADE_BENEFITS = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: '1日100回まで生成',
    description: '無料版の10倍。思う存分AIエージェントを活用',
  },
  {
    icon: <Cpu className="w-5 h-5" />,
    title: '全AIエージェント利用可能',
    description: '68種類以上のマーケティング特化AIを解放',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    title: '広告データ分析',
    description: '運用データをAIが分析し改善提案',
  },
  {
    icon: <Clock className="w-5 h-5" />,
    title: '履歴保存（無制限）',
    description: '過去の生成結果をいつでも参照可能',
  },
]

// FAQ
const PRICING_FAQ = [
  {
    question: 'プランはいつでも変更できますか？',
    answer: 'はい、いつでもアップグレード・ダウングレードが可能です。アップグレードは即時反映、ダウングレードは次回更新日から適用されます。',
  },
  {
    question: '支払い方法は？',
    answer: 'クレジットカード（Visa, Mastercard, JCB, AMEX）に対応しています。法人プランでは請求書払いも可能です。',
  },
  {
    question: '無料トライアルはありますか？',
    answer: 'ログインなしでも1日3回、ログイン後は1日10回まで無料でお試しいただけます。クレジットカード不要です。',
  },
  {
    question: '解約時のペナルティは？',
    answer: 'ありません。いつでも解約可能で、月末まではサービスをご利用いただけます。',
  },
]

export default function KantanPricingPage() {
  const { data: session, status } = useSession()
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')
  const [todayUsage, setTodayUsage] = useState(0)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'
  const currentPlanId = (session?.user as any)?.kantanPlan?.toLowerCase() === 'pro' ? 'kantan-pro' : 'kantan-free'
  const isLoggedIn = !!session
  const isPro = currentPlanId === 'kantan-pro'

  // 今日の使用状況を取得
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const usage = isLoggedIn ? getUserUsage('kantan') : getGuestUsage('kantan')
      const today = new Date().toISOString().split('T')[0]
      if (usage.date === today) {
        setTodayUsage(usage.count)
      }
    }
  }, [isLoggedIn])

  // 現在のプラン情報
  const currentPlan = KANTAN_PRICING.plans.find(p => p.id === currentPlanId)
  const dailyLimit = isLoggedIn 
    ? (isPro ? KANTAN_PRICING.proLimit : KANTAN_PRICING.freeLimit)
    : KANTAN_PRICING.guestLimit
  const remainingToday = Math.max(0, dailyLimit - todayUsage)
  const usagePercent = Math.min(100, (todayUsage / dailyLimit) * 100)

  // 年間割引価格
  const getAnnualPrice = (monthlyPrice: number) => Math.floor(monthlyPrice * 12 * 0.8)
  const getAnnualMonthlyPrice = (monthlyPrice: number) => Math.floor(monthlyPrice * 0.8)

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* サイドバー */}
      <aside className="w-52 bg-[#3B5998] text-white flex flex-col fixed h-full z-40">
        {/* ロゴ */}
        <div className="p-5">
          <Link href="/kantan" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">カンタンマーケ</span>
          </Link>
        </div>

        {/* メインメニュー */}
        <nav className="flex-1 px-3">
          <ul className="space-y-1">
            {SIDEBAR_MENU.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm"
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* データベースセクション */}
          <div className="mt-6">
            <p className="px-3 text-xs text-white/50 uppercase tracking-wider mb-2">データベース</p>
            <ul className="space-y-1">
              {SIDEBAR_DATA_MENU.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all text-sm"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 他サービス */}
        <div className="p-3 border-t border-white/10">
          <Link href="/banner" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🎨</span>
            <span>ドヤバナーAI</span>
          </Link>
          <Link href="/seo" className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🧠</span>
            <span>ドヤSEO</span>
          </Link>
        </div>

        {/* ロゴマーク */}
        <div className="p-4 text-white/30 text-xs">
          @カンタンマーケAI
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 ml-52">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-8 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">料金プラン</h1>
              <p className="text-xs text-gray-500">現在のプランと利用状況を確認</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-800">{userName}</div>
                  <div className="text-xs text-gray-400">{isPro ? 'Proプラン' : isLoggedIn ? 'Freeプラン' : 'ゲスト'}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {userInitial}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* コンテンツ */}
        <div className="p-8">
          {/* 現在のプラン */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-500" />
              現在のプラン
            </h2>
            
            <div className={`bg-white rounded-2xl border-2 ${PLAN_COLORS[currentPlanId]?.border || 'border-gray-200'} shadow-sm p-6`}>
              <div className="flex items-start justify-between flex-wrap gap-4">
                {/* プラン情報 */}
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${PLAN_COLORS[currentPlanId]?.gradient || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white`}>
                    {PLAN_ICONS[currentPlanId]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-bold text-gray-800">{currentPlan?.name || '無料'}プラン</h3>
                      {isPro && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-xs font-bold rounded-full">
                          アクティブ
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{currentPlan?.description}</p>
                    {isPro && (
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        次回更新日: 2025年1月21日
                      </p>
                    )}
                  </div>
                </div>

                {/* 利用状況 */}
                <div className="flex-shrink-0">
                  <div className="text-right mb-2">
                    <span className="text-2xl font-black text-gray-800">{todayUsage}</span>
                    <span className="text-gray-400 text-sm"> / {dailyLimit}回</span>
                    <p className="text-xs text-gray-400">本日の使用</p>
                  </div>
                  <div className="w-48 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        usagePercent >= 90 ? 'bg-red-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    残り {remainingToday}回
                  </p>
                </div>
              </div>

              {/* アップグレード提案（無料プランの場合） */}
              {!isPro && isLoggedIn && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">プロプランにアップグレードしませんか？</p>
                        <p className="text-sm text-gray-500">1日100回まで生成、全機能解放</p>
                      </div>
                    </div>
                    <a 
                      href="#plans" 
                      className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                    >
                      <Crown className="w-5 h-5" />
                      アップグレード
                    </a>
                  </div>
                </div>
              )}

              {/* ログイン提案（ゲストの場合） */}
              {!isLoggedIn && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">ログインで1日10回まで無料！</p>
                        <p className="text-sm text-gray-500">Googleアカウントで簡単ログイン</p>
                      </div>
                    </div>
                    <Link 
                      href="/auth/signin?service=kantan"
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                      無料でログイン
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 請求情報（Proプランの場合） */}
          {isPro && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-500" />
                請求情報
              </h2>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">月額料金</p>
                    <p className="text-2xl font-black text-gray-800">¥4,980</p>
                    <p className="text-xs text-gray-400">税込</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">支払い方法</p>
                    <p className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-gray-400" />
                      **** 1234
                    </p>
                    <p className="text-xs text-gray-400">VISA</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">次回請求日</p>
                    <p className="text-lg font-bold text-gray-800">2025年1月21日</p>
                    <p className="text-xs text-gray-400">自動更新</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
                  <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm">
                    支払い方法を変更
                  </button>
                  <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors text-sm">
                    請求履歴を見る
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 料金プラン比較 */}
          <div id="plans" className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                料金プラン
              </h2>
              
              {/* 月額/年額切り替え */}
              <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    billingCycle === 'monthly' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  月額
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    billingCycle === 'annual' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  年額
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-bold rounded">20%OFF</span>
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {KANTAN_PRICING.plans.map((plan) => {
                const isCurrentPlan = plan.id === currentPlanId
                const colors = PLAN_COLORS[plan.id] || PLAN_COLORS['kantan-free']
                const displayPrice = billingCycle === 'annual' && plan.price > 0 
                  ? getAnnualMonthlyPrice(plan.price) 
                  : plan.price
                
                return (
                  <div 
                    key={plan.id}
                    className={`bg-white rounded-2xl border-2 ${
                      isCurrentPlan ? colors.border : 'border-gray-100'
                    } shadow-sm p-6 relative ${plan.popular ? 'ring-2 ring-emerald-500 ring-offset-2' : ''}`}
                  >
                    {/* 現在のプランバッジ */}
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className={`px-3 py-1 ${colors.bg} ${colors.text} text-xs font-bold rounded-full border ${colors.border}`}>
                          現在のプラン
                        </span>
                      </div>
                    )}
                    
                    {/* 人気バッジ */}
                    {plan.popular && !isCurrentPlan && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                          人気
                        </span>
                      </div>
                    )}

                    {/* プラン名 */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors.gradient} flex items-center justify-center text-white`}>
                        {PLAN_ICONS[plan.id]}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                        <p className="text-xs text-gray-500">{plan.description}</p>
                      </div>
                    </div>

                    {/* 価格 */}
                    <div className="mb-6">
                      {plan.price > 0 ? (
                        <>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-black text-gray-800">¥{displayPrice.toLocaleString()}</span>
                            <span className="text-gray-500 text-sm">/月</span>
                          </div>
                          {billingCycle === 'annual' && (
                            <p className="text-xs text-emerald-600 mt-1">
                              年額 ¥{getAnnualPrice(plan.price).toLocaleString()} （¥{(plan.price * 12 - getAnnualPrice(plan.price)).toLocaleString()} お得）
                            </p>
                          )}
                        </>
                      ) : plan.priceLabel === '要相談' ? (
                        <div className="text-3xl font-black text-gray-800">要相談</div>
                      ) : (
                        <div className="text-3xl font-black text-gray-800">無料</div>
                      )}
                    </div>

                    {/* 機能一覧 */}
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          {feature.included ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span className={feature.included ? 'text-gray-700 text-sm' : 'text-gray-400 text-sm'}>
                            {feature.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    {isCurrentPlan ? (
                      <button 
                        disabled
                        className="w-full py-3 bg-gray-100 text-gray-400 font-bold rounded-xl cursor-not-allowed"
                      >
                        現在のプラン
                      </button>
                    ) : plan.id === 'kantan-pro' ? (
                      <button className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20">
                        {plan.cta}
                      </button>
                    ) : plan.id === 'kantan-enterprise' ? (
                      <button className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all">
                        {plan.cta}
                      </button>
                    ) : (
                      <button className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all">
                        {plan.cta}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* アップグレードのメリット（無料プランの場合） */}
          {!isPro && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                プロプランにするとできること
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {UPGRADE_BENEFITS.map((benefit, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                      {benefit.icon}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{benefit.title}</h4>
                      <p className="text-sm text-gray-500 mt-1">{benefit.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAQ */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-500" />
              よくある質問
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {PRICING_FAQ.map((faq, i) => (
                <div key={i} className="border-b border-gray-100 last:border-b-0">
                  <button
                    onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                    className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-800">{faq.question}</span>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  {expandedFaq === i && (
                    <div className="px-6 pb-4 text-sm text-gray-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 解約について */}
          {isPro && (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">プランの解約について</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    解約はいつでも可能です。解約後も次回更新日まではプロプランの機能をご利用いただけます。
                  </p>
                  <button className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors">
                    プランを解約する
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

