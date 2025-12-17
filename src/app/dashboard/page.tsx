'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowRight, HelpCircle, Sparkles } from 'lucide-react'
import OnboardingModal from '@/components/OnboardingModal'
import { TOOLS } from '@/lib/tools'

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

  const activeTools = TOOLS.filter(tool => !tool.comingSoon)
  const comingSoonTools = TOOLS.filter(tool => tool.comingSoon)

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      <div className="min-h-full bg-white lg:bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {/* あいさつ */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              AIツール統合プラットフォーム
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              こんにちは、{userName}さん 👋
            </h1>
            <p className="text-lg text-gray-600">
              使いたいツールを選んでください
            </p>
          </div>

          {/* ツール一覧 */}
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">🛠️ 利用可能なツール</h2>
            <div className="grid gap-4">
              {activeTools.map((tool) => (
                <Link key={tool.id} href={tool.href}>
                  <div className="bg-white rounded-2xl p-5 border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 bg-gradient-to-br ${tool.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                        <span className="text-3xl">{tool.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-gray-900">
                            {tool.name}
                          </h3>
                          {tool.isNew && (
                            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        <p className="text-base text-gray-600 mt-1">{tool.description}</p>
                      </div>
                      <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Coming Soon */}
          {comingSoonTools.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">🚀 近日公開予定</h2>
              <div className="grid gap-3">
                {comingSoonTools.map((tool) => (
                  <div key={tool.id} className="bg-gray-100 rounded-2xl p-4 border-2 border-gray-200 opacity-70">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 bg-gradient-to-br ${tool.color} rounded-xl flex items-center justify-center flex-shrink-0 opacity-50`}>
                        <span className="text-2xl">{tool.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-600">
                            {tool.name}
                          </h3>
                          <span className="px-2 py-0.5 bg-gray-400 text-white text-xs font-bold rounded-full">
                            COMING SOON
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{tool.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 使い方ガイド */}
          <div className="bg-blue-50 rounded-2xl p-5 border-2 border-blue-100">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              使い方
            </h3>
            <div className="space-y-3">
              {[
                { num: '①', text: '使いたいツールを選ぶ' },
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
