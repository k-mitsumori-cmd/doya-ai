'use client'

import { useState, useEffect } from 'react'
import { Clock, Copy, Trash2, ArrowLeft, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface HistoryItem {
  id: string
  templateId: string
  templateName: string
  output: string
  createdAt: string
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = localStorage.getItem('doya_generation_history')
    if (saved) {
      try {
        setHistory(JSON.parse(saved))
      } catch {
        setHistory([])
      }
    }
  }, [])

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    toast.success('コピーしました！')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = (id: string) => {
    if (!confirm('この履歴を削除しますか？')) return
    const newHistory = history.filter(item => item.id !== id)
    setHistory(newHistory)
    localStorage.setItem('doya_generation_history', JSON.stringify(newHistory))
    toast.success('削除しました')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ja-JP', { 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-white lg:bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-base mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            ホームに戻る
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="w-7 h-7 text-blue-500" />
            作成履歴
          </h1>
          <p className="text-base text-gray-600 mt-2">
            過去に作成した文章の一覧です
          </p>
        </div>

        {/* 履歴一覧 */}
        {history.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              履歴がありません
            </h3>
            <p className="text-base text-gray-600 mb-6">
              文章を作成すると、ここに保存されます
            </p>
            <Link href="/dashboard">
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl">
                文章を作成する
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm"
              >
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{item.templateName}</h3>
                    <p className="text-sm text-gray-500">{formatDate(item.createdAt)}</p>
                  </div>
                </div>

                {/* 内容 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-gray-800 text-sm whitespace-pre-wrap line-clamp-4">
                    {item.output}
                  </p>
                </div>

                {/* ボタン */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopy(item.output, item.id)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
                  >
                    {copiedId === item.id ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        コピーしました
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        コピーする
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 px-4 py-3 rounded-xl transition-colors"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
