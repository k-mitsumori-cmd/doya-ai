'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Download, Trash2, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    setHistory(getHistory())
    setIsLoaded(true)
  }, [])

  const handleDownload = (imageUrl: string, index: number) => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `banner_${Date.now()}_${index}.png`
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/banner/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-gray-800">生成履歴</span>
          </div>
          {history.length > 0 && (
            <span className="ml-auto text-sm text-gray-500">{history.length}件</span>
          )}
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h2>
            <p className="text-gray-600 mb-6">
              バナーを生成すると、ここに履歴が表示されます。<br />
              <span className="text-sm">※ ゲスト・無料プランは7日間保存</span>
            </p>
            <Link href="/banner/dashboard">
              <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors">
                バナーを生成する
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                      {item.category}
                    </span>
                    <span className="ml-3 text-sm text-gray-500">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-gray-700 mb-4 font-medium">&quot;{item.keyword}&quot;</p>
                <p className="text-sm text-gray-500 mb-4">サイズ: {item.size}</p>
                
                {/* バナー画像プレビュー */}
                {item.banners && item.banners.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    {item.banners.map((banner, i) => (
                      <div key={i} className="relative group">
                        <img 
                          src={banner} 
                          alt={`Banner ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border border-gray-200"
                        />
                        <button 
                          onClick={() => handleDownload(banner, i)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                        >
                          <Download className="w-6 h-6 text-white" />
                        </button>
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded">
                          {String.fromCharCode(65 + i)}案
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
