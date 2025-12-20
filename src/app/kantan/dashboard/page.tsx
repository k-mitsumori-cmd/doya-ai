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
  Timer, CheckCircle2, ArrowUpRight, MoreHorizontal
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// サイドバーメニュー
const SIDEBAR_MENU = [
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'analytics', label: 'アナリティクス', icon: <BarChart3 className="w-5 h-5" />, href: '#', disabled: true },
]

const SIDEBAR_MENU_BOTTOM = [
  { id: 'pricing', label: '料金プラン', icon: <DollarSign className="w-5 h-5" />, href: '/kantan/pricing' },
  { id: 'settings', label: '設定', icon: <Settings className="w-5 h-5" />, href: '#', disabled: true },
  { id: 'help', label: 'ヘルプ', icon: <HelpCircle className="w-5 h-5" />, href: '#', disabled: true },
]

// 人気AIエージェント
const POPULAR_AGENTS = [
  { id: 'lp-full-text', name: 'LP構成案', icon: <FileText className="w-5 h-5" />, color: 'bg-cyan-500', timeSaved: '3.8時間' },
  { id: 'banner-copy', name: 'バナーコピー', icon: <Lightbulb className="w-5 h-5" />, color: 'bg-orange-500', timeSaved: '40分' },
  { id: 'competitor-analysis', name: '競合分析', icon: <BarChart3 className="w-5 h-5" />, color: 'bg-purple-500', timeSaved: '4.9日' },
  { id: 'newsletter', name: 'メルマガ', icon: <Mail className="w-5 h-5" />, color: 'bg-blue-500', timeSaved: '1.5時間' },
  { id: 'google-ad-title', name: '広告文作成', icon: <Target className="w-5 h-5" />, color: 'bg-pink-500', timeSaved: '2時間' },
  { id: 'persona-creation', name: 'ペルソナ作成', icon: <Users className="w-5 h-5" />, color: 'bg-emerald-500', timeSaved: '3時間' },
]

// 最近の生成履歴（ダミーデータ）
const RECENT_HISTORY = [
  { id: '1', agent: 'LP構成案', title: 'SaaSプロダクトのLP', time: '2時間前', status: 'completed' },
  { id: '2', agent: 'バナーコピー', title: '夏キャンペーン用バナー', time: '5時間前', status: 'completed' },
  { id: '3', agent: '競合分析', title: '競合3社の比較レポート', time: '1日前', status: 'completed' },
  { id: '4', agent: 'メルマガ', title: '新機能リリースのお知らせ', time: '2日前', status: 'completed' },
]

// 月間グラフデータ（ダミー）
const MONTHLY_DATA = [
  { month: '7月', value: 45 },
  { month: '8月', value: 62 },
  { month: '9月', value: 38 },
  { month: '10月', value: 78 },
  { month: '11月', value: 55 },
  { month: '12月', value: 92 },
]

