'use client'

import Link from 'next/link'
import { ArrowLeft, Palette, Save } from 'lucide-react'
import { useState } from 'react'

export default function BannerBrandPage() {
  const [primaryColor, setPrimaryColor] = useState('#8B5CF6')
  const [secondaryColor, setSecondaryColor] = useState('#EC4899')
  const [brandName, setBrandName] = useState('')

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
            <Palette className="w-5 h-5 text-purple-600" />
            <span className="font-bold text-gray-800">ブランド設定</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-6">ブランドカラー設定</h2>
          
          <div className="space-y-6">
            {/* ブランド名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ブランド名
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="例: My Company"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
              />
            </div>

            {/* プライマリカラー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プライマリカラー
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-16 rounded-xl cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            {/* セカンダリカラー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                セカンダリカラー
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-16 h-16 rounded-xl cursor-pointer border-2 border-gray-200"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none"
                />
              </div>
            </div>

            {/* プレビュー */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プレビュー
              </label>
              <div 
                className="h-32 rounded-xl flex items-center justify-center text-white font-bold text-xl"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              >
                {brandName || 'ブランド名'}
              </div>
            </div>

            {/* 保存ボタン */}
            <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              <Save className="w-5 h-5" />
              保存する
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          ※ ブランド設定はプロプランのみ利用可能です
        </p>
      </main>
    </div>
  )
}

