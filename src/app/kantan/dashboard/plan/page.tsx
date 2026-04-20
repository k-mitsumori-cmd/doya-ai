'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { 
  Star, TrendingUp, Users, CheckCircle2, Building2,
  Home, Cpu, Clock, Settings, HelpCircle, DollarSign,
  MessageSquare, Rocket, BarChart3, ArrowUpRight, Quote,
  Zap, Shield, RefreshCw, Database, Crown, Info, UserCircle,
  Menu, X
} from 'lucide-react'

// サイドバーメニュー - AIエージェント中心に再構成
const SIDEBAR_MENU = [
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'plan', label: 'プラン・料金', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/pricing', active: true },
]

// プラン特徴（詳細説明付き）
const PLAN_FEATURES = [
  { 
    text: '柔軟なAPI連携', 
    description: '外部ツール（Slack、Notion、スプレッドシートなど）との連携が可能。業務フローを自動化。',
    icon: <Zap className="w-4 h-4" />,
  },
  { 
    text: 'ユーザー数無制限（上位プラン）', 
    description: 'チームメンバー全員がアクセス可能。追加料金なしで組織全体で活用できます。',
    icon: <Users className="w-4 h-4" />,
  },
  { 
    text: '課金対象は「成果ベース」', 
    description: '実際に使用した分だけ課金。無駄なコストを削減し、ROIを最大化。',
    icon: <DollarSign className="w-4 h-4" />,
  },
  { 
    text: '契約縛りなし（いつでも変更可）', 
    description: 'プランのアップグレード・ダウングレードはいつでも可能。解約もペナルティなし。',
    icon: <RefreshCw className="w-4 h-4" />,
  },
  { 
    text: 'トライアル中のデータ引き継ぎOK', 
    description: '無料トライアル期間中に作成したデータは、有料プラン移行後もそのまま利用可能。',
    icon: <Shield className="w-4 h-4" />,
  },
]

// コスト指標（詳細説明付き）
const COST_METRICS = [
  { label: '初期費用', value: '0円', description: '導入時の設定費用、サポート費用は無料。' },
  { label: '月額基本料', value: '¥9,800〜', description: 'プランに応じた固定月額。Proプランは¥4,980/月。' },
  { label: '従量課金', value: '1アクション ¥0.5〜', description: 'AI生成1回あたりのコスト。大量利用でさらに割引。' },
  { label: '無料期間', value: '14日間', description: '全機能を14日間無料でお試し可能。クレジットカード不要。' },
  { label: '年間契約割引', value: '20% OFF', description: '年間契約で月額料金が20%割引になります。' },
]

// 導入ユーザーの声
const TESTIMONIALS = [
  {
    id: '1',
    quote: '属人化していた営業管理が、カンタンマーケ導入で一気に整いました。チームの動きが見えるようになって、業績も安定しています。',
    company: '広告代理店・営業部',
    time: '8ヶ月前',
    icon: <Building2 className="w-5 h-5" />,
    industry: '広告・マーケティング',
    teamSize: '50名',
    result: '営業効率 +40%',
  },
  {
    id: '2',
    quote: 'データ入力の手間が半分以下に！他ツールとの連携もスムーズで、顧客対応の質が上がりました。',
    company: 'SaaS企業・営業部',
    time: '2週間前',
    icon: <Building2 className="w-5 h-5" />,
    industry: 'IT・SaaS',
    teamSize: '30名',
    result: '作業時間 -55%',
  },
  {
    id: '3',
    quote: 'コストを抑えながら、成長に合わせて使えるのが魅力。スモールチームから始めて、今では社内全体に展開しています。',
    company: 'スタートアップ・代表',
    time: '1ヶ月前',
    icon: <Building2 className="w-5 h-5" />,
    industry: 'スタートアップ',
    teamSize: '15名 → 80名',
    result: 'スケールアップ成功',
  },
]

// 月間データ（グラフ用）
const MONTHLY_DATA = [
  { month: '7月', value: 35 },
  { month: '8月', value: 45 },
  { month: '9月', value: 55 },
  { month: '10月', value: 70 },
  { month: '11月', value: 85 },
  { month: '12月', value: 95 },
]

