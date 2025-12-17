'use client'

import Link from 'next/link'
import { Home, ArrowLeft, Sparkles } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* ロゴ */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 mb-6 shadow-xl">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        
        {/* 404 */}
        <h1 className="text-7xl font-extrabold text-gray-900 mb-4">404</h1>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          ページが見つかりません
        </h2>
        
        <p className="text-gray-600 mb-8">
          お探しのページは存在しないか、<br />
          移動した可能性があります。
        </p>
        
        {/* ナビゲーション */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-bold rounded-full shadow-lg hover:shadow-xl transition-all">
              <Home className="w-5 h-5" />
              トップへ戻る
            </button>
          </Link>
          
          <button 
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            前のページへ
          </button>
        </div>
        
        {/* 追加のリンク */}
        <div className="mt-10 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">お探しですか？</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link href="/kantan/dashboard" className="text-violet-600 hover:underline">
              カンタンドヤAI
            </Link>
            <Link href="/banner/dashboard" className="text-violet-600 hover:underline">
              ドヤバナーAI
            </Link>
            <Link href="/auth/signin" className="text-violet-600 hover:underline">
              ログイン
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

