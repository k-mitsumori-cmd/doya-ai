'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, ArrowLeft, Sparkles, LogIn, Wand2 } from 'lucide-react'
import { KANTAN_PRICING, getGuestRemainingCount } from '@/lib/pricing'

// テンプレート一覧（人気順）
const POPULAR_TEMPLATES = [
  { id: 'business-email', name: 'ビジネスメール', icon: '📧', desc: '丁寧なメールを作成', gradient: 'from-blue-500 to-cyan-500' },
  { id: 'blog-article', name: 'ブログ記事', icon: '📝', desc: '読みやすい記事を作成', gradient: 'from-emerald-500 to-green-500' },
  { id: 'instagram-caption', name: 'SNS投稿', icon: '📱', desc: 'SNS用の投稿文を作成', gradient: 'from-purple-500 to-pink-500' },
  { id: 'catchcopy', name: 'キャッチコピー', icon: '✨', desc: '魅力的なキャッチコピー', gradient: 'from-amber-500 to-orange-500' },
  { id: 'meeting-minutes', name: '議事録', icon: '📋', desc: '会議の議事録を作成', gradient: 'from-rose-500 to-red-500' },
  { id: 'proposal-document', name: '提案書', icon: '📑', desc: '企画提案書を作成', gradient: 'from-indigo-500 to-violet-500' },
]

export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const [guestRemainingCount, setGuestRemainingCount] = useState(KANTAN_PRICING.guestLimit)
  
  const isGuest = !session
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'

  // ゲスト使用状況を読み込み
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      setGuestRemainingCount(getGuestRemainingCount('kantan'))
    }
  }, [isGuest])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl">📝</span>
          </div>
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm hidden sm:inline">ポータル</span>
          </Link>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-lg">📝</span>
            </div>
            <span className="font-bold text-gray-800">カンタンドヤAI</span>
          </div>
          
          {session ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-sm font-bold">{userName[0]}</span>
              </div>
            </div>
          ) : (
            <Link href="/auth/signin?service=kantan" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-full hover:bg-blue-700 transition-colors">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">ログイン</span>
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* ゲストバナー */}
        {isGuest && (
          <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">🆓 お試しモード</p>
                  <p className="text-sm text-gray-600">
                    残り <span className="font-bold text-blue-600">{guestRemainingCount}回</span>（1日{KANTAN_PRICING.guestLimit}回まで）
                  </p>
                </div>
              </div>
              <Link href="/auth/signin?service=kantan">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-colors flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  ログインで10回に！
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">
            作りたい文章を選んでね 👇
          </h1>
          <p className="text-gray-600">
            テンプレートを選んで、情報を入力するだけ！
          </p>
        </div>

        {/* テンプレートカード */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          {POPULAR_TEMPLATES.map((template) => (
            <Link key={template.id} href={`/kantan/dashboard/text/${template.id}`} className="group">
              <div className={`
                relative h-full p-5 rounded-2xl overflow-hidden
                bg-gradient-to-br ${template.gradient}
                transition-all duration-300
                hover:scale-[1.02] hover:shadow-xl
                cursor-pointer
              `}>
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
                
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">{template.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-white mb-0.5">{template.name}</h3>
                    <p className="text-sm text-white/80">{template.desc}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/70 group-hover:translate-x-1 transition-transform flex-shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* 全テンプレートへのリンク */}
        <div className="mb-10">
          <Link href="/kantan/dashboard/text">
            <button className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-lg font-bold rounded-2xl transition-all flex items-center justify-center gap-3">
              全68種類のテンプレートを見る
              <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>

        {/* 使い方（超シンプル） */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4 text-center">使い方はカンタン！</h2>
          <div className="flex items-center justify-center gap-4 sm:gap-8 text-center">
            {[
              { step: '1', text: '選ぶ', icon: '👆' },
              { step: '2', text: '入力', icon: '✍️' },
              { step: '3', text: '完成！', icon: '🎉' },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center mb-2">
                  <span className="text-2xl">{item.icon}</span>
                </div>
                <span className="text-sm font-bold text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* バナー作成への誘導 */}
        <Link href="/banner/dashboard" className="block">
          <div className="bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl p-5 flex items-center gap-4 hover:shadow-xl transition-all">
            <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-3xl">🎨</span>
            </div>
            <div className="flex-1">
              <p className="text-white/80 text-sm">バナーも作れる！</p>
              <h3 className="text-lg font-bold text-white">ドヤバナーAI</h3>
            </div>
            <ArrowRight className="w-5 h-5 text-white/70" />
          </div>
        </Link>
      </main>

      {/* フッター */}
      <footer className="py-6 px-4 border-t border-gray-100 mt-8">
        <div className="max-w-3xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-700">ドヤAI</Link>
          <div className="flex items-center gap-4">
            <Link href="/kantan/dashboard/history" className="hover:text-gray-700">履歴</Link>
            <Link href="/kantan/pricing" className="hover:text-gray-700">料金</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