// ツールチップコンポーネント
function MenuTooltip({ item, show }: { item: typeof SIDEBAR_MENU[0]; show: boolean }) {
  if (!show || !item.description) return null
  
  return (
    <div className="absolute left-full top-0 ml-4 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 animate-fadeIn">
      {/* 矢印 */}
      <div className="absolute left-0 top-4 -translate-x-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-white" />
      
      {/* プレビュー画像風 */}
      {item.preview && (
        <div className={`h-24 rounded-xl bg-gradient-to-br ${item.preview.color} mb-4 p-4 flex flex-col justify-between`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white">
              {item.icon}
            </div>
            <span className="text-white font-bold text-sm">{item.label}</span>
          </div>
          <div className="flex gap-2">
            {item.preview.stats.slice(0, 2).map((stat, i) => (
              <span key={i} className="text-[10px] text-white/80 bg-white/20 px-2 py-0.5 rounded-full">
                {stat}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* 説明 */}
      <p className="text-sm text-gray-600 leading-relaxed mb-3">{item.description}</p>
      
      {/* 統計 */}
      {item.preview && (
        <div className="flex flex-wrap gap-2">
          {item.preview.stats.map((stat, i) => (
            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
              {stat}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// 特徴ツールチップコンポーネント
function FeatureTooltip({ feature, show }: { feature: typeof PLAN_FEATURES[0]; show: boolean }) {
  if (!show) return null
  
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-64 bg-gray-800 text-white rounded-xl shadow-2xl p-4 z-50 animate-fadeIn">
      {/* 矢印 */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-800" />
      
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
          {feature.icon}
        </div>
        <span className="font-bold text-sm">{feature.text}</span>
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{feature.description}</p>
    </div>
  )
}

// コスト指標ツールチップコンポーネント
function CostTooltip({ metric, show }: { metric: typeof COST_METRICS[0]; show: boolean }) {
  if (!show) return null
  
  return (
    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-56 bg-gray-800 text-white rounded-xl shadow-2xl p-4 z-50 animate-fadeIn">
      {/* 矢印 */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent border-r-gray-800" />
      
      <div className="flex items-center gap-2 mb-2">
        <span className="font-bold text-sm">{metric.label}</span>
        {metric.value && <span className="text-blue-400 font-bold">{metric.value}</span>}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed">{metric.description}</p>
    </div>
  )
}

// 導入事例ツールチップコンポーネント
function TestimonialTooltip({ testimonial, show }: { testimonial: typeof TESTIMONIALS[0]; show: boolean }) {
  if (!show) return null
  
  return (
    <div className="absolute right-full top-1/2 -translate-y-1/2 mr-4 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 animate-fadeIn">
      {/* 矢印 */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-0 h-0 border-t-8 border-b-8 border-l-8 border-transparent border-l-white" />
      
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500">
          {testimonial.icon}
        </div>
        <div>
          <div className="font-bold text-gray-800 text-sm">{testimonial.company}</div>
          <div className="text-xs text-gray-400">{testimonial.time}</div>
        </div>
      </div>
      
      {/* 詳細情報 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">業界</span>
          <span className="font-medium text-gray-800">{testimonial.industry}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">チーム規模</span>
          <span className="font-medium text-gray-800">{testimonial.teamSize}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">導入効果</span>
          <span className="font-bold text-emerald-600">{testimonial.result}</span>
        </div>
      </div>
    </div>
  )
}

export default function KantanPlanPage() {
  const { data: session, status } = useSession()
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null)
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)
  const [hoveredCost, setHoveredCost] = useState<number | null>(null)
  const [hoveredTestimonial, setHoveredTestimonial] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'
  const currentPlan = (session?.user as any)?.kantanPlan || 'FREE'

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
    <div className="min-h-screen bg-white flex">
      {/* モバイルオーバーレイ */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside className={`
        w-64 lg:w-52 bg-[#3B5998] text-white flex flex-col fixed h-full z-50
        transform transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* ロゴ */}
        <div className="p-5 flex items-center justify-between">
          <Link href="/kantan" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">カンタンマーケ</span>
          </Link>
          <button 
            className="lg:hidden p-1 hover:bg-white/10 rounded"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* メインメニュー */}
        <nav className="flex-1 px-3 overflow-y-auto">
          <ul className="space-y-1">
            {SIDEBAR_MENU.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                    item.active
                      ? 'bg-white/20 text-white font-medium'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
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
                    onClick={() => setIsMobileMenuOpen(false)}
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
          <Link href="/banner" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🎨</span>
            <span>ドヤバナーAI</span>
          </Link>
          <Link href="/seo" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70">
            <span>🧠</span>
            <span>ドヤライティングAI</span>
          </Link>
        </div>

        {/* ロゴマーク */}
        <div className="p-4 text-white/30 text-xs">
          @カンタンマーケAI
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 lg:ml-52">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4 lg:px-8 h-16 flex items-center justify-between">
            {/* モバイルメニューボタン */}
            <button 
              className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>
            
            <div className="hidden sm:block">
              <h1 className="text-lg lg:text-xl font-bold text-gray-800">サービスプラン</h1>
              <p className="text-xs text-gray-500 hidden lg:block">各項目にカーソルを当てると詳細が表示されます</p>
            </div>
            <h1 className="sm:hidden text-lg font-bold text-gray-800">サービスプラン</h1>
            
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>

              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-gray-800">{userName}</div>
                  <div className="text-xs text-gray-400">Admin</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                  {userInitial}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* コンテンツ */}
        <div className="p-4 lg:p-8 flex flex-col lg:flex-row gap-4 lg:gap-8">
          {/* 左側メイン */}
          <div className="flex-1">
            {/* プランカード */}
            <div className="bg-white rounded-xl lg:rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-6 mb-6 lg:mb-8">
              <div className="flex flex-col sm:flex-row gap-4 lg:gap-6">
                {/* 左：ミニダッシュボード風 */}
                <div className="w-full sm:w-48 bg-[#1e3a5f] rounded-lg lg:rounded-xl p-3 lg:p-4 text-white">
                  <div className="text-[10px] lg:text-xs text-white/60 mb-1 lg:mb-2">カンタンマーケ</div>
                  <div className="text-[8px] lg:text-[10px] text-white/40 mb-2 lg:mb-3">ダッシュボード</div>
                  {/* ミニ棒グラフ */}
                  <div className="flex items-end gap-0.5 lg:gap-1 h-12 lg:h-16 mb-2">
                    {MONTHLY_DATA.map((d, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-gradient-to-t from-cyan-400 to-blue-400 rounded-t transition-all hover:from-cyan-300 hover:to-blue-300"
                        style={{ height: `${d.value}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-0.5 lg:gap-1">
                    {['月', '火', '水', '木', '金', '土'].map((d, i) => (
                      <div key={i} className="flex-1 text-[6px] lg:text-[8px] text-white/40 text-center">{d}</div>
                    ))}
                  </div>
                </div>

                {/* 右：プラン情報 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 lg:mb-2">
                    <h2 className="text-sm lg:text-lg font-bold text-gray-800">スモールチーム向け〜エンタープライズ対応</h2>
                    <button className="text-gray-400 hover:text-gray-600 hidden sm:block">
                      <span className="text-lg">•••</span>
                    </button>
                  </div>
                  <div className="text-2xl lg:text-3xl font-black text-gray-900 mb-3 lg:mb-4">¥18,760</div>
                  
                  <button className="w-full sm:w-auto px-4 lg:px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors mb-3 lg:mb-4">
                    登録
                  </button>

                  <p className="text-xs lg:text-sm text-gray-500 mb-4 lg:mb-6">
                    成長フェーズやチーム規模に応じて柔軟に最適化。<br className="hidden lg:block" />
                    「使った分だけ」でも、「月額固定」でも、あなたのビジネスに合わせて設計可能です。
                  </p>

                  {/* 統計 */}
                  <div className="flex flex-wrap gap-3 lg:gap-8">
                    <div className="flex items-center gap-1 lg:gap-2">
                      <span className="text-xs lg:text-sm text-gray-500">満足度</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 lg:w-4 lg:h-4 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-gray-800 text-sm lg:text-base">4.9</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 lg:gap-2">
                      <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 text-emerald-500" />
                      <span className="font-bold text-gray-800 text-sm lg:text-base">1,456</span>
                      <span className="text-xs lg:text-sm text-gray-500">導入企業</span>
                    </div>
                    <div className="hidden lg:flex items-center gap-2">
                      <ArrowUpRight className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-gray-800">26%</span>
                      <span className="text-sm text-gray-500">利用成長率</span>
                      <div className="w-10 h-10 rounded-full border-4 border-amber-400 flex items-center justify-center text-xs font-bold text-gray-600">
                        50%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* プラン特徴 & コスト指標 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* プラン特徴 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-gray-800">プラン特徴</h3>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    ホバーで詳細
                  </span>
                </div>
                <ul className="space-y-3">
                  {PLAN_FEATURES.map((feature, i) => (
                    <li 
                      key={i} 
                      className="relative flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-blue-600 transition-colors"
                      onMouseEnter={() => setHoveredFeature(i)}
                      onMouseLeave={() => setHoveredFeature(null)}
                    >
                      <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      {feature.text}
                      
                      {/* ツールチップ */}
                      <FeatureTooltip feature={feature} show={hoveredFeature === i} />
                    </li>
                  ))}
                </ul>
              </div>

              {/* コスト指標 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-bold text-gray-800">コスト指標</h3>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    ホバーで詳細
                  </span>
                </div>
                <ul className="space-y-3">
                  {COST_METRICS.map((metric, i) => (
                    <li 
                      key={i} 
                      className="relative flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-blue-600 transition-colors"
                      onMouseEnter={() => setHoveredCost(i)}
                      onMouseLeave={() => setHoveredCost(null)}
                    >
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      <span>{metric.label}</span>
                      {metric.value && <span className="text-gray-800 font-medium">{metric.value}</span>}
                      
                      {/* ツールチップ */}
                      <CostTooltip metric={metric} show={hoveredCost === i} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 右側：導入ユーザーの声 */}
          <div className="w-80">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-bold text-gray-800">導入ユーザーの声</h3>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                ホバーで詳細
              </span>
            </div>
            <div className="space-y-4">
              {TESTIMONIALS.map((testimonial) => (
                <div 
                  key={testimonial.id} 
                  className="relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5 cursor-pointer hover:border-blue-200 hover:shadow-md transition-all"
                  onMouseEnter={() => setHoveredTestimonial(testimonial.id)}
                  onMouseLeave={() => setHoveredTestimonial(null)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <Quote className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                    <p className="text-sm text-gray-600 leading-relaxed">{testimonial.quote}</p>
                  </div>
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-500">
                      {testimonial.icon}
                    </div>
                    <div>
                      <div className="font-medium text-gray-800 text-sm">{testimonial.company}</div>
                      <div className="text-xs text-gray-400">{testimonial.time}</div>
                    </div>
                  </div>
                  
                  {/* ツールチップ */}
                  <TestimonialTooltip testimonial={testimonial} show={hoveredTestimonial === testimonial.id} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
