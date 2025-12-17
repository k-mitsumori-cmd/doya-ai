'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Check, ArrowLeft, Sparkles, Crown, Zap } from 'lucide-react'

export default function BannerPricingPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-purple-100">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/banner" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <span className="font-bold text-gray-800">ドヤバナーAI</span>
          </div>
        </div>
      </header>

      {/* メイン */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            料金プラン
          </h1>
          <p className="text-lg text-gray-600">
            あなたのビジネスに合ったプランをお選びください
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
          {/* 無料プラン */}
          <div className="bg-white rounded-2xl p-8 border-2 border-gray-200 shadow-sm">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-gray-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">無料プラン</h2>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">¥0</span>
                <span className="text-gray-500">/月</span>
              </div>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                '1日1枚まで生成（ゲスト）',
                '1日3枚まで生成（ログイン）',
                '全カテゴリ利用可能',
                '標準解像度出力',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {session ? (
              <Link href="/banner/dashboard">
                <button className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                  現在のプラン
                </button>
              </Link>
            ) : (
              <Link href="/banner/dashboard">
                <button className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                  無料で試す
                </button>
              </Link>
            )}
          </div>

          {/* プロプラン */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-300 shadow-lg relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="px-4 py-1 bg-purple-600 text-white text-sm font-bold rounded-full">
                おすすめ
              </span>
            </div>
            
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">プロプラン</h2>
              <div className="mt-4">
                <span className="text-4xl font-bold text-purple-600">¥9,980</span>
                <span className="text-gray-500">/月</span>
              </div>
            </div>
            
            <ul className="space-y-4 mb-8">
              {[
                '無制限に生成',
                '全カテゴリ利用可能',
                '高解像度出力',
                'ブランドカラー設定',
                '優先サポート',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-gray-700">
                  <Check className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              プロプランに登録
            </button>
            
            <p className="text-center text-sm text-gray-500 mt-4">
              いつでもキャンセル可能
            </p>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 text-center mb-8">よくある質問</h3>
          <div className="space-y-4">
            {[
              { q: '無料プランでどこまで使えますか？', a: 'ゲストは1日1枚、ログインすると1日3枚まで生成できます。' },
              { q: 'プロプランはいつでも解約できますか？', a: 'はい、いつでも解約可能です。解約後も期間終了まで利用できます。' },
              { q: '支払い方法は？', a: 'クレジットカード（Visa, Mastercard, JCB, AMEX）に対応しています。' },
            ].map((faq, i) => (
              <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
                <h4 className="font-bold text-gray-900 mb-2">{faq.q}</h4>
                <p className="text-gray-600 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

