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
  HelpCircle, ChevronDown, DollarSign,
  Timer, CheckCircle2, ArrowUpRight, MoreHorizontal, Database,
  UserCircle, ChevronLeft, Menu, X
} from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'
import { FeatureGuide } from '@/components/FeatureGuide'
import { DashboardLayout } from '@/components/DashboardLayout'

// サイドバーメニュー - AIエージェント中心に再構成
const SIDEBAR_MENU = [
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history' },
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard', active: true },
]

const SIDEBAR_DATA_MENU = [
  { id: 'plan', label: 'プラン・料金', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/pricing' },
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


export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const isGuest = !session
  const userName = session?.user?.name || 'ゲスト'
  const userInitial = userName[0]?.toUpperCase() || 'T'

  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
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
    <DashboardLayout>
      <div className="py-2">
        {/* コンテンツ */}
        <div className="p-0">
          {/* 統計カード */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
            {STATS_CARDS.map((card) => (
              <div key={card.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4">
                <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center text-white shadow-lg shadow-gray-100`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{card.label}</p>
                  <p className="text-3xl font-black text-gray-900">{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* グラフセクション */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-lg font-black text-gray-900">パフォーマンス推移</h2>
                <p className="text-xs text-gray-400 font-bold mt-1">売上と営業コストの相関分析</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black text-blue-600">64.2%</span>
                <span className="text-xs font-black text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">+12.5%</span>
              </div>
            </div>
            
            {/* グラフエリア */}
            <div className="relative h-64 overflow-x-auto no-scrollbar">
              <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[10px] text-gray-300 font-bold py-2">
                <span>100%</span>
                <span>50%</span>
                <span>0%</span>
              </div>
              
              <div className="ml-12 h-full flex items-end gap-1.5 min-w-[600px] sm:min-w-0">
                {CHART_DATA.map((data, index) => (
                  <div key={index} className="flex-1 flex gap-0.5 items-end h-full group">
                    <div 
                      className="flex-1 bg-blue-100 rounded-t-sm transition-all group-hover:bg-blue-200"
                      style={{ height: `${data.sales}%` }}
                    />
                    <div 
                      className="flex-1 bg-blue-600 rounded-t-sm transition-all group-hover:bg-blue-700"
                      style={{ height: `${data.cost}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>


          {/* ゲストバナー */}
          {isGuest && (
            <div className="mt-10 p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl text-white shadow-xl shadow-blue-500/20">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">ログインして全機能を開放</h3>
                    <p className="text-blue-100 text-xs font-bold opacity-80 mt-1">
                      残り <strong className="text-white">{guestRemainingCount}回</strong> の試用が可能です
                    </p>
                  </div>
                </div>
                <Link href="/auth/signin?service=kantan" className="w-full sm:w-auto">
                  <button className="w-full sm:w-auto px-8 py-3 bg-white text-blue-600 text-sm font-black rounded-xl hover:bg-blue-50 transition-colors shadow-lg">
                    今すぐログイン
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
