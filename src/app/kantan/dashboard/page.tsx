'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, HelpCircle, Crown, Clock, Home, FileText, LogOut, Menu, X, Sparkles } from 'lucide-react'
import { signOut } from 'next-auth/react'

// テンプレート一覧
const templates = [
  { id: 'business-email', name: 'ビジネスメール', icon: '📧', desc: '丁寧なメールを作成', color: 'bg-blue-50 border-blue-200 hover:border-blue-400' },
  { id: 'blog-article', name: 'ブログ記事', icon: '📝', desc: '読みやすい記事を作成', color: 'bg-green-50 border-green-200 hover:border-green-400' },
  { id: 'instagram-caption', name: 'SNS投稿', icon: '📱', desc: 'SNS用の投稿文を作成', color: 'bg-purple-50 border-purple-200 hover:border-purple-400' },
  { id: 'catchcopy', name: 'キャッチコピー', icon: '✨', desc: '魅力的なキャッチコピー', color: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400' },
  { id: 'meeting-minutes', name: '議事録', icon: '📋', desc: '会議の議事録を作成', color: 'bg-orange-50 border-orange-200 hover:border-orange-400' },
  { id: 'proposal-document', name: '提案書', icon: '📑', desc: '企画提案書を作成', color: 'bg-pink-50 border-pink-200 hover:border-pink-400' },
]

export default function KantanDashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'
  const plan = (session?.user as any)?.kantanPlan || 'FREE'
  const isPro = plan === 'PRO'

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?service=kantan')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-blue-50">
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
    <div className="min-h-screen bg-gray-50 flex">
      {/* サイドバー */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r border-gray-200
        transform transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* ロゴ */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
            <Link href="/kantan" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <span className="text-xl">📝</span>
              </div>
              <span className="font-bold text-gray-800">カンタンドヤAI</span>
            </Link>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 p-3 space-y-1">
            <Link href="/kantan/dashboard">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 text-blue-600 font-medium">
                <Home className="w-5 h-5" />
                <span>ホーム</span>
              </div>
            </Link>
            <Link href="/kantan/dashboard/text">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                <FileText className="w-5 h-5" />
                <span>全テンプレート</span>
              </div>
            </Link>
            <Link href="/kantan/dashboard/history">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 font-medium">
                <Clock className="w-5 h-5" />
                <span>作成履歴</span>
              </div>
            </Link>
          </nav>

          {/* プラン表示 */}
          {!isPro && (
            <div className="p-3">
              <Link href="/kantan/pricing">
                <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-3 text-center hover:opacity-90 transition-opacity">
                  <p className="font-bold text-sm">✨ プロプランにアップグレード</p>
                  <p className="text-xs opacity-80">1日100回まで生成可能</p>
                </div>
              </Link>
            </div>
          )}

          {/* ユーザー情報 */}
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-bold">{userName[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate text-sm">{session?.user?.name}</p>
                <p className="text-xs text-gray-500">{isPro ? 'プロプラン' : '無料プラン'}</p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/kantan' })}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-600 hover:bg-gray-100 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              ログアウト
            </button>
          </div>
        </div>
      </aside>

      {/* オーバーレイ */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* メインコンテンツ */}
      <main className="flex-1">
        {/* モバイルヘッダー */}
        <header className="lg:hidden sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center px-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2">
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xl">📝</span>
            <span className="font-bold text-gray-800">カンタンドヤAI</span>
          </div>
        </header>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* あいさつ */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              こんにちは、{userName}さん 👋
            </h1>
            <p className="text-lg text-gray-600">
              作りたい文章を選んでください
            </p>
          </div>

          {/* テンプレート一覧 */}
          <div className="space-y-3 mb-8">
            {templates.map((template) => (
              <Link key={template.id} href={`/kantan/dashboard/text/${template.id}`}>
                <div className={`${template.color} rounded-2xl p-5 border-2 transition-all cursor-pointer`}>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <span className="text-3xl">{template.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                      <p className="text-base text-gray-600">{template.desc}</p>
                    </div>
                    <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* もっと見るボタン */}
          <div className="mb-8">
            <Link href="/kantan/dashboard/text">
              <button className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold px-6 py-4 rounded-2xl transition-all">
                他のテンプレートを見る（68種類）
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </div>

          {/* 使い方ガイド */}
          <div className="bg-blue-50 rounded-2xl p-5 border-2 border-blue-100">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              使い方
            </h3>
            <div className="space-y-3">
              {[
                { num: '①', text: '上から作りたい文章を選ぶ' },
                { num: '②', text: '必要な情報を入力する' },
                { num: '③', text: '「作成する」ボタンを押す' },
              ].map((step, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xl font-bold text-blue-600 w-8">{step.num}</span>
                  <p className="text-base text-blue-800">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

