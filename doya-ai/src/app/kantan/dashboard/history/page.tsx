'use client'

import Link from 'next/link'
import { ArrowLeft, Clock, Copy, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function KantanHistoryPage() {
  // モックデータ
  const history = [
    { id: '1', template: 'ビジネスメール', content: 'いつもお世話になっております。株式会社〇〇の田中です。', createdAt: '2025-01-15 14:30' },
    { id: '2', template: 'ブログ記事', content: '【2025年最新】おすすめのAIツール10選をご紹介します。', createdAt: '2025-01-14 10:15' },
    { id: '3', template: 'キャッチコピー', content: '未来を変える、たった一つの決断。', createdAt: '2025-01-13 16:45' },
  ]

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content)
    toast.success('コピーしました！')
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
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h2>
            <p className="text-gray-600 mb-6">文章を生成すると、ここに履歴が表示されます</p>
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
                    <span className="ml-3 text-sm text-gray-500">{item.createdAt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleCopy(item.content)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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

