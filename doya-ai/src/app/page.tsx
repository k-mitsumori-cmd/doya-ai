'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { 
  ArrowRight, 
  Sparkles, 
  Check, 
  Zap, 
  Shield, 
  Users,
  ChevronRight,
  Play,
  Star,
  TrendingUp,
  Clock,
  Award,
  ArrowUpRight,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import { getAllServices, getActiveServices, type Service } from '@/lib/services'

export default function PortalPage() {
  const { data: session } = useSession()
  
  const allServices = getAllServices()
  const activeServices = allServices.filter(s => s.status === 'active' || s.status === 'beta')
  const comingSoonServices = allServices.filter(s => s.status === 'coming_soon')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-50" />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-dark">
        <div className="container-main">
          <div className="h-16 md:h-20 flex items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg glow-blue group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-white">ドヤAI</span>
                <span className="text-xl font-light text-slate-400 ml-1">Portal</span>
              </div>
            </Link>
            
            <nav className="hidden md:flex items-center gap-8">
              <Link href="#services" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                サービス
              </Link>
              <Link href="#features" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                特徴
              </Link>
              <Link href="#pricing" className="text-slate-300 hover:text-white transition-colors text-sm font-medium">
                料金
              </Link>
            </nav>
            
            <div className="flex items-center gap-3">
              {session ? (
                <>
                  <Link href="/admin" className="btn-ghost text-sm hidden sm:flex">
                    管理画面
                  </Link>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-xs font-bold">
                      {session.user?.name?.[0] || 'U'}
                    </div>
                    <span className="text-sm text-slate-300 hidden sm:inline max-w-[100px] truncate">
                      {session.user?.name}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Link href="/auth/signin" className="btn-ghost text-sm">
                    ログイン
                  </Link>
                  <Link href="/auth/signin" className="btn-primary text-sm px-5 py-2.5">
                    無料で始める
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 md:pt-40 pb-20 md:pb-32 overflow-hidden">
        <div className="container-main px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-slate-300">
                {allServices.length}種類のAIツールを1アカウントで
              </span>
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.1] animate-fade-in-up">
              ビジネスを加速する
              <br />
              <span className="text-gradient">AIツール群</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-100">
              文章生成、バナー作成、LP制作。
              <br className="hidden sm:inline" />
              あなたのビジネスに必要なAIが、ここに揃っています。
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-200">
              <Link href="/auth/signin" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto">
                <Sparkles className="w-5 h-5" />
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#services" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto">
                <Play className="w-5 h-5" />
                サービスを見る
              </Link>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-12 animate-fade-in-up animation-delay-300">
              {[
                { icon: Users, label: '10,000+ ユーザー' },
                { icon: Zap, label: '100万+ 生成' },
                { icon: Star, label: '4.9 評価' },
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-2 text-slate-400">
                  <item.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Hero Visual */}
        <div className="mt-16 md:mt-24 px-4 sm:px-6">
          <div className="container-main">
            <div className="relative rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl animate-fade-in-up animation-delay-400">
              {/* Mock Dashboard Preview */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-8">
                <div className="grid md:grid-cols-3 gap-4">
                  {activeServices.map((service, index) => (
                    <Link 
                      key={service.id} 
                      href={service.dashboardHref}
                      className="group"
                    >
                      <div className={`
                        relative p-6 rounded-xl border border-slate-700/50 
                        bg-gradient-to-br ${service.gradient} 
                        transition-all duration-300 
                        group-hover:scale-[1.02] group-hover:shadow-xl
                      `}>
                        <div className="absolute inset-0 bg-black/30 rounded-xl" />
                        <div className="relative">
                          <span className="text-4xl mb-3 block">{service.icon}</span>
                          <h3 className="text-xl font-bold text-white mb-1">
                            {service.name}
                          </h3>
                          <p className="text-white/70 text-sm mb-4">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                            今すぐ使う
                            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                          </div>
                        </div>
                        {service.isNew && (
                          <span className="absolute top-4 right-4 badge-new">NEW</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="section bg-slate-900/50">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="badge-primary mb-4">サービス</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              あなたのビジネスを
              <span className="text-gradient">加速</span>
              するツール
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              1つのアカウントで全サービスにアクセス。
              必要なサービスだけプロプランに。
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {activeServices.map((service, index) => (
              <ServiceCard key={service.id} service={service} index={index} isLoggedIn={!!session} />
            ))}
          </div>
          
          {/* Coming Soon */}
          {comingSoonServices.length > 0 && (
            <div className="mt-16">
              <h3 className="text-xl font-bold text-center mb-8 text-slate-400">
                🚀 Coming Soon
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {comingSoonServices.map((service) => (
                  <div 
                    key={service.id}
                    className="card-dark p-6 text-center opacity-60 hover:opacity-80 transition-opacity"
                  >
                    <span className="text-4xl mb-3 block">{service.icon}</span>
                    <h4 className="font-bold text-white mb-1">{service.name}</h4>
                    <p className="text-sm text-slate-400 mb-3">{service.description}</p>
                    <span className="badge bg-slate-700 text-slate-300">
                      {service.badge || '準備中'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="badge-primary mb-4">特徴</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              なぜ
              <span className="text-gradient">ドヤAI</span>
              が選ばれるのか
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: '高速生成',
                description: '最新のAIモデルで、数秒で高品質なコンテンツを生成。作業時間を大幅に削減。',
                color: 'from-blue-500 to-cyan-500',
              },
              {
                icon: Shield,
                title: 'セキュア',
                description: 'エンタープライズグレードのセキュリティ。データは暗号化され、安全に保護。',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: BarChart3,
                title: '使いやすさ',
                description: '直感的なUIで、誰でもすぐに使い始められる。専門知識は不要。',
                color: 'from-purple-500 to-pink-500',
              },
            ].map((feature, index) => (
              <div 
                key={index} 
                className="card-dark p-8 text-center group"
              >
                <div className={`
                  w-16 h-16 mx-auto mb-6 rounded-2xl
                  bg-gradient-to-br ${feature.color}
                  flex items-center justify-center
                  group-hover:scale-110 transition-transform duration-300
                  shadow-lg
                `}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="container-main relative">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: '10,000+', label: 'アクティブユーザー' },
              { value: '100万+', label: '総生成数' },
              { value: '99.9%', label: '稼働率' },
              { value: '4.9', label: '平均評価' },
            ].map((stat, index) => (
              <div key={index}>
                <div className="text-4xl md:text-5xl font-extrabold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-white/70 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <div className="container-main">
          <div className="text-center mb-16">
            <span className="badge-success mb-4">お客様の声</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              多くの企業に
              <span className="text-gradient">選ばれています</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'メール作成の時間が1/10に。営業チーム全員で使っています。',
                author: '田中様',
                role: '営業部長 / IT企業',
                rating: 5,
              },
              {
                quote: 'バナー制作費が月30万円削減。クオリティも申し分なし。',
                author: '佐藤様',
                role: 'マーケティング / EC',
                rating: 5,
              },
              {
                quote: 'ブログ記事の作成が劇的に楽になりました。SEO効果も上々。',
                author: '山田様',
                role: 'コンテンツ担当 / メディア',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <div key={index} className="card-dark p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-4 leading-relaxed">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-white">{testimonial.author}</div>
                    <div className="text-sm text-slate-400">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section">
        <div className="container-main">
          <div className="card-dark p-8 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                今すぐ
                <span className="text-gradient">ドヤAI</span>
                を始めよう
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
                無料で始められます。クレジットカード不要。
                <br />
                1分で登録完了。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/signin" className="btn-primary text-lg px-10 py-4">
                  <Sparkles className="w-5 h-5" />
                  無料アカウント作成
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-slate-500 text-sm mt-6">
                ✓ 無料プランあり　✓ いつでもキャンセル可能　✓ 日本語サポート
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12 px-4 sm:px-6">
        <div className="container-main">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            {/* Logo & Description */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-white">ドヤAI</span>
              </Link>
              <p className="text-slate-400 max-w-md leading-relaxed">
                ビジネスを加速するAIツール群。
                文章生成、バナー作成、LP制作など、
                必要なAIツールを1つのアカウントで。
              </p>
            </div>
            
            {/* Services */}
            <div>
              <h4 className="font-semibold text-white mb-4">サービス</h4>
              <ul className="space-y-2">
                {activeServices.map((service) => (
                  <li key={service.id}>
                    <Link href={service.href} className="text-slate-400 hover:text-white transition-colors text-sm">
                      {service.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Links */}
            <div>
              <h4 className="font-semibold text-white mb-4">リンク</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="/admin" className="text-slate-400 hover:text-white transition-colors text-sm">
                    管理画面
                  </Link>
                </li>
                <li>
                  <Link href="/auth/signin" className="text-slate-400 hover:text-white transition-colors text-sm">
                    ログイン
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © 2024 ドヤAI. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="#" className="hover:text-white transition-colors">プライバシーポリシー</Link>
              <Link href="#" className="hover:text-white transition-colors">利用規約</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ============================================
// Service Card Component
// ============================================
function ServiceCard({ service, index, isLoggedIn }: { service: Service; index: number; isLoggedIn: boolean }) {
  return (
    <div 
      className="card-dark overflow-hidden group animate-fade-in-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Header */}
      <div className={`p-8 bg-gradient-to-br ${service.gradient} relative overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <span className="text-5xl">{service.icon}</span>
            {service.isNew && <span className="badge-new">NEW</span>}
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">{service.name}</h3>
          <p className="text-white/80">{service.description}</p>
        </div>
      </div>
      
      {/* Features */}
      <div className="p-6">
        <ul className="space-y-3 mb-6">
          {service.features.slice(0, 4).map((feature, i) => (
            <li key={i} className="flex items-center gap-3 text-slate-300">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
        
        {/* Pricing */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-4 bg-slate-800/50 rounded-xl text-center border border-slate-700/50">
            <p className="text-xs text-slate-400 mb-1">{service.pricing.free.name}</p>
            <p className="text-xl font-bold text-white">¥0</p>
            <p className="text-xs text-slate-500">{service.pricing.free.limit}</p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-xl text-center border border-blue-500/30">
            <p className="text-xs text-blue-300 mb-1">{service.pricing.pro.name}</p>
            <p className="text-xl font-bold text-white">
              ¥{service.pricing.pro.price.toLocaleString()}
              <span className="text-sm font-normal text-slate-400">/月</span>
            </p>
            <p className="text-xs text-blue-400">{service.pricing.pro.limit}</p>
          </div>
        </div>
        
        {/* CTA */}
        <Link href={isLoggedIn ? service.dashboardHref : service.href}>
          <button className={`
            w-full py-4 rounded-xl font-bold text-white 
            bg-gradient-to-r ${service.gradient} 
            hover:opacity-90 transition-all duration-300
            flex items-center justify-center gap-2
            group-hover:shadow-lg
          `}>
            {isLoggedIn ? `${service.shortName || service.name}を使う` : '詳細を見る'}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>
      </div>
    </div>
  )
}
