'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState } from 'react'
import { 
  Star, TrendingUp, Users, CheckCircle2, Building2,
  Home, Cpu, Clock, Settings, HelpCircle, DollarSign, Bell,
  MessageSquare, Rocket, BarChart3, ArrowUpRight, Quote,
  Zap, Shield, RefreshCw, Database, Crown
} from 'lucide-react'

// サイドバーメニュー
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'plan', label: 'サービスプラン', icon: <Crown className="w-5 h-5" />, href: '/kantan/dashboard/plan', active: true },
  { id: 'analytics', label: 'アナリティクス', icon: <BarChart3 className="w-5 h-5" />, href: '#', disabled: true },
]

const SIDEBAR_MENU_BOTTOM = [
  { id: 'settings', label: '設定', icon: <Settings className="w-5 h-5" />, href: '#', disabled: true },
  { id: 'help', label: 'ヘルプ', icon: <HelpCircle className="w-5 h-5" />, href: '#', disabled: true },
]

// プラン特徴
const PLAN_FEATURES = [
  '柔軟なAPI連携',
  'ユーザー数無制限（上位プラン）',
  '課金対象は「成果ベース」',
  '契約縛りなし（いつでも変更可）',
  'トライアル中のデータ引き継ぎOK',
]

// コスト指標
const COST_METRICS = [
  { label: '初期費用', value: '0円' },
  { label: '月額基本料', value: '¥9,800〜' },
  { label: '従量課金', value: '1アクション ¥0.5〜' },
  { label: '無料期間', value: '14日間' },
  { label: '年間契約で20%割引あり', value: '' },
]

// 導入ユーザーの声
const TESTIMONIALS = [
  {
    id: '1',
    quote: '属人化していた営業管理が、カンタンマーケ導入で一気に整いました。チームの動きが見えるようになって、業績も安定しています。',
    company: '広告代理店・営業部',
    time: '8月前',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: '2',
    quote: 'データ入力の手間が半分以下に！他ツールとの連携もスムーズで、顧客対応の質が上がりました。',
    company: 'SaaS企業・営業部',
    time: '2週間前',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    id: '3',
    quote: 'コストを抑えながら、成長に合わせて使えるのが魅力。スモールチームから始めて、今では社内全体に展開しています。',
    company: 'スタートアップ・代表',
    time: '1ヶ月前',
    icon: <Building2 className="w-5 h-5" />,
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

export default function KantanPlanPage() {
  const { data: session, status } = useSession()
  
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'
  const currentPlan = (session?.user as any)?.kantanPlan || 'FREE'

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
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
    <div className="min-h-screen bg-[#f8fafc] flex">
      {/* サイドバー */}
      <aside className="w-64 bg-[#1e3a5f] text-white flex flex-col fixed h-full z-40">
        {/* ロゴ */}
        <div className="p-5 border-b border-white/10">
          <Link href="/kantan" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg">カンタンマーケ</div>
              <div className="text-[10px] text-cyan-300 font-medium">Powered by Gemini 3.0</div>
            </div>
          </Link>
        </div>

        {/* メインメニュー */}
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {SIDEBAR_MENU.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.disabled ? '#' : item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    item.active
                      ? 'bg-white/10 text-white'
                      : item.disabled
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.disabled && (
                    <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 px-4">データベース</p>
            <ul className="space-y-1">
              <li>
                <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                  <BarChart3 className="w-5 h-5" />
                  <span className="font-medium">アナリティクス</span>
                </Link>
              </li>
              <li>
                <Link href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                  <Database className="w-5 h-5" />
                  <span className="font-medium">顧客情報</span>
                </Link>
              </li>
            </ul>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <ul className="space-y-1">
              {SIDEBAR_MENU_BOTTOM.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.disabled ? '#' : item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      item.disabled
                        ? 'text-white/30 cursor-not-allowed'
                        : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* フッター */}
        <div className="p-4 border-t border-white/10">
          <div className="text-xs text-white/30 text-center">@GORO</div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 ml-64">
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-8 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">サービスプラン</h1>
            </div>
            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right">
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
        <div className="p-8 flex gap-8">
          {/* 左側メイン */}
          <div className="flex-1">
            {/* プランカード */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
              <div className="flex gap-6">
                {/* 左：ミニダッシュボード風 */}
                <div className="w-48 bg-[#1e3a5f] rounded-xl p-4 text-white">
                  <div className="text-xs text-white/60 mb-2">カンタンマーケ</div>
                  <div className="text-[10px] text-white/40 mb-3">ダッシュボード</div>
                  {/* ミニ棒グラフ */}
                  <div className="flex items-end gap-1 h-16 mb-2">
                    {MONTHLY_DATA.map((d, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-gradient-to-t from-cyan-400 to-blue-400 rounded-t"
                        style={{ height: `${d.value}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {['月', '火', '水', '木', '金', '土'].map((d, i) => (
                      <div key={i} className="flex-1 text-[8px] text-white/40 text-center">{d}</div>
                    ))}
                  </div>
                </div>

                {/* 右：プラン情報 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-lg font-bold text-gray-800">スモールチーム向け〜エンタープライズ対応</h2>
                    <button className="text-gray-400 hover:text-gray-600">
                      <span className="text-lg">•••</span>
                    </button>
                  </div>
                  <div className="text-3xl font-black text-gray-900 mb-4">¥18,760</div>
                  
                  <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors mb-4">
                    登録
                  </button>

                  <p className="text-sm text-gray-500 mb-6">
                    成長フェーズやチーム規模に応じて柔軟に最適化。<br />
                    「使った分だけ」でも、「月額固定」でも、あなたのビジネスに合わせて設計可能です。
                  </p>

                  {/* 統計 */}
                  <div className="flex gap-8">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">ユーザー満足度</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                        <span className="font-bold text-gray-800">4.9</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      <span className="font-bold text-gray-800">1,456</span>
                      <span className="text-sm text-gray-500">導入企業数</span>
                    </div>
                    <div className="flex items-center gap-2">
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
                <h3 className="font-bold text-gray-800 mb-4">プラン特徴</h3>
                <ul className="space-y-3">
                  {PLAN_FEATURES.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* コスト指標 */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h3 className="font-bold text-gray-800 mb-4">コスト指標</h3>
                <ul className="space-y-3">
                  {COST_METRICS.map((metric, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      <span>{metric.label}</span>
                      {metric.value && <span className="text-gray-800 font-medium">{metric.value}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* 右側：導入ユーザーの声 */}
          <div className="w-80">
            <h3 className="font-bold text-gray-800 mb-4">導入ユーザーの声</h3>
            <div className="space-y-4">
              {TESTIMONIALS.map((testimonial) => (
                <div key={testimonial.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
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
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

