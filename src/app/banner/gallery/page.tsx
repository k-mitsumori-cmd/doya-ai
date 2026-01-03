'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, Image as ImageIcon, Download } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { DashboardLayout } from '@/components/DashboardLayout'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'

type GalleryItem = {
  id: string
  thumbUrl: string
  createdAt: string
  category: string
  purpose: string
  size: string
  keyword: string
  pattern: string
  creator: string
  creatorImage: string | null
}

const GALLERY_CACHE_KEY = 'doya-gallery-cache'
const GALLERY_CACHE_TTL_MS = 60 * 1000 // 1分間有効

function readGalleryCache(): { items: GalleryItem[]; cursor: string | null; ts: number } | null {
  try {
    const raw = sessionStorage.getItem(GALLERY_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed?.items)) return null
    return { items: parsed.items, cursor: parsed.cursor || null, ts: parsed.ts || 0 }
  } catch {
    return null
  }
}

function writeGalleryCache(items: GalleryItem[], cursor: string | null) {
  try {
    sessionStorage.setItem(GALLERY_CACHE_KEY, JSON.stringify({ items, cursor, ts: Date.now() }))
  } catch {
    // ignore
  }
}

// サムネイル画像コンポーネント（高速表示 + ローディング体験最適化）
function GalleryThumb({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [retryCount, setRetryCount] = useState(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // IntersectionObserverで画面に入ったら読み込み開始（パフォーマンス向上）
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStatus('loading')
          observer.disconnect()
        }
      },
      { rootMargin: '200px' } // 少し早めに読み込み開始
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // リトライ機能
  const handleError = () => {
    if (retryCount < 3) {
      // 少し待ってリトライ
      setTimeout(() => {
        setRetryCount((c) => c + 1)
        if (imgRef.current) {
          imgRef.current.src = `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount + 1}`
        }
      }, 1000 * (retryCount + 1))
    } else {
      setStatus('error')
    }
  }

  // シマーアニメーションのスタイル
  const shimmerStyle = {
    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* ローディング中/未読み込みのスケルトン（シマーアニメーション） */}
      {(status === 'idle' || status === 'loading' || status === 'error') && (
        <div 
          className="absolute inset-0"
          style={shimmerStyle}
        >
          {/* 淡いグラデーションオーバーレイ */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30" />
          {/* 中央のアイコン */}
          <div className="absolute inset-0 flex items-center justify-center">
            {status === 'loading' ? (
              <div className="w-10 h-10 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
            ) : status === 'error' ? (
              <div className="text-center opacity-60">
                <ImageIcon className="w-10 h-10 text-slate-400 mx-auto" />
              </div>
            ) : (
              <ImageIcon className="w-10 h-10 text-slate-300" />
            )}
          </div>
        </div>
      )}

      {/* 実際の画像（読み込み開始後） */}
      {status !== 'idle' && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}

export default function BannerGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  const [isStale, setIsStale] = useState(false)

  const LOADING_TIPS = [
    '人気のバナーは「数字×限定感×CTA」が強いです',
    '人物写真を入れるとCTRが上がりやすい傾向があります',
    '文字は短く太く。3秒で伝わるのが勝ちです',
    '迷ったら「今だけ」「無料」「限定」でテスト',
    'ローディング中も別タブで作業OKです',
  ]

  useEffect(() => {
    if (!loading && !loadingMore) return
    const t = window.setInterval(() => setTipIndex((v) => (v + 1) % LOADING_TIPS.length), 1800)
    return () => window.clearInterval(t)
  }, [loading, loadingMore])

  const fetchPage = async (nextCursor?: string | null) => {
    const qs = new URLSearchParams()
    qs.set('take', '24')
    if (nextCursor) qs.set('cursor', nextCursor)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(`/api/banner/gallery?${qs.toString()}`, { signal: controller.signal })
    window.clearTimeout(timeout)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || 'ギャラリーの取得に失敗しました')
    return json as { items: GalleryItem[]; nextCursor: string | null }
  }

  const fetchFullImage = async (id: string): Promise<string> => {
    const res = await fetch(`/api/banner/image?id=${encodeURIComponent(id)}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error || '画像の取得に失敗しました')
    const image = String(json?.image || '')
    if (!image.startsWith('data:') && !/^https?:\/\//.test(image)) throw new Error('画像データが取得できませんでした')
    return image
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // キャッシュチェック（stale-while-revalidate）
      const cached = readGalleryCache()
      if (cached && cached.items.length > 0) {
        setItems(cached.items)
        setCursor(cached.cursor)
        setLoading(false)
        const isExpired = Date.now() - cached.ts > GALLERY_CACHE_TTL_MS
        if (!isExpired) {
          // まだ有効 → API呼ばない
          return
        }
        // 期限切れ → バックグラウンドで更新
        setIsStale(true)
      }

      try {
        setLoading(cached ? false : true) // キャッシュがあればローディング表示しない
        setError(null)
        const data = await fetchPage(null)
        if (!mounted) return
        setItems(data.items || [])
        setCursor(data.nextCursor || null)
        writeGalleryCache(data.items || [], data.nextCursor || null)
        setIsStale(false)
      } catch (e: any) {
        if (!mounted) return
        if (e?.name === 'AbortError') {
          setError('読み込みがタイムアウトしました。通信状況をご確認のうえ、再試行してください。')
        } else {
          setError(e?.message || 'ギャラリーの取得に失敗しました')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    try {
      setLoadingMore(true)
      const data = await fetchPage(cursor)
      setItems((prev) => prev.concat(data.items || []))
      setCursor(data.nextCursor || null)
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('追加読み込みがタイムアウトしました。時間をおいて再試行してください。')
      } else {
        setError(e?.message || '追加読み込みに失敗しました')
      }
    } finally {
      setLoadingMore(false)
    }
  }

  const downloadImage = async (id: string) => {
    try {
      toast.loading('画像を準備中...', { id: 'dl' })
      const imageUrl = await fetchFullImage(id)
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = `doya_gallery_${id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('ダウンロード開始', { id: 'dl' })
    } catch (e: any) {
      toast.error(e?.message || 'ダウンロードに失敗しました', { id: 'dl' })
    }
  }

  const retry = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchPage(null)
      setItems(data.items || [])
      setCursor(data.nextCursor || null)
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        setError('読み込みがタイムアウトしました。通信状況をご確認のうえ、再試行してください。')
      } else {
        setError(e?.message || 'ギャラリーの取得に失敗しました')
      }
    } finally {
      setLoading(false)
    }
  }

  // 互換：古い実装のハンドラは廃止（一覧はサムネのみ）

  return (
    <DashboardLayout>
      <Toaster position="top-center" />
      <div className="text-gray-900">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
            <div className="h-16 sm:h-20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/banner/dashboard" className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">ギャラリー</h1>
                  <p className="text-xs text-slate-500 font-bold mt-1">他のユーザーが公開した生成バナー</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 sm:py-12">
          {loading ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm">
              <div className="flex items-center justify-center gap-3 text-slate-700 font-black">
                <Loader2 className="w-5 h-5 animate-spin" />
                読み込み中...
              </div>
              <div className="mt-4 h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-blue-600 animate-pulse rounded-full" />
              </div>
              <p className="mt-4 text-center text-xs font-bold text-slate-500">
                {LOADING_TIPS[tipIndex]}
              </p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-3xl border border-red-100 p-10 shadow-sm">
              <p className="text-red-600 font-bold">{error}</p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={retry}
                  className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black hover:bg-blue-700 transition-colors"
                >
                  再試行
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black hover:bg-slate-200 transition-colors"
                >
                  再読み込み
                </button>
                <a
                  href={SUPPORT_CONTACT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3 rounded-2xl bg-white border border-gray-200 text-slate-800 font-black hover:bg-slate-50 transition-colors text-center"
                >
                  お問い合わせ
                </a>
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 shadow-sm text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-slate-100">
                <ImageIcon className="w-10 h-10 text-slate-300" />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">まだ公開作品がありません</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                バナー作成画面で「ギャラリーに公開」をONにすると、ここに表示されます。
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {items.map((it) => (
                  <div key={it.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden group">
                    <div className="relative aspect-square bg-slate-50 overflow-hidden">
                      <div className="w-full h-full transition-transform duration-500 group-hover:scale-105">
                        <GalleryThumb src={it.thumbUrl} alt={it.keyword || 'banner'} />
                      </div>
                      {/* ダウンロードボタン（ホバー時表示） */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                        <button
                          onClick={() => downloadImage(it.id)}
                          className="w-14 h-14 bg-white text-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
                          title="ダウンロード"
                        >
                          <Download className="w-7 h-7" />
                        </button>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-800 truncate">{it.keyword || '（訴求なし）'}</p>
                          <p className="text-[11px] text-slate-500 font-bold mt-1">
                            {it.category || 'other'} / {it.purpose || 'sns_ad'} / {it.size || '-'} {it.pattern ? `・${it.pattern}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {it.creatorImage ? (
                            <img src={it.creatorImage} alt="creator" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 font-bold">
                        <span>{it.creator || '匿名'}</span>
                        <span>{new Date(it.createdAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex items-center justify-center">
                {cursor ? (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-blue-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    さらに読み込む
                  </button>
                ) : (
                  <p className="text-xs text-slate-400 font-bold">これ以上ありません</p>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </DashboardLayout>
  )
}


