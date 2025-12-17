'use client'

import Link from 'next/link'
import { ArrowLeft, Clock, Download, Trash2 } from 'lucide-react'

export default function BannerHistoryPage() {
  // モックデータ
  const history = [
    { id: '1', category: '通信向け', keyword: '月額990円〜', size: '1080x1080', createdAt: '2024-12-17 14:30', thumbnail: 'https://via.placeholder.com/200/8B5CF6/FFFFFF?text=Banner' },
    { id: '2', category: 'EC向け', keyword: '決算セール MAX70%OFF', size: '1200x628', createdAt: '2024-12-16 10:15', thumbnail: 'https://via.placeholder.com/200/EC4899/FFFFFF?text=Banner' },
  ]

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
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {history.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">履歴がありません</h2>
            <p className="text-gray-600 mb-6">バナーを生成すると、ここに履歴が表示されます</p>
            <Link href="/banner/dashboard">
              <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-colors">
                バナーを生成する
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 border border-gray-200 flex items-center gap-4">
                <img 
                  src={item.thumbnail} 
                  alt="Banner" 
                  className="w-20 h-20 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{item.category}</h3>
                  <p className="text-sm text-gray-600 truncate">{item.keyword}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>{item.size}</span>
                    <span>{item.createdAt}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                    <Download className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

