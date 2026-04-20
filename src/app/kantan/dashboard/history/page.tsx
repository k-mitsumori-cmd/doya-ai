'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowLeft, Clock, Copy, Trash2, FileText, Home,
  MessageSquare, TrendingUp, Cpu, Settings, UserCircle, Menu, X
} from 'lucide-react'
import toast from 'react-hot-toast'

// サイドバーメニュー - AIエージェント中心に再構成
const SIDEBAR_MENU = [
  { id: 'agents', label: 'AIエージェント', icon: <Cpu className="w-5 h-5" />, href: '/kantan/dashboard/text' },
  { id: 'chat', label: 'AIチャット', icon: <MessageSquare className="w-5 h-5" />, href: '/kantan/dashboard/chat' },
  { id: 'history', label: '生成履歴', icon: <Clock className="w-5 h-5" />, href: '/kantan/dashboard/history', active: true },
  { id: 'dashboard', label: 'ダッシュボード', icon: <Home className="w-5 h-5" />, href: '/kantan/dashboard' },
]

const SIDEBAR_DATA_MENU = [
  { id: 'plan', label: 'プラン・料金', icon: <UserCircle className="w-5 h-5" />, href: '/kantan/dashboard/pricing' },
]

interface HistoryItem {
  id: string
  template: string
  content: string
  createdAt: Date
}

// ローカルストレージから履歴を取得
function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem('kantan_history')
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((item: any) => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }))
  } catch {
    return []
  }
}

// 相対時間を表示
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'たった今'
  if (diffMins < 60) return `${diffMins}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`
  
  return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}

export default function KantanHistoryPage() {
  const { data: session } = useSession()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const userName = session?.user?.name || 'ゲスト'

  useEffect(() => {
    setHistory(getHistory())
    setIsLoaded(true)
  }, [])

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('コピーしました！')
  }

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id)
    setHistory(updated)
    localStorage.setItem('kantan_history', JSON.stringify(updated))
    toast.success('削除しました')
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
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
            
            <h1 className="text-lg lg:text-xl font-bold text-gray-800">作成履歴</h1>
            
            <div className="flex items-center gap-2 lg:gap-4">
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
          {history.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h2>
              <p className="text-gray-600 mb-6">
                文章を生成すると、ここに履歴が表示されます。<br />
                <span className="text-sm">※ ゲスト・無料プランは7日間保存</span>
              </p>
              <Link href="/kantan/dashboard/text">
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                  文章を作成する
                </button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-500">{history.length}件の履歴</span>
                </div>
              </div>
              {history.map((item) => (
                <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                        {item.template}
                      </span>
                      <span className="ml-3 text-sm text-gray-500">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleCopy(item.content)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="コピー"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 line-clamp-3">{item.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
