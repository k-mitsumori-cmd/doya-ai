'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, HelpCircle } from 'lucide-react'
import OnboardingModal from '@/components/OnboardingModal'

// 人気テンプレート（わかりやすい6つ）
const templates = [
  { 
    id: 'business-email', 
    name: 'ビジネスメール', 
    icon: '📧', 
    desc: '丁寧なメールを作成',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400 active:bg-blue-100',
  },
  { 
    id: 'blog-article', 
    name: 'ブログ記事', 
    icon: '📝', 
    desc: '読みやすい記事を作成',
    color: 'bg-green-50 border-green-200 hover:border-green-400 active:bg-green-100',
  },
  { 
    id: 'instagram-caption', 
    name: 'SNS投稿', 
    icon: '📱', 
    desc: 'SNS用の投稿文を作成',
    color: 'bg-purple-50 border-purple-200 hover:border-purple-400 active:bg-purple-100',
  },
  { 
    id: 'catchcopy', 
    name: 'キャッチコピー', 
    icon: '✨', 
    desc: '魅力的なキャッチコピー',
    color: 'bg-yellow-50 border-yellow-200 hover:border-yellow-400 active:bg-yellow-100',
  },
  { 
    id: 'meeting-minutes', 
    name: '議事録', 
    icon: '📋', 
    desc: '会議の議事録を作成',
    color: 'bg-orange-50 border-orange-200 hover:border-orange-400 active:bg-orange-100',
  },
  { 
    id: 'proposal-document', 
    name: '提案書', 
    icon: '📑', 
    desc: '企画提案書を作成',
    color: 'bg-pink-50 border-pink-200 hover:border-pink-400 active:bg-pink-100',
  },
]

export default function DashboardPage() {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(' ')[0] || 'ゲスト'
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    // 初回訪問時にオンボーディングを表示
    const hasSeenOnboarding = localStorage.getItem('onboarding_completed')
    if (!hasSeenOnboarding) {
      setShowOnboarding(true)
    }
  }, [])

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
    <div className="min-h-full bg-white lg:bg-gray-50">
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
            <Link key={template.id} href={`/dashboard/text/${template.id}`}>
              <div className={`${template.color} rounded-2xl p-5 border-2 transition-all cursor-pointer`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-3xl">{template.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900">
                      {template.name}
                    </h3>
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
          <Link href="/dashboard/text">
            <button className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-lg font-bold px-6 py-4 rounded-2xl transition-all min-h-[56px]">
              他のテンプレートを見る
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
          <Link href="/guide" className="block mt-4">
            <button className="w-full py-3 text-blue-600 hover:text-blue-700 font-bold rounded-xl border-2 border-blue-200 hover:bg-blue-100 transition-colors flex items-center justify-center gap-2">
              詳しい使い方を見る
              <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </div>
    </div>
    </>
  )
}
