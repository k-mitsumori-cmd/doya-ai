'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ArrowLeft, Image as ImageIcon, Download } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { DashboardLayout } from '@/components/DashboardLayout'

type GalleryItem = {
  id: string
  image: string
  createdAt: string
  category: string
  purpose: string
  size: string
  keyword: string
  pattern: string
  creator: string
  creatorImage: string | null
}

export default function BannerGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchPage(null)
        if (!mounted) return
        setItems(data.items || [])
        setCursor(data.nextCursor || null)
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

  const handleDownload = (imageUrl: string, keyword: string) => {
    try {
      const link = document.createElement('a')
      link.href = imageUrl
      const safeName = (keyword || 'banner').replace(/[^a-zA-Z0-9ぁ-んァ-ン一-龥]/g, '_').slice(0, 30)
      link.download = `doya_gallery_${safeName}_${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('ダウンロードを開始しました')
    } catch {
      toast.error('ダウンロードに失敗しました')
    }
  }

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
            <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm flex items-center justify-center gap-3 text-slate-600 font-bold">
              <Loader2 className="w-5 h-5 animate-spin" />
              読み込み中...
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
                    <div className="relative aspect-square bg-slate-50">
                      <img src={it.image} alt={it.keyword || 'banner'} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      {/* ダウンロードボタン（ホバー時表示） */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleDownload(it.image, it.keyword)}
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


