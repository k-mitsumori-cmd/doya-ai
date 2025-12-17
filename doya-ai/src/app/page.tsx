'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowRight, 
  Sparkles, 
  Zap,
  Clock,
  Star,
  Play,
  ChevronRight,
} from 'lucide-react'
import { getAllServices } from '@/lib/services'

export default function PortalPage() {
  const { data: session } = useSession()
  const allServices = getAllServices()
  const activeServices = allServices.filter(s => s.status === 'active' || s.status === 'beta')

  return (
    <div className="min-h-screen bg-white">
      {/* ============================================
          Header - シンプル
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
                ドヤAI
              </span>
            </Link>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {session ? (
                <Link 
                  href="/kantan/dashboard" 
                  className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-bold rounded-full shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                >
                  ダッシュボード
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin" className="text-gray-600 hover:text-gray-900 text-sm font-medium hidden sm:block">
                    ログイン
                  </Link>
                  <Link 
                    href="/kantan/dashboard" 
                    className="px-5 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-bold rounded-full shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 transition-all"
                  >
                    無料で試す
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ============================================
          Hero - 超シンプル・すぐ使える
          ============================================ */}
      <section className="pt-28 pb-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 rounded-full text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            登録不要・今すぐ使える
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            文章もバナーも<br />
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
              AIで秒速
            </span>
            作成
          </h1>
          
          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            ログインなしで今すぐお試し。<br className="sm:hidden" />
            必要な文章やバナーを、AIがパパッと作ります。
          </p>
          
          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-6 sm:gap-10 mb-10 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-500" />
              <span className="text-gray-600"><strong className="text-gray-900">30秒</strong>で作成</span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-gray-600">満足度<strong className="text-gray-900">4.9</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-500" />
              <span className="text-gray-600"><strong className="text-gray-900">¥0</strong>から</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          Tool Cards - メイン
          ============================================ */}
      <section className="pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6">
            {/* カンタンドヤAI */}
            <Link href="/kantan/dashboard" className="group">
              <div className="relative h-full bg-gradient-to-br from-blue-500 to-cyan-400 rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/20">
                {/* Decorations */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                
                <div className="relative">
                  <span className="text-5xl mb-4 block">📝</span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    カンタンドヤAI
                  </h2>
                  <p className="text-white/80 mb-6">
                    メール、ブログ、SNS投稿...<br />
                    68種類のテンプレートで文章を自動作成
                  </p>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                      無料で1日3回
                    </div>
                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                      68テンプレート
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white font-bold">
                    今すぐ使ってみる
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>

            {/* ドヤバナーAI */}
            <Link href="/banner/dashboard" className="group">
              <div className="relative h-full bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-3xl p-6 sm:p-8 overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-violet-500/20">
                {/* Decorations */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full blur-xl" />
                
                {/* NEW Badge */}
                <div className="absolute top-4 right-4 px-3 py-1 bg-white text-violet-600 text-xs font-bold rounded-full shadow-lg">
                  NEW
                </div>
                
                <div className="relative">
                  <span className="text-5xl mb-4 block">🎨</span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                    ドヤバナーAI
                  </h2>
                  <p className="text-white/80 mb-6">
                    プロ品質のバナーを自動生成<br />
                    A/B/Cの3案を同時に作成
                  </p>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                      無料で1日1枚
                    </div>
                    <div className="px-3 py-1.5 bg-white/20 backdrop-blur rounded-lg text-white text-sm font-medium">
                      A/B/C 3案
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-white font-bold">
                    今すぐ使ってみる
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          How It Works - 3ステップ
          ============================================ */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
            使い方は<span className="text-violet-600">超カンタン</span>
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'ツールを選ぶ', desc: '文章かバナーか選択', icon: '👆' },
              { step: '2', title: '情報を入力', desc: 'テンプレに沿って入力', icon: '✍️' },
              { step: '3', title: '完成！', desc: 'AIが秒速で生成', icon: '🎉' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">{item.icon}</span>
                </div>
                <div className="w-8 h-8 bg-violet-500 text-white font-bold rounded-full flex items-center justify-center mx-auto mb-3">
                  {item.step}
                </div>
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Reviews - シンプル
          ============================================ */}
      <section className="py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            ユーザーの声
          </h2>
          <p className="text-center text-gray-600 mb-12">
            実際に使っている方からの評価
          </p>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { text: 'メール作成が10分→30秒に！毎日使ってます', name: 'T.S', role: '営業', rating: 5 },
              { text: 'バナー作成の外注費が月10万円削減できた', name: 'M.K', role: 'マーケター', rating: 5 },
              { text: 'ブログ記事のネタ切れがなくなった', name: 'Y.T', role: 'ライター', rating: 5 },
            ].map((review, i) => (
              <div key={i} className="bg-gray-50 rounded-2xl p-6">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4 text-sm leading-relaxed">"{review.text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {review.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{review.name}</p>
                    <p className="text-xs text-gray-500">{review.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Pricing - シンプル
          ============================================ */}
      <section className="py-16 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-4">
            料金プラン
          </h2>
          <p className="text-center text-gray-600 mb-12">
            まずは無料でお試し。気に入ったらアップグレード。
          </p>
          
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* 無料 */}
            <div className="bg-white rounded-2xl p-6 border-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">無料プラン</h3>
              <div className="text-3xl font-extrabold text-gray-900 mb-4">¥0</div>
              <ul className="space-y-3 mb-6">
                {['登録なしで使える', '文章: 1日3回', 'バナー: 1日1枚'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-gray-600 text-sm">
                    <span className="text-emerald-500">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/kantan/dashboard">
                <button className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                  無料で試す
                </button>
              </Link>
            </div>
            
            {/* プロ */}
            <div className="bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full blur-xl" />
              <div className="relative">
                <div className="inline-block px-2 py-1 bg-white/20 rounded text-xs font-bold mb-3">
                  おすすめ
                </div>
                <h3 className="text-lg font-bold mb-2">プロプラン</h3>
                <div className="text-3xl font-extrabold mb-1">¥2,980〜</div>
                <p className="text-white/70 text-sm mb-4">/月・サービス別</p>
                <ul className="space-y-3 mb-6">
                  {['使い放題 or 大幅増量', '履歴無制限保存', '優先サポート'].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-white/90 text-sm">
                      <span>✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signin">
                  <button className="w-full py-3 bg-white text-violet-600 font-bold rounded-xl hover:bg-white/90 transition-colors">
                    登録してアップグレード
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          Final CTA
          ============================================ */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 mb-4">
            今すぐ、無料で試してみよう
          </h2>
          <p className="text-gray-600 mb-8">
            登録不要・クレカ不要。<br />
            まずは使ってみて、良さを実感してください。
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/kantan/dashboard">
              <button className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-lg font-bold rounded-full shadow-xl shadow-violet-500/25 hover:shadow-2xl hover:shadow-violet-500/30 transition-all flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                文章を作成する
              </button>
            </Link>
            <Link href="/banner/dashboard">
              <button className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 text-lg font-bold rounded-full border-2 border-gray-200 hover:border-violet-300 hover:text-violet-600 transition-all flex items-center justify-center gap-2">
                <Play className="w-5 h-5" />
                バナーを作成する
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          Footer - ミニマル
          ============================================ */}
      <footer className="py-8 px-4 sm:px-6 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-700">ドヤAI</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/terms" className="hover:text-gray-700">利用規約</Link>
              <Link href="/privacy" className="hover:text-gray-700">プライバシー</Link>
              <a href="mailto:support@doya-ai.com" className="hover:text-gray-700">お問い合わせ</a>
            </div>
            
            <p className="text-sm text-gray-400">
              © 2025 ドヤAI
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
