'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { 
  ArrowRight, Sparkles, LogIn, 
  FileText, Lightbulb, BarChart3, Target, MessageSquare, 
  TrendingUp, Users, PenTool, Mail, Search, Megaphone,
  Layers, Briefcase, Palette, Globe, Zap, Cpu, Rocket,
  ChevronRight, Star, Clock, Activity, Home, Settings,
  Bell, HelpCircle, ChevronDown, Calendar, DollarSign,
  Timer, CheckCircle2, ArrowUpRight, MoreHorizontal, Database,
  UserCircle, ChevronLeft, Menu, X
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// サイドバーメニュー
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard', active: true },
  { id: 'notifications', label: 'お知らせ', icon: <Bell className="w-5 h-5" />, href: '#', badge: 3 },
  { id: 'mail', label: 'メール', icon: <Mail className="w-5 h-5" />, href: '#' },
  { id: 'calendar', label: 'カレンダー', icon: <Calendar className="w-5 h-5" />, href: '#' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'plan', label: 'サービスプラン', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/plan' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'analytics', label: 'アナリティクス', icon: <TrendingUp className="w-5 h-5" />, href: '#' },
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
]

// 統計カードデータ
const STATS_CARDS = [
  { 
    id: 'customers', 
    label: '生成回数', 
    value: '1,248', 
    icon: <Users className="w-6 h-6" />,
    color: 'bg-blue-500',
  },
  { 
    id: 'projects', 
    label: '進行中の案件数', 
    value: '754', 
    icon: <Briefcase className="w-6 h-6" />,
    color: 'bg-orange-500',
  },
  { 
    id: 'revenue', 
    label: '月間削減額', 
    value: '¥98,760', 
    icon: <DollarSign className="w-6 h-6" />,
    color: 'bg-yellow-500',
  },
]

// 月間グラフデータ
const CHART_DATA = [
  { day: '1', sales: 45, cost: 52 },
  { day: '2', sales: 38, cost: 48 },
  { day: '3', sales: 42, cost: 45 },
  { day: '4', sales: 35, cost: 38 },
  { day: '5', sales: 48, cost: 42 },
  { day: '6', sales: 52, cost: 55 },
  { day: '7', sales: 38, cost: 45 },
  { day: '8', sales: 42, cost: 38 },
  { day: '9', sales: 55, cost: 48 },
  { day: '10', sales: 62, cost: 52 },
  { day: '11', sales: 48, cost: 55 },
  { day: '12', sales: 72, cost: 58 },
  { day: '13', sales: 78, cost: 62 },
  { day: '14', sales: 65, cost: 55 },
  { day: '15', sales: 22, cost: 35 },
  { day: '16', sales: 58, cost: 48 },
  { day: '17', sales: 72, cost: 55 },
  { day: '18', sales: 68, cost: 58 },
  { day: '19', sales: 55, cost: 52 },
  { day: '20', sales: 62, cost: 55 },
  { day: '21', sales: 58, cost: 48 },
  { day: '22', sales: 65, cost: 52 },
  { day: '23', sales: 48, cost: 45 },
  { day: '24', sales: 52, cost: 48 },
]

// 顧客情報データ
const CUSTOMER_DATA = [
  { id: 1, name: '株式会社テーマミュ...', industry: 'Webデザイン', location: '東京', status: 'Active' },
  { id: 2, name: '株式会社スマートリ...', industry: 'Webデザイン', location: '京都', status: 'Active' },
  { id: 3, name: '株式会社セダールン...', industry: '運送', location: '神奈川', status: 'Active' },
]

// カレンダーデータ
const CALENDAR_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CALENDAR_DATES = [
  [31, 1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12, 13],
  [14, 15, 16, 17, 18, 19, 20],
]

