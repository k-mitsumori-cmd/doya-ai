'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Download, Trash2, Image as ImageIcon, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import DashboardSidebar from '@/components/DashboardSidebar'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import { CheckoutButton } from '@/components/CheckoutButton'

interface HistoryItem {
  id: string
  category: string
  keyword: string
  size: string
  createdAt: Date
  banners: string[] // 画像は段階取得
  bannerCount: number // バッチ内の枚数
  bannerIds?: string[] // ダウンロード用（元画像のGeneration ID）
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

const HISTORY_CACHE_KEY = 'doya-history-cache'
const HISTORY_CACHE_TTL_MS = 60 * 1000 // 1分間有効

function readHistoryCache(): { items: HistoryItem[]; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(HISTORY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return null
    return { items: parsed.items.map((i: any) => ({ ...i, createdAt: new Date(i.createdAt) })), ts: parsed.ts || 0 }
  } catch {
    return null
  }
}

function writeHistoryCache(items: HistoryItem[]) {
  try {
    sessionStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify({ items: items.map(i => ({ ...i, createdAt: i.createdAt.toISOString() })), ts: Date.now() }))
  } catch {
    // ignore
  }
}

export default function BannerHistoryPage() {
  const { data: session, status } = useSession()
  const isGuest = status !== 'loading' && !session
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [phase, setPhase] = useState<'list' | 'images' | 'idle'>('idle')
  const [isStale, setIsStale] = useState(false) // キャッシュ表示中かどうか

  const LOADING_TIPS = [
    '作ったバナーは6ヶ月間いつでも再DLできます（有料プラン）',
    '同じ訴求でも「数字」「限定」「無料」で反応が変わります',
    '画像が多いほど履歴の集計に少し時間がかかります',
    '重いときは一度更新すると改善する場合があります',
  ]

  useEffect(() => {
    if (!isLoading && isLoaded) return
    const t = window.setInterval(() => setTipIndex((v) => (v + 1) % LOADING_TIPS.length), 1800)
    return () => window.clearInterval(t)
  }, [isLoading, isLoaded])

  const fetchBatchImages = useCallback(async (batchId: string) => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      // 履歴表示は軽量化（サムネ）で取得
      const res = await fetch(`/api/banner/history?batchId=${encodeURIComponent(batchId)}&thumb=1`, { signal: controller.signal })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || '画像の取得に失敗しました')
      const banners = Array.isArray(data?.banners) ? data.banners : []
      const bannerIds = Array.isArray(data?.bannerIds) ? data.bannerIds : []
      return {
        // ここでは “サムネURL” を受け取る（/api/.../thumb）
        banners: banners.map((b: any) => String(b || '').trim()).filter(Boolean),
        bannerIds: bannerIds.filter((x: any) => typeof x === 'string'),
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }, [])

  const fetchFullImage = async (id: string): Promise<string> => {
    const res = await fetch(`/api/banner/history/image?id=${encodeURIComponent(id)}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || '画像の取得に失敗しました')
    const image = String(json?.image || '')
    if (!image.startsWith('data:') && !/^https?:\/\//.test(image)) throw new Error('画像データが取得できませんでした')
    return image
  }

  // ログインユーザーはAPIから、ゲストは履歴閲覧不可
  // SWR風: キャッシュがあれば即表示→バックグラウンドで更新
  const loadHistory = useCallback(async (forceRefresh = false) => {
    if (status === 'loading') return

    // キャッシュチェック（stale-while-revalidate）
    if (!forceRefresh) {
      const cached = readHistoryCache()
      if (cached && cached.items.length > 0) {
        setHistory(cached.items)
        setIsLoaded(true)
        setIsLoading(false)
        const isExpired = Date.now() - cached.ts > HISTORY_CACHE_TTL_MS
        if (!isExpired) {
          // まだ有効 → API呼ばない
          return
        }
        // 期限切れ → バックグラウンドで更新（stale表示中）
        setIsStale(true)
      }
    }

    setIsLoading(true)
    setRequiresUpgrade(false)
    setErrorMessage(null)
    setPhase('list')
    try {
      if (isGuest) {
        // ゲストは履歴閲覧不可（有料プラン限定）
        setHistory([])
        setRequiresUpgrade(true)
      } else {
        // ログインユーザーはAPIから取得
        const controller = new AbortController()
        const timeout = window.setTimeout(() => controller.abort(), 15_000)
        // まず一覧（画像なし + 最初の3枚だけthumb URL）を高速取得
        const res = await fetch('/api/banner/history?take=30&images=0', { signal: controller.signal })
        window.clearTimeout(timeout)
        if (res.ok) {
          const data = await res.json()
          // 有料プラン限定チェック
          if (data.requiresUpgrade) {
            setHistory([])
            setRequiresUpgrade(true)
          } else {
            const items = Array.isArray(data.items) ? data.items : []
            const list: HistoryItem[] = items.map((item: any) => ({
              id: item.id,
              category: item.category || '',
              keyword: item.keyword || '',
              size: item.size || '',
              createdAt: new Date(item.createdAt),
              // 最初の表示は previewThumbs を使う（追加リクエストを減らして爆速化）
              banners: Array.isArray(item.previewThumbs) ? item.previewThumbs.map((x: any) => String(x || '')).filter(Boolean) : [],
              bannerCount:
                Number(item.bannerCount) > 0
                  ? Number(item.bannerCount)
                  : Array.isArray(item.banners)
                    ? item.banners.length
                    : 1,
              bannerIds: Array.isArray(item.previewIds) ? item.previewIds.filter((x: any) => typeof x === 'string') : undefined,
            }))
            setHistory(list)
            writeHistoryCache(list) // キャッシュ保存
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
      setIsStale(false)
      setPhase('idle')
    }
  }, [isGuest, status, fetchBatchImages])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // バナー画像が空のアイテムを自動リトライで取得する
  useEffect(() => {
    if (!isLoaded || isLoading) return
    const emptyItems = history.filter(item => item.bannerCount > 0 && item.banners.length === 0)
    if (emptyItems.length === 0) return

    const timers: ReturnType<typeof setTimeout>[] = []
    emptyItems.forEach((item, idx) => {
      // 各アイテムを1秒ずつずらして取得（サーバー負荷軽減）
      const t = setTimeout(async () => {
        try {
          const got = await fetchBatchImages(item.id)
          if (got.banners.length > 0) {
            setHistory((prev) =>
              prev.map((h) =>
                h.id === item.id ? { ...h, banners: got.banners, bannerIds: got.bannerIds } : h
              )
            )
          }
        } catch {
          // 失敗は無視（手動ボタンで再取得可能）
        }
      }, 2000 + idx * 1000)
      timers.push(t)
    })

    return () => timers.forEach(t => clearTimeout(t))
  }, [isLoaded, isLoading, history.length, fetchBatchImages])

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

  const handleDownload = async (genId: string, index: number) => {
    try {
      toast.loading('高画質画像を準備中...', { id: 'dl' })
      const imageUrl = await fetchFullImage(genId)
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `doya_banner_${Date.now()}_${index}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('ダウンロード開始', { id: 'dl' })
    } catch (e: any) {
      toast.error(e?.message || 'ダウンロードに失敗しました', { id: 'dl' })
    }
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
        <div className="hidden md:block">
          <DashboardSidebar />
        </div>
        <div className="md:pl-[240px] flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
            <p className="mt-4 text-xs font-bold text-slate-500">{LOADING_TIPS[tipIndex]}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="hidden md:block">
        <DashboardSidebar />
      </div>
      <div className="md:pl-[240px] transition-all duration-200">
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
          {isLoading && !requiresUpgrade && !errorMessage && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                <div className="text-xs font-black text-slate-800">
                  {phase === 'list' ? '履歴一覧を読み込み中…' : phase === 'images' ? '画像を読み込み中…' : '読み込み中…'}
                </div>
                <div className="ml-auto text-[11px] font-bold text-slate-500">{LOADING_TIPS[tipIndex]}</div>
              </div>
              <div className="mt-2 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-blue-600 animate-pulse rounded-full" />
              </div>
            </div>
          )}
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
                <a
                  href={SUPPORT_CONTACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-4 bg-white border border-gray-200 text-slate-800 font-black rounded-2xl transition-all hover:bg-slate-50"
                >
                  お問い合わせ
                </a>
              </div>
            </motion.div>
          ) : requiresUpgrade ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-3xl shadow-2xl"
            >
              {/* 背景デコレーション */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-400/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10 text-center py-16 sm:py-20 px-6 sm:px-12">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/30 shadow-lg">
                  <Clock className="w-10 h-10 text-white" />
                </div>
                
                <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md text-white text-xs font-black rounded-full uppercase tracking-widest mb-4">
                  PRO Feature
                </span>
                
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-4">履歴 &amp; 再ダウンロード</h2>
                
                <p className="text-blue-100 mb-8 max-w-lg mx-auto leading-relaxed text-sm sm:text-base">
                  PROプランなら、生成したバナーを<strong className="text-white">3ヶ月間</strong>保存。<br />
                  いつでも確認・再ダウンロードできます。
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <CheckoutButton
                    planId="banner-pro"
                    loginCallbackUrl="/banner/dashboard/history"
                    variant="secondary"
                    className="px-8 py-4 bg-white text-blue-600 font-black rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    PROプランを始める
                  </CheckoutButton>
                  <Link href="/banner">
                    <button className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 font-black rounded-2xl transition-all backdrop-blur-md">
                      まずバナーを生成
                    </button>
                  </Link>
                </div>
                
                <p className="mt-6 text-xs text-blue-200/80 font-bold">
                  ¥9,980/月 〜 いつでもキャンセル可能
                </p>
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
                  {item.bannerCount > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      {(item.banners.length > 0
                        ? item.banners
                        : Array.from({ length: Math.min(3, item.bannerCount) }, () => '')
                      ).map((banner, i) => (
                        <div
                          key={i}
                          className="relative aspect-video sm:aspect-square rounded-2xl overflow-hidden group/item cursor-pointer shadow-sm border border-slate-100 bg-slate-50"
                        >
                          {banner ? (
                            <img
                              src={banner}
                              alt={`Banner ${i + 1}`}
                                loading="lazy"
                                decoding="async"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover/item:scale-110"
                              onError={(e) => {
                                // サムネ取得に失敗しても“壊れ画像”にしない
                                const img = e.currentTarget
                                if (!img.dataset.fallbackApplied) {
                                  img.dataset.fallbackApplied = '1'
                                  img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
                                }
                              }}
                            />
                          ) : (
                            <div
                              className="absolute inset-0 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                              onClick={async () => {
                                try {
                                  const got = await fetchBatchImages(item.id)
                                  if (got.banners.length > 0) {
                                    setHistory((prev) =>
                                      prev.map((h) =>
                                        h.id === item.id ? { ...h, banners: got.banners, bannerIds: got.bannerIds } : h
                                      )
                                    )
                                  }
                                } catch {
                                  toast.error('画像の取得に失敗しました。もう一度お試しください。')
                                }
                              }}
                            >
                              <div className="flex flex-col items-center justify-center gap-3">
                                <div className="animate-pulse w-16 h-16 rounded-2xl bg-slate-200" />
                                <div className="text-[11px] font-black text-slate-400">読み込み中（タップで再取得）</div>
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover/item:opacity-100 transition-all flex flex-col items-center justify-center gap-3 backdrop-blur-[2px]">
                            {banner ? (
                              <>
                                <button
                                  onClick={() => {
                                    const id = item.bannerIds?.[i]
                                    if (!id) {
                                      toast.error('画像IDが取得できませんでした。再読み込みしてください。')
                                      return
                                    }
                                    void handleDownload(id, i)
                                  }}
                                  className="w-12 h-12 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                                >
                                  <Download className="w-6 h-6" />
                                </button>
                                <span className="text-white text-xs font-black uppercase tracking-widest">ダウンロード</span>
                              </>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    const got = await fetchBatchImages(item.id)
                                    setHistory((prev) =>
                                      prev.map((h) =>
                                        h.id === item.id ? { ...h, banners: got.banners, bannerIds: got.bannerIds } : h
                                      )
                                    )
                                    toast.success('画像を読み込みました')
                                  } catch (err: any) {
                                    toast.error(err?.message || '画像の取得に失敗しました')
                                  }
                                }}
                                className="px-4 py-2 bg-white text-blue-600 rounded-xl font-black text-xs shadow-xl hover:scale-105 transition-transform"
                              >
                                画像を表示
                              </button>
                            )}
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