export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  
  const isGuest = !session
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'G'

  // 統計データ（実際にはAPIから取得）
  const stats = {
    totalGenerations: session ? 47 : 2,
    timeSaved: session ? '28.5時間' : '0.5時間',
    costSaved: session ? '¥142,500' : '¥2,500',
    thisMonth: session ? 12 : 2,
  }

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

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
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-[#1e3a5f] text-white flex flex-col transition-all duration-300 fixed h-full z-40`}>
        {/* ロゴ */}
        <div className="p-5 border-b border-white/10">
          <Link href="/kantan" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <div className="font-bold text-lg">カンタンマーケ</div>
                <div className="text-[10px] text-cyan-300 font-medium">Powered by Gemini 3.0</div>
              </div>
            )}
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
                    item.id === 'dashboard'
                      ? 'bg-white/10 text-white'
                      : item.disabled
                      ? 'text-white/30 cursor-not-allowed'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
                  {item.disabled && !sidebarCollapsed && (
                    <span className="ml-auto text-[10px] bg-white/10 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className={`text-xs text-white/40 uppercase tracking-wider mb-3 ${sidebarCollapsed ? 'text-center' : 'px-4'}`}>
              {sidebarCollapsed ? '...' : 'その他'}
            </p>
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
                    {!sidebarCollapsed && <span className="font-medium">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* 他サービスへのリンク */}
        {!sidebarCollapsed && (
          <div className="p-4 border-t border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3 px-2">他のAIツール</p>
            <div className="space-y-2">
              <Link href="/banner" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors">
                <span className="text-lg">🎨</span>
                <span className="text-sm text-white/80">ドヤバナーAI</span>
              </Link>
              <Link href="/seo" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 transition-colors">
                <span className="text-lg">🧠</span>
                <span className="text-sm text-white/80">ドヤSEO</span>
              </Link>
            </div>
          </div>
        )}
      </aside>

      {/* メインコンテンツ */}
      <main className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300`}>
        {/* ヘッダー */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-8 h-16 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">ダッシュボード</h1>
            </div>
            <div className="flex items-center gap-4">
              {/* 通知 */}
              <button className="relative p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>
              
              {/* 設定 */}
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <Settings className="w-5 h-5" />
              </button>

              {/* ユーザー */}
              {session ? (
                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-800">{userName}</div>
                    <div className="text-xs text-gray-400">
                      {(session?.user as any)?.kantanPlan === 'PRO' ? 'Proプラン' : 'Freeプラン'}
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold">
                    {userInitial}
                  </div>
                </div>
              ) : (
                <Link href="/auth/signin?service=kantan">
                  <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors">
                    <LogIn className="w-4 h-4" />
                    ログイン
                  </button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* コンテンツ */}
        <div className="p-8">
          {/* ゲストバナー */}
          {isGuest && (
            <div className="mb-8 p-5 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">🆓 お試しモード</p>
                    <p className="text-sm text-gray-600">
                      残り <span className="font-bold text-blue-600">{guestRemainingCount}回</span>（1日{KANTAN_PRICING.guestLimit}回まで）
                    </p>
                  </div>
                </div>
                <Link href="/auth/signin?service=kantan">
                  <button className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    ログインで10回/日に！
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* 統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">生成回数</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.totalGenerations}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Timer className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">削減できた時間</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.timeSaved}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">コスト削減額</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.costSaved}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">今月の生成</p>
                  <p className="text-2xl font-bold text-gray-800">{stats.thisMonth}回</p>
                </div>
              </div>
            </div>
          </div>

          {/* グラフと履歴 */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* グラフ */}
            <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">月間利用状況</h2>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600 transition-colors">
                  月間
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
              
              {/* シンプルな棒グラフ */}
              <div className="flex items-end gap-4 h-48">
                {MONTHLY_DATA.map((data, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div 
                      className="w-full bg-gradient-to-t from-blue-500 to-cyan-400 rounded-t-lg transition-all hover:from-blue-600 hover:to-cyan-500"
                      style={{ height: `${data.value}%` }}
                    />
                    <span className="text-xs text-gray-500">{data.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 最近の履歴 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-gray-800">最近の生成</h2>
                <Link href="/kantan/dashboard/history" className="text-sm text-blue-500 hover:text-blue-600">
                  すべて見る
                </Link>
              </div>
              
              <div className="space-y-4">
                {RECENT_HISTORY.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.agent} • {item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AIエージェント一覧 */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-800">AIエージェント</h2>
                <p className="text-sm text-gray-500">使いたいエージェントを選んでください</p>
              </div>
              <Link href="/kantan/dashboard/text">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl transition-colors">
                  すべて見る
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {POPULAR_AGENTS.map((agent) => (
                <Link key={agent.id} href={`/kantan/dashboard/text/${agent.id}`}>
                  <div className="group p-4 border border-gray-100 rounded-xl hover:border-blue-200 hover:shadow-md transition-all cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${agent.color} rounded-xl flex items-center justify-center text-white`}>
                        {agent.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                          {agent.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          平均削減: <span className="text-emerald-600 font-medium">{agent.timeSaved}</span>
                        </p>
                      </div>
                      <ArrowUpRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
