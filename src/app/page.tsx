'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, Sparkles, Check, Star, Zap, Shield, Users } from 'lucide-react'
import { SERVICES } from '@/lib/services'

export default function PortalPage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* ヘッダー */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">ドヤAIポータル</span>
            </Link>
            
            <div className="flex items-center gap-4">
              {session ? (
                <>
                  <Link
                    href="/admin"
                    className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                  >
                    管理画面
                  </Link>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs text-white font-bold">
                      {session.user?.name?.[0] || 'U'}
                    </div>
                    <span className="text-sm text-slate-300">{session.user?.name}</span>
                  </div>
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="px-4 py-2 bg-white text-slate-900 rounded-lg font-medium hover:bg-slate-100 transition-colors"
                >
                  ログイン
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ヒーローセクション */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700/50 rounded-full text-slate-300 text-sm mb-6">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            AIツール統合プラットフォーム
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            ビジネスを加速する<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AIツール群
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            文章生成、バナー作成、LP制作…<br />
            あなたのビジネスに必要なAIツールがすべて揃っています。
          </p>
        </div>
      </section>

      {/* サービス一覧 */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            🛠️ 利用可能なサービス
          </h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            {SERVICES.map((service) => (
              <div
                key={service.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700 overflow-hidden hover:border-slate-500 transition-all group"
              >
                {/* サービスヘッダー */}
                <div className={`p-8 bg-gradient-to-br ${service.gradient} relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-black/20"></div>
                  <div className="relative">
                    <span className="text-5xl mb-4 block">{service.icon}</span>
                    <h3 className="text-2xl font-bold text-white mb-2">{service.name}</h3>
                    <p className="text-white/80">{service.description}</p>
                  </div>
                </div>

                {/* 機能一覧 */}
                <div className="p-6">
                  <ul className="space-y-3 mb-6">
                    {service.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-3 text-slate-300">
                        <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* 料金表示 */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="p-3 bg-slate-700/50 rounded-xl text-center">
                      <p className="text-xs text-slate-400 mb-1">{service.pricing.free.name}</p>
                      <p className="text-lg font-bold text-white">¥0</p>
                      <p className="text-xs text-slate-500">{service.pricing.free.limit}</p>
                    </div>
                    <div className="p-3 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl text-center">
                      <p className="text-xs text-blue-300 mb-1">{service.pricing.pro.name}</p>
                      <p className="text-lg font-bold text-white">¥{service.pricing.pro.price.toLocaleString()}<span className="text-sm font-normal">/月</span></p>
                      <p className="text-xs text-blue-400">{service.pricing.pro.limit}</p>
                    </div>
                  </div>

                  {/* CTAボタン */}
                  <Link href={service.href}>
                    <button className={`w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r ${service.gradient} hover:opacity-90 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-${service.color}-500/30`}>
                      {service.name}を使う
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            🚀 近日公開予定
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: '🖥️', name: 'ドヤLPAI', desc: 'LP自動生成' },
              { icon: '🎬', name: 'ドヤ動画AI', desc: '動画台本生成' },
              { icon: '📊', name: 'ドヤ資料AI', desc: 'プレゼン資料生成' },
            ].map((item, index) => (
              <div
                key={index}
                className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700 text-center opacity-60"
              >
                <span className="text-4xl mb-3 block">{item.icon}</span>
                <h3 className="font-bold text-white mb-1">{item.name}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
                <span className="inline-block mt-3 px-3 py-1 bg-slate-700 text-slate-400 text-xs rounded-full">
                  COMING SOON
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 信頼性 */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { icon: <Zap className="w-6 h-6" />, title: '高速生成', desc: '数秒で高品質な出力' },
              { icon: <Shield className="w-6 h-6" />, title: 'セキュア', desc: 'データは安全に保護' },
              { icon: <Users className="w-6 h-6" />, title: '10,000+ユーザー', desc: '多くの企業が導入' },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-700 flex items-center justify-center text-slate-300">
                  {item.icon}
                </div>
                <h3 className="font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-slate-700 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">ドヤAIポータル</span>
          </div>
          <p className="text-sm text-slate-500">
            © 2024 ドヤAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