export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const isGuest = !session
  const userName = session?.user?.name || '田中 太郎'
  const userInitial = userName[0]?.toUpperCase() || 'T'

  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Rocket className="w-6 h-6 text-white" />
          </div>
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex">
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
            <span>ドヤSEO</span>
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
            
            <h1 className="text-lg lg:text-xl font-bold text-gray-800">ダッシュボード</h1>
            
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button className="hidden sm:block p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>
              
              <div className="hidden sm:flex items-center gap-3 pl-4 border-l border-gray-200">
                <div className="text-right hidden md:block">
                  <div className="text-sm font-medium text-gray-800">{userName}</div>
                  <div className="text-xs text-gray-400">Admin</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* コンテンツ */}
        <div className="p-4 lg:p-8">
          {/* 統計カード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {STATS_CARDS.map((card) => (
              <div key={card.id} className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3 lg:gap-4">
                  <div className={`w-12 h-12 lg:w-14 lg:h-14 ${card.color} rounded-xl flex items-center justify-center text-white`}>
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-xs lg:text-sm text-gray-500">{card.label}</p>
                    <p className="text-2xl lg:text-3xl font-bold text-gray-800">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* グラフセクション */}
          <div className="bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100 mb-6 lg:mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 lg:mb-6">
              <div>
                <h2 className="text-base lg:text-lg font-bold text-gray-800">売上と営業コストの推移</h2>
                <p className="text-2xl lg:text-4xl font-bold text-gray-900 mt-1 lg:mt-2">64,23%</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors self-start sm:self-auto">
                Month
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            
            {/* グラフエリア */}
            <div className="relative h-48 lg:h-64 overflow-x-auto">
              {/* Y軸ラベル */}
              <div className="absolute left-0 top-0 bottom-0 w-8 lg:w-12 flex flex-col justify-between text-[10px] lg:text-xs text-gray-400 py-2">
                <span>100%</span>
                <span>75%</span>
                <span>50%</span>
                <span>25%</span>
                <span>0%</span>
              </div>
              
              {/* グラフ本体 */}
              <div className="ml-8 lg:ml-12 h-full flex items-end gap-0.5 lg:gap-1 min-w-[400px] lg:min-w-0">
                {CHART_DATA.map((data, index) => (
                  <div key={index} className="flex-1 flex gap-0.5 items-end h-full">
                    <div 
                      className="flex-1 bg-yellow-400 rounded-t transition-all hover:bg-yellow-500"
                      style={{ height: `${data.sales}%` }}
                    />
                    <div 
                      className="flex-1 bg-orange-500 rounded-t transition-all hover:bg-orange-600"
                      style={{ height: `${data.cost}%` }}
                    />
                  </div>
                ))}
              </div>
              
              {/* 点線グリッド */}
              <div className="absolute left-8 lg:left-12 right-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-t border-dashed border-gray-200" />
                ))}
              </div>
            </div>
          </div>

          {/* 下部セクション */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
            {/* 顧客情報テーブル */}
            <div className="lg:col-span-3 bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100 overflow-x-auto">
              <h2 className="text-base lg:text-lg font-bold text-gray-800 mb-4">顧客情報</h2>
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="text-left text-xs lg:text-sm text-gray-500 border-b border-gray-100">
                    <th className="pb-3 font-medium">
                      会社名 <ChevronDown className="inline w-3 h-3 ml-1" />
                    </th>
                    <th className="pb-3 font-medium hidden sm:table-cell">
                      業界 <ChevronDown className="inline w-3 h-3 ml-1" />
                    </th>
                    <th className="pb-3 font-medium">
                      Location <ChevronDown className="inline w-3 h-3 ml-1" />
                    </th>
                    <th className="pb-3 font-medium">
                      Status <ChevronDown className="inline w-3 h-3 ml-1" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {CUSTOMER_DATA.map((customer) => (
                    <tr key={customer.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 lg:py-4 text-xs lg:text-sm text-gray-800">{customer.name}</td>
                      <td className="py-3 lg:py-4 text-xs lg:text-sm text-gray-600 hidden sm:table-cell">{customer.industry}</td>
                      <td className="py-3 lg:py-4 text-xs lg:text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <span className="text-gray-400">📍</span>
                          {customer.location}
                        </span>
                      </td>
                      <td className="py-3 lg:py-4">
                        <span className="inline-flex items-center gap-1 lg:gap-1.5 px-2 lg:px-2.5 py-0.5 lg:py-1 bg-green-100 text-green-700 text-[10px] lg:text-xs font-medium rounded-full">
                          <span className="w-1 h-1 lg:w-1.5 lg:h-1.5 bg-green-500 rounded-full" />
                          {customer.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* カレンダー */}
            <div className="lg:col-span-2 bg-white rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base lg:text-lg font-bold text-gray-800">カレンダー</h2>
                <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-600">
                  <span>March 2025</span>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
              
              {/* 曜日ヘッダー */}
              <div className="grid grid-cols-7 gap-1 lg:gap-2 mb-2">
                {CALENDAR_DAYS.map((day) => (
                  <div key={day} className="text-center text-[10px] lg:text-xs text-gray-400 py-1 lg:py-2">
                    {day}
                  </div>
                ))}
              </div>
              
              {/* 日付グリッド */}
              {CALENDAR_DATES.map((week, weekIndex) => (
                <div key={weekIndex} className="grid grid-cols-7 gap-1 lg:gap-2 mb-1">
                  {week.map((date, dateIndex) => {
                    const isToday = date === 8
                    const isHighlight = date === 5 || date === 7 || date === 14 || date === 20
                    const isPrevMonth = weekIndex === 0 && date === 31
                    
                    return (
                      <button
                        key={dateIndex}
                        className={`
                          w-full aspect-square rounded-full flex items-center justify-center text-xs lg:text-sm transition-colors
                          ${isToday ? 'bg-blue-500 text-white font-bold' : ''}
                          ${isHighlight ? 'text-red-500 font-medium' : ''}
                          ${isPrevMonth ? 'text-gray-300' : 'text-gray-700'}
                          ${!isToday && !isPrevMonth ? 'hover:bg-gray-100' : ''}
                        `}
                      >
                        {date}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* ゲストバナー */}
          {isGuest && (
            <div className="mt-6 lg:mt-8 p-3 lg:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl lg:rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-blue-500 shrink-0" />
                  <p className="text-xs lg:text-sm text-gray-700">
                    🆓 お試しモード：残り <strong className="text-blue-600">{guestRemainingCount}回</strong>
                  </p>
                </div>
                <Link href="/auth/signin?service=kantan">
                  <button className="w-full sm:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors">
                    ログインで10回/日に！
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
