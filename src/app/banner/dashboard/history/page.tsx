'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Download, Trash2, Image as ImageIcon, RefreshCw } from 'lucide-react'
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
  const { data: session, status } = useSession()
  const isGuest = status !== 'loading' && !session
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // ログインユーザーはAPIから、ゲストは履歴閲覧不可
  const loadHistory = useCallback(async () => {
    if (status === 'loading') return
    setIsLoading(true)
    setRequiresUpgrade(false)
    setErrorMessage(null)
    try {
      if (isGuest) {
        // ゲストは履歴閲覧不可（有料プラン限定）
        setHistory([])
        setRequiresUpgrade(true)
      } else {
        // ログインユーザーはAPIから取得
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 15_000)
        const res = await fetch('/api/banner/history?take=50', { signal: controller.signal })
        window.clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          // 有料プラン限定チェック
          if (data.requiresUpgrade) {
            setHistory([])
            setRequiresUpgrade(true)
          } else {
            const items = Array.isArray(data.items) ? data.items : []
            setHistory(items.map((item: any) => ({
              id: item.id,
              category: item.category || '',
              keyword: item.keyword || '',
              size: item.size || '',
              createdAt: new Date(item.createdAt),
              // APIは banners 配列を返す（バッチ内の複数枚）
              banners: Array.isArray(item.banners) ? item.banners : (item.image ? [item.image] : []),
            })))
          }
        } else {
          toast.error('履歴の取得に失敗しました')
          setErrorMessage('履歴の取得に失敗しました（再読み込み/再試行してください）')
          setHistory([])
        }
      }
    } catch (e) {
      console.error('History load error:', e)
      setHistory([])
      if ((e as any)?.name === 'AbortError') {
        setErrorMessage('履歴の取得がタイムアウトしました（通信状況をご確認のうえ再試行してください）')
      } else {
        setErrorMessage('履歴の取得に失敗しました（再読み込み/再試行してください）')
      }
    } finally {
      setIsLoaded(true)
      setIsLoading(false)
    }
  }, [isGuest, status])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // セッションが「loading」のまま固まった時でも無限ローディングにしない（UX救済）
  useEffect(() => {
    if (status !== 'loading') return
    const t = window.setTimeout(() => {
      // 8秒待ってもセッションが取れない場合は画面を解放（再試行導線を出す）
      setIsLoaded(true)
      setIsLoading(false)
      setHistory([])
      setRequiresUpgrade(true)
      setErrorMessage('ログイン状態の確認に時間がかかっています。再読み込みすると解消する場合があります。')
    }, 8000)
    return () => window.clearTimeout(t)
  }, [status])

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `doya_banner_${Date.now()}_${index}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロード開始')
  }

  const handleDelete = async (id: string) => {
    if (isGuest) {
      // ゲストはlocalStorageから削除
      const updated = history.filter(item => item.id !== id)
      setHistory(updated)
      localStorage.setItem('banner_history', JSON.stringify(updated.map(h => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      }))))
      toast.success('削除しました')
    } else {
      // ログインユーザーはAPI経由で削除（batchId = item.id）
      try {
        const res = await fetch(`/api/banner/history?batchId=${encodeURIComponent(id)}`, { method: 'DELETE' })
        if (res.ok) {
          setHistory(history.filter(item => item.id !== id))
          toast.success('削除しました')
        } else {
          toast.error('削除に失敗しました')
        }
      } catch {
        toast.error('削除に失敗しました')
      }
    }
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <DashboardSidebar />
        <div className="pl-[72px] md:pl-[240px] flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <DashboardSidebar />
      <div className="pl-[72px] md:pl-[240px] transition-all duration-200">
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
                <button
                  onClick={() => loadHistory()}
                  disabled={isLoading}
                  className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all"
                  title="更新"
                >
                  <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-3 pl-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-800 leading-none">{session?.user?.name || 'ゲスト'}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">{isGuest ? 'Guest' : 'User'}</p>
                  </div>
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-blue-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                    {session?.user?.image ? (
                      <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                        {session?.user?.name?.[0]?.toUpperCase() || 'G'}
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
          {errorMessage ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                <ImageIcon className="w-12 h-12 text-slate-300" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">履歴を読み込めませんでした</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">{errorMessage}</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => loadHistory()}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-100 hover:scale-105"
                >
                  再試行
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all"
                >
                  再読み込み
                </button>
              </div>
            </motion.div>
          ) : requiresUpgrade ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 bg-white rounded-3xl border border-amber-200 shadow-sm"
            >
              <div className="w-24 h-24 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
                <ImageIcon className="w-12 h-12 text-amber-400" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-3">有料プラン限定機能</h2>
              <p className="text-slate-500 mb-8 max-w-md mx-auto leading-relaxed">
                履歴機能は有料プラン限定です。<br />
                プランをアップグレードすると、6ヶ月分の履歴を<br />
                いつでも確認・再ダウンロードできます。
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/banner/dashboard/plan">
                  <button className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl transition-all shadow-lg shadow-amber-100 hover:scale-105">
                    プランをアップグレード
                  </button>
                </Link>
                <Link href="/banner/dashboard">
                  <button className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-all">
                    バナーを生成する
                  </button>
                </Link>
              </div>
            </motion.div>
          ) : history.length === 0 ? (
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
                6ヶ月間保存され、いつでも再ダウンロード可能です。
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
                            <span className="text-white text-xs font-black uppercase tracking-widest">ダウンロード</span>
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
