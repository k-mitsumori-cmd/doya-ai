'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Download, Trash2, Image as ImageIcon, Search, Bell, Settings } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'

interface HistoryItem {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: Date
  banners: string[] // Base64またはURL
}

// ローカルストレージから履歴を取得
function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem('banner_history')
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

export default function BannerHistoryPage() {
  const { data: session } = useSession()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setHistory(getHistory())
    setIsLoaded(true)
  }, [])

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `bunridge_banner_${Date.now()}_${index}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロード開始')
  }

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id)
    setHistory(updated)
    localStorage.setItem('banner_history', JSON.stringify(updated))
    toast.success('削除しました')
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <DashboardSidebar />
        <div className="pl-[72px] lg:pl-[240px] flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <DashboardSidebar />
      <div className="pl-[72px] lg:pl-[240px] transition-all duration-200">
        {/* ヘッダー */}
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                  生成履歴
                </h1>
              </div>
              
              <div className="flex items-center gap-3 sm:gap-6">
                <div className="hidden md:flex items-center gap-2">
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                  </button>
                  <button className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || '田中 太郎'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">Admin</p>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {session?.user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* メイン */}
        <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
          {history.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <ImageIcon className="w-12 h-12 text-slate-300" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">履歴がありません</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                バナーを生成すると、ここに履歴が表示されます。<br />
                作成したバナーはいつでも再ダウンロード可能です。
              </p>
              <Link href="/banner/dashboard">
                <button className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-100 hover:scale-105">
                  最初のバナーを生成する
                </button>
              </Link>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
              {history.map((item, idx) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-6 border-b border-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
                        <Clock className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase tracking-wider">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-slate-800 line-clamp-1">{item.keyword}</h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Canvas Size</span>
                        <span className="text-sm font-black text-slate-700">{item.size}</span>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-3 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100"
                        title="削除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {/* バナー画像プレビュー */}
                  {item.banners && item.banners.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      {item.banners.map((banner, i) => (
                        <div key={i} className="relative aspect-video sm:aspect-square rounded-2xl overflow-hidden group/item cursor-pointer shadow-sm border border-slate-100">
                          <img 
                            src={banner} 
                            alt={`Banner ${i + 1}`}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                          />
                          <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover/item:opacity-100 transition-all flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                            <button 
                              onClick={() => handleDownload(banner, i)}
                              className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                            >
                              <Download className="w-6 h-6" />
                            </button>
                            <span className="text-white text-xs font-black uppercase tracking-widest">Download {String.fromCharCode(65 + i)}案</span>
                          </div>
                          <div className="absolute top-3 left-3 px-2 py-1 bg-white/90 backdrop-blur-md text-slate-800 text-[10px] font-black rounded-lg shadow-sm border border-slate-100">
                            {String.fromCharCode(65 + i)}案
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
