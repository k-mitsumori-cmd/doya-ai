'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { ArrowRight, Sparkles, Check, Star, Zap, Shield, Users, Lock } from 'lucide-react'
import { getAllServices, getActiveServices, type Service } from '@/lib/services'

export default function PortalPage() {
  const { data: session } = useSession()
  
  // サービスを取得
  const allServices = getAllServices()
  const activeServices = allServices.filter(s => s.status === 'active' || s.status === 'beta')
  const comingSoonServices = allServices.filter(s => s.status === 'coming_soon')

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
                    <span className="text-sm text-slate-300 hidden sm:inline">{session.user?.name}</span>
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
            {allServices.length}種類のAIツールを1アカウントで
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
            ビジネスを加速する<br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              AIツール群
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            文章生成、バナー作成、LP制作…<br />
            1つのアカウントで全サービスを利用可能。
          </p>
          
          {/* 統一アカウントの説明 */}
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl">
            <Lock className="w-5 h-5 text-blue-400" />
            <span className="text-blue-300 text-sm font-medium">
              1回のログインで全サービス利用可能 • サービスごとにプラン選択
            </span>
          </div>
        </div>
      </section>

      {/* サービス一覧（アクティブ） */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-4">
            🛠️ 利用可能なサービス
          </h2>
          <p className="text-slate-400 text-center mb-10">
            各サービスは独立した料金プラン。必要なものだけ選んで利用できます。
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {activeServices.map((service) => (
              <ServiceCard key={service.id} service={service} isLoggedIn={!!session} />
            ))}
          </div>
        </div>
      </section>

      {/* Coming Soon */}
      {comingSoonServices.length > 0 && (
        <section className="pb-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold text-white text-center mb-4">
              🚀 近日公開予定
            </h2>
            <p className="text-slate-400 text-center mb-10">
              続々と新サービスが追加されます
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {comingSoonServices.map((service) => (
                <div
                  key={service.id}
                  className="p-6 bg-slate-800/30 rounded-2xl border border-slate-700 text-center opacity-70 hover:opacity-90 transition-opacity"
                >
                  <span className="text-4xl mb-3 block">{service.icon}</span>
                  <h3 className="font-bold text-white mb-1">{service.name}</h3>
                  <p className="text-sm text-slate-400 mb-3">{service.description}</p>
                  <span className="inline-block px-3 py-1 bg-slate-700 text-slate-400 text-xs rounded-full">
                    {service.badge || 'COMING SOON'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 1アカウントのメリット */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white text-center mb-10">
            ✨ 1アカウントで全サービス
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { 
                icon: <Lock className="w-6 h-6" />, 
                title: '1回のログイン', 
                desc: 'Googleアカウントで全サービスにアクセス' 
              },
              { 
                icon: <Zap className="w-6 h-6" />, 
                title: 'サービス別プラン', 
                desc: '使いたいサービスだけプロプランに' 
              },
              { 
                icon: <Shield className="w-6 h-6" />, 
                title: '一元管理', 
                desc: '全サービスの履歴・設定を一括管理' 
              },
            ].map((item, index) => (
              <div key={index} className="text-center p-6 bg-slate-800/30 rounded-2xl border border-slate-700">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  {item.icon}
                </div>
                <h3 className="font-bold text-white mb-1">{item.title}</h3>
                <p className="text-sm text-slate-400">{item.desc}</p>
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

      {/* CTA */}
      <section className="pb-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-3xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              今すぐ始めよう
            </h2>
            <p className="text-slate-400 mb-6">
              無料で始められます。Googleアカウントで簡単登録。
            </p>
            {session ? (
              <div className="space-y-3">
                <p className="text-green-400 font-medium">✓ ログイン中: {session.user?.email}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {activeServices.map((service) => (
                    <Link key={service.id} href={service.dashboardHref}>
                      <button className={`px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r ${service.gradient} hover:opacity-90 transition-all flex items-center gap-2`}>
                        <span>{service.icon}</span>
                        {service.shortName || service.name}
                      </button>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link href="/auth/signin">
                <button className="px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-all flex items-center gap-2 mx-auto">
                  <Sparkles className="w-5 h-5" />
                  無料でアカウント作成
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-slate-700 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">ドヤAIポータル</span>
          </div>
          
          {/* サービスリンク */}
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            {activeServices.map((service) => (
              <Link 
                key={service.id} 
                href={service.href}
                className="text-slate-400 hover:text-white text-sm transition-colors"
              >
                {service.name}
              </Link>
            ))}
            <Link href="/admin" className="text-slate-400 hover:text-white text-sm transition-colors">
              管理画面
            </Link>
          </div>
          
          <p className="text-sm text-slate-500 text-center">
            © 2024 ドヤAI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

// サービスカード コンポーネント
function ServiceCard({ service, isLoggedIn }: { service: Service; isLoggedIn: boolean }) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-3xl border border-slate-700 overflow-hidden hover:border-slate-500 transition-all group">
      {/* サービスヘッダー */}
      <div className={`p-8 bg-gradient-to-br ${service.gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <span className="text-5xl">{service.icon}</span>
            {service.isNew && (
              <span className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                NEW
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{service.name}</h3>
          <p className="text-white/80">{service.description}</p>
        </div>
      </div>

      {/* 機能一覧 */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {service.features.slice(0, 5).map((feature, index) => (
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
            <p className="text-lg font-bold text-white">
              ¥{service.pricing.pro.price.toLocaleString()}
              <span className="text-sm font-normal">/月</span>
            </p>
            <p className="text-xs text-blue-400">{service.pricing.pro.limit}</p>
          </div>
        </div>

        {/* CTAボタン */}
        <Link href={isLoggedIn ? service.dashboardHref : service.href}>
          <button className={`w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r ${service.gradient} hover:opacity-90 transition-all flex items-center justify-center gap-2 group-hover:shadow-lg`}>
            {isLoggedIn ? `${service.shortName || service.name}を使う` : `${service.name}を見る`}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>
      </div>
    </div>
  )
}
