'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sparkles, ArrowRight, Check, Crown } from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session) {
      router.push('/dashboard')
    }
  }, [session, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-6" />
          <p className="text-gray-700 text-xl">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ヘッダー */}
      <header className="bg-white border-b-2 border-gray-100 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">カンタンドヤAI</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/guide"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              使い方
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              料金
            </Link>
            <button
              onClick={() => signIn()}
              className="text-base font-bold text-blue-600 hover:text-blue-700 px-4 py-2 rounded-xl hover:bg-blue-50 transition-colors"
            >
              ログイン
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-3xl mx-auto px-4">
        {/* ヒーローセクション */}
        <section className="text-center py-12 lg:py-16">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
            文章作成が<br />
            <span className="text-blue-600">カンタン</span>になる
          </h1>
          
          <p className="text-xl text-gray-700 mb-10 leading-relaxed">
            テンプレートを選んで<br />
            情報を入れるだけ。<br />
            AIが文章を作ります。
          </p>

          <button
            onClick={() => signIn()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xl font-bold px-10 py-5 rounded-2xl shadow-lg transition-all min-h-[60px]"
          >
            <Sparkles className="w-6 h-6" />
            無料で始める
            <ArrowRight className="w-6 h-6" />
          </button>

          <p className="mt-5 text-base text-gray-600">
            ✓ 登録無料　✓ クレジットカード不要
          </p>
        </section>

        {/* 3ステップ */}
        <section className="py-12 border-t-2 border-gray-100">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            使い方はカンタン
          </h2>

          <div className="space-y-4">
            {[
              { step: '1', title: '選ぶ', desc: '作りたい文章の種類を選ぶ', color: 'bg-blue-600' },
              { step: '2', title: '入力する', desc: '必要な情報を入力する', color: 'bg-green-600' },
              { step: '3', title: '完成！', desc: 'ボタンを押すと文章ができる', color: 'bg-orange-500' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5">
                <div className={`w-14 h-14 ${item.color} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <span className="text-2xl font-bold text-white">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{item.title}</h3>
                  <p className="text-base text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* できること */}
        <section className="py-12 border-t-2 border-gray-100">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            こんな文章が作れます
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '📧', name: 'ビジネスメール' },
              { icon: '📝', name: 'お知らせ文' },
              { icon: '📋', name: '提案書' },
              { icon: '📱', name: 'SNS投稿' },
              { icon: '✨', name: 'キャッチコピー' },
              { icon: '📄', name: 'ブログ記事' },
            ].map((item, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-xl p-4 text-center"
              >
                <span className="text-4xl block mb-2">{item.icon}</span>
                <p className="text-base font-bold text-gray-900">{item.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 料金 */}
        <section className="py-12 border-t-2 border-gray-100">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            料金プラン
          </h2>

          <div className="space-y-4">
            {/* 無料プラン */}
            <div className="bg-gray-50 rounded-2xl p-6 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">無料プラン</h3>
                  <p className="text-base text-gray-600">まずはお試し</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">¥0</p>
              </div>
              <ul className="space-y-2 mb-5">
                {['1日10回まで生成', '全68テンプレート', '履歴保存'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-base text-gray-700">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => signIn()}
                className="w-full py-4 bg-white border-2 border-gray-300 hover:bg-gray-100 text-gray-900 font-bold rounded-xl transition-colors text-lg min-h-[56px]"
              >
                無料で始める
              </button>
            </div>

            {/* プレミアムプラン */}
            <div className="bg-blue-600 rounded-2xl p-6 text-white relative">
              <div className="absolute -top-3 left-4 bg-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <Crown className="w-4 h-4" />
                おすすめ
              </div>
              <div className="flex items-center justify-between mb-4 mt-2">
                <div>
                  <h3 className="text-xl font-bold">プレミアム</h3>
                  <p className="text-base opacity-90">たくさん使いたい方</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">¥2,980</p>
                  <p className="text-sm opacity-80">/月</p>
                </div>
              </div>
              <ul className="space-y-2 mb-5">
                {['1日100回まで生成', '全テンプレート使い放題', '優先サポート'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-base">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/pricing">
                <button className="w-full py-4 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-colors text-lg min-h-[56px]">
                  プレミアムを始める
                </button>
              </Link>
            </div>
          </div>

          <p className="text-center mt-4 text-gray-500">
            <Link href="/pricing" className="text-blue-600 hover:underline">
              料金の詳細を見る →
            </Link>
          </p>
        </section>

        {/* 最終CTA */}
        <section className="py-12 border-t-2 border-gray-100">
          <div className="text-center bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">
              今すぐ始めましょう
            </h2>
            <p className="text-lg mb-6 opacity-90">
              面倒な文章作成から解放されます
            </p>
            <button
              onClick={() => signIn()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-white text-blue-600 font-bold px-10 py-5 rounded-2xl hover:bg-blue-50 transition-colors shadow-lg text-xl min-h-[60px]"
            >
              <Sparkles className="w-6 h-6" />
              無料で始める
              <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </section>
      </main>

      {/* フッター */}
      <footer className="bg-gray-100 py-8 mt-8">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">カンタンドヤAI</span>
          </div>
          <p className="text-base text-gray-600">© 2024 カンタンドヤAI</p>
        </div>
      </footer>
    </div>
  )
}
