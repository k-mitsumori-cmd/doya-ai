'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Clock, Copy, Trash2, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

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
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/kantan/dashboard" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-bold text-gray-800">作成履歴</span>
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
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h2>
            <p className="text-gray-600 mb-6">
              文章を生成すると、ここに履歴が表示されます。<br />
              <span className="text-sm">※ ゲスト・無料プランは7日間保存</span>
            </p>
            <Link href="/kantan/dashboard">
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                文章を作成する
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-200">
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
      </main>
    </div>
  )
}
