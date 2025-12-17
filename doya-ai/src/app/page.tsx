'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useState } from 'react'
import { 
  ArrowRight, 
  Sparkles, 
  Check, 
  Zap, 
  Shield, 
  Users,
  ChevronRight,
  ChevronDown,
  Play,
  Star,
  TrendingUp,
  Clock,
  Award,
  ArrowUpRight,
  MessageSquare,
  BarChart3,
  Menu,
  X,
  Target,
  Lightbulb,
  Rocket,
  Building2,
  UserCheck,
  Timer,
  BadgeCheck,
  HelpCircle,
  Mail,
  Phone,
} from 'lucide-react'
import { getAllServices, getActiveServices, type Service } from '@/lib/services'

// ============================================
// 導入企業（社会的証明）
// ============================================
const COMPANIES = [
  { name: 'TechCorp', industry: 'IT' },
  { name: 'Marketing Pro', industry: 'マーケティング' },
  { name: 'Global Trade', industry: '商社' },
  { name: 'Digital Agency', industry: '広告' },
  { name: 'StartUp Inc', industry: 'スタートアップ' },
  { name: 'EC Masters', industry: 'EC' },
]

// ============================================
// FAQ
// ============================================
const FAQS = [
  {
    q: '無料で使えますか？',
    a: 'はい、全サービスに無料プランがあります。クレジットカード登録不要で、Googleアカウントで今すぐ始められます。',
  },
  {
    q: '1つのアカウントで全サービス使えますか？',
    a: 'はい、1回のGoogleログインで全サービスにアクセスできます。サービスごとに個別にプラン選択が可能です。',
  },
  {
    q: 'いつでもキャンセルできますか？',
    a: 'はい、有料プランはいつでもキャンセル可能です。日割り返金はありませんが、期間終了まで利用できます。',
  },
  {
    q: '生成したコンテンツの著作権は？',
    a: '生成されたコンテンツの著作権はお客様に帰属します。商用利用も可能です。',
  },
  {
    q: 'データのセキュリティは？',
    a: 'すべてのデータは暗号化され、安全に保護されています。第三者への提供は一切行いません。',
  },
]

// ============================================
// ユースケース
// ============================================
const USE_CASES = [
  {
    icon: Building2,
    title: '営業・セールス',
    description: '提案書、メール、見積書を瞬時に作成。商談準備時間を80%削減。',
    tools: ['カンタンドヤAI'],
  },
  {
    icon: Target,
    title: 'マーケティング',
    description: 'バナー、SNS投稿、LP制作まで。広告運用を全自動化。',
    tools: ['ドヤバナーAI', 'カンタンドヤAI'],
  },
  {
    icon: Lightbulb,
    title: 'コンテンツ制作',
    description: 'ブログ記事、動画台本、プレゼン資料。アイデア出しから完成まで。',
    tools: ['カンタンドヤAI'],
  },
]

export default function PortalPage() {
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  
  const allServices = getAllServices()
  const activeServices = allServices.filter(s => s.status === 'active' || s.status === 'beta')
  const comingSoonServices = allServices.filter(s => s.status === 'coming_soon')

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-gradient-radial pointer-events-none" />
      <div className="fixed inset-0 bg-grid pointer-events-none opacity-30" />
      
      {/* ============================================
          Header
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-dark">
        <div className="container-main">
          <div className="h-16 md:h-20 flex items-center justify-between px-4 sm:px-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg glow-blue group-hover:scale-105 transition-transform">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold text-white">ドヤAI</span>
              </div>
            </Link>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {[
                { label: 'サービス', href: '#services' },
                { label: '導入事例', href: '#cases' },
                { label: '料金', href: '#pricing' },
                { label: 'よくある質問', href: '#faq' },
              ].map((item) => (
                <Link 
                  key={item.href}
                  href={item.href} 
                  className="text-slate-300 hover:text-white transition-colors text-sm font-medium"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            
            {/* Actions */}
            <div className="flex items-center gap-3">
              {session ? (
                <>
                  <Link href={activeServices[0]?.dashboardHref || '/dashboard'} className="btn-primary text-sm px-5 py-2.5">
                    ダッシュボード
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/auth/signin" className="btn-ghost text-sm hidden sm:flex">
                    ログイン
                  </Link>
                  <Link href="/auth/signin" className="btn-primary text-sm px-5 py-2.5">
                    無料で始める
                  </Link>
                </>
              )}
              
              {/* Mobile Menu Button */}
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
          
          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-slate-800 py-4 px-4 animate-fade-in">
              <nav className="flex flex-col gap-2">
                {[
                  { label: 'サービス', href: '#services' },
                  { label: '導入事例', href: '#cases' },
                  { label: '料金', href: '#pricing' },
                  { label: 'よくある質問', href: '#faq' },
                ].map((item) => (
                  <Link 
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-3 px-4 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
      </header>

      {/* ============================================
          Hero Section - 価値提案を明確に
          ============================================ */}
      <section className="relative pt-32 md:pt-40 pb-16 md:pb-24 overflow-hidden">
        <div className="container-main px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge - 具体的なベネフィット */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-sm text-slate-300">
                <strong className="text-white">作業時間を80%削減</strong> - 10,000社以上が導入
              </span>
            </div>
            
            {/* Headline - ターゲットを明確に */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.1] animate-fade-in-up">
              <span className="text-slate-400 text-2xl sm:text-3xl md:text-4xl block mb-2">
                営業・マーケター・クリエイターのための
              </span>
              <span className="text-gradient">AIビジネスツール</span>
            </h1>
            
            {/* Subheadline - 具体的な課題解決 */}
            <p className="text-lg sm:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-100">
              メール作成に30分？バナー制作に3日？
              <br />
              <strong className="text-white">ドヤAIなら、すべて数秒で完了。</strong>
            </p>
            
            {/* Value Props - 3つの数字 */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10 animate-fade-in-up animation-delay-200">
              {[
                { value: '80%', label: '時間削減' },
                { value: '¥0', label: 'から開始' },
                { value: '30秒', label: 'で登録完了' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-gradient">{item.value}</div>
                  <div className="text-xs sm:text-sm text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-300">
              <Link href="/auth/signin" className="btn-primary text-lg px-8 py-4 w-full sm:w-auto">
                <Sparkles className="w-5 h-5" />
                無料で始める
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#demo" className="btn-secondary text-lg px-8 py-4 w-full sm:w-auto">
                <Play className="w-5 h-5" />
                デモを見る（2分）
              </Link>
            </div>
            
            {/* No Credit Card Required */}
            <p className="text-sm text-slate-500 mt-6 animate-fade-in-up animation-delay-400">
              ✓ クレジットカード不要　✓ Googleアカウントで即開始　✓ いつでも解約OK
            </p>
          </div>
        </div>
      </section>

      {/* ============================================
          Social Proof - 導入企業ロゴ
          ============================================ */}
      <section className="py-12 border-y border-slate-800/50">
        <div className="container-main px-4 sm:px-6">
          <p className="text-center text-sm text-slate-500 mb-8">
            10,000社以上の企業・個人事業主に選ばれています
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 opacity-60">
            {COMPANIES.map((company, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-slate-400 font-medium">{company.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Demo Section - スクリーンショット/動画
          ============================================ */}
      <section id="demo" className="section">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-12">
            <span className="badge-primary mb-4">デモ</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              <span className="text-gradient">2分</span>で分かるドヤAI
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              実際の操作画面をご覧ください。誰でもすぐに使い始められます。
            </p>
          </div>
          
          {/* Demo Video/Screenshot Area */}
          <div className="relative max-w-4xl mx-auto">
            <div className="aspect-video rounded-2xl overflow-hidden border border-slate-700/50 bg-slate-900 shadow-2xl">
              {/* Mock Dashboard Preview */}
              <div className="h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-8">
                <div className="grid md:grid-cols-2 gap-4 h-full">
                  {activeServices.slice(0, 2).map((service, index) => (
                    <Link 
                      key={service.id} 
                      href={session ? service.dashboardHref : service.href}
                      className="group h-full"
                    >
                      <div className={`
                        relative p-6 rounded-xl border border-slate-700/50 h-full
                        bg-gradient-to-br ${service.gradient} 
                        transition-all duration-300 
                        group-hover:scale-[1.02] group-hover:shadow-xl
                      `}>
                        <div className="absolute inset-0 bg-black/30 rounded-xl" />
                        <div className="relative h-full flex flex-col">
                          <span className="text-4xl md:text-5xl mb-4">{service.icon}</span>
                          <h3 className="text-xl md:text-2xl font-bold text-white mb-2">
                            {service.name}
                          </h3>
                          <p className="text-white/70 text-sm md:text-base mb-4 flex-1">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 text-white/90 text-sm font-medium">
                            今すぐ試す
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
            
            {/* Play Button Overlay (for future video) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer">
                <Play className="w-8 h-8 text-white ml-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          Use Cases - ユースケース別訴求
          ============================================ */}
      <section id="cases" className="section bg-slate-900/50">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="badge-success mb-4">導入事例</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              こんな課題、ありませんか？
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              ドヤAIは、様々なビジネスシーンで活躍しています
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {USE_CASES.map((useCase, index) => (
              <div key={index} className="card-dark p-8 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <useCase.icon className="w-7 h-7 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{useCase.title}</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">{useCase.description}</p>
                <div className="flex flex-wrap gap-2">
                  {useCase.tools.map((tool, i) => (
                    <span key={i} className="px-3 py-1 text-xs rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Services Section - サービス一覧
          ============================================ */}
      <section id="services" className="section">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="badge-primary mb-4">サービス</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              必要なツールを、
              <span className="text-gradient">必要な分だけ</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              1アカウントで全サービスにアクセス。
              使いたいサービスだけプロプランに。無駄なコストゼロ。
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
                🚀 開発中のサービス
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

      {/* ============================================
          Stats Section
          ============================================ */}
      <section className="section bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="container-main relative px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              数字で見るドヤAI
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {[
              { value: '10,000+', label: '導入企業・個人', icon: Building2 },
              { value: '100万+', label: '総生成数', icon: Zap },
              { value: '99.9%', label: '稼働率', icon: Shield },
              { value: '4.9', label: '平均満足度', icon: Star },
            ].map((stat, index) => (
              <div key={index} className="p-6">
                <stat.icon className="w-8 h-8 mx-auto mb-4 text-white/70" />
                <div className="text-4xl md:text-5xl font-extrabold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-white/70 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Pricing Section
          ============================================ */}
      <section id="pricing" className="section">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="badge-warning mb-4">料金</span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              シンプルな料金体系
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              無料で始めて、必要に応じてアップグレード。
              サービスごとに個別選択可能。
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="card-dark p-8">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">無料プラン</h3>
                <div className="text-5xl font-extrabold text-white mb-2">¥0</div>
                <p className="text-slate-400">永久無料・制限あり</p>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  'Googleアカウントで即開始',
                  '全サービスにアクセス可能',
                  '1日の生成回数に制限',
                  'クレジットカード不要',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/signin" className="btn-secondary w-full py-4 justify-center">
                無料で始める
              </Link>
            </div>
            
            {/* Pro Plan */}
            <div className="card-dark p-8 border-2 border-blue-500/50 relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="badge-new px-4 py-1 text-sm">おすすめ</span>
              </div>
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">プロプラン</h3>
                <div className="text-5xl font-extrabold text-gradient mb-2">¥2,980〜</div>
                <p className="text-slate-400">サービスごとに選択可能</p>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  '無料プランの全機能',
                  '生成回数の大幅増加 or 無制限',
                  '高度な機能が解放',
                  '優先サポート',
                  '履歴の無制限保存',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/signin" className="btn-primary w-full py-4 justify-center">
                プロプランを始める
              </Link>
            </div>
          </div>
          
          <p className="text-center text-slate-500 mt-8 text-sm">
            ※ 料金はサービスにより異なります。詳細は各サービスページをご確認ください。
          </p>
        </div>
      </section>

      {/* ============================================
          Testimonials
          ============================================ */}
      <section className="section bg-slate-900/50">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="badge-success mb-4">お客様の声</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              導入企業の<span className="text-gradient">リアルな声</span>
            </h2>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: 'メール作成の時間が1/10に。営業チーム15名全員で毎日使っています。ROIは計り知れません。',
                author: '田中 太郎',
                role: '営業部長',
                company: 'IT企業（従業員200名）',
                result: '商談数 2.3倍',
                rating: 5,
              },
              {
                quote: 'バナー制作の外注費が月30万円削減。クオリティも社内デザイナーと遜色ありません。',
                author: '佐藤 花子',
                role: 'マーケティングマネージャー',
                company: 'ECサイト運営',
                result: '制作費 80%削減',
                rating: 5,
              },
              {
                quote: 'ブログ記事の作成が劇的に楽に。月10本の記事公開が可能になり、PVが3倍になりました。',
                author: '山田 一郎',
                role: 'コンテンツディレクター',
                company: 'Webメディア',
                result: 'PV 3倍増加',
                rating: 5,
              },
            ].map((testimonial, index) => (
              <div key={index} className="card-dark p-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 mb-4 leading-relaxed text-sm">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{testimonial.author}</div>
                    <div className="text-xs text-slate-400">{testimonial.role}</div>
                    <div className="text-xs text-slate-500">{testimonial.company}</div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-700">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">{testimonial.result}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          FAQ Section
          ============================================ */}
      <section id="faq" className="section">
        <div className="container-main px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="badge-primary mb-4">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              よくある質問
            </h2>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-4">
            {FAQS.map((faq, index) => (
              <div 
                key={index}
                className="card-dark overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4"
                >
                  <span className="font-semibold text-white">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6 text-slate-400 animate-fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          Final CTA
          ============================================ */}
      <section className="section">
        <div className="container-main px-4 sm:px-6">
          <div className="card-dark p-8 md:p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
                今日から、
                <span className="text-gradient">時間を取り戻そう</span>
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-2xl mx-auto">
                10,000社が選んだドヤAI。
                <br />
                無料で始めて、その効果を実感してください。
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/auth/signin" className="btn-primary text-lg px-10 py-4">
                  <Sparkles className="w-5 h-5" />
                  無料で始める
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
              <p className="text-slate-500 text-sm mt-6">
                ✓ 30秒で登録完了　✓ クレジットカード不要　✓ いつでも解約OK
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          Footer
          ============================================ */}
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
              <p className="text-slate-400 max-w-md leading-relaxed mb-6">
                ビジネスを加速するAIツール群。
                文章生成、バナー作成、LP制作など、
                必要なAIツールを1つのアカウントで。
              </p>
              <div className="flex items-center gap-4">
                <a href="mailto:support@doya-ai.com" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
                  <Mail className="w-4 h-4" />
                  お問い合わせ
                </a>
              </div>
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
                  <Link href="#pricing" className="text-slate-400 hover:text-white transition-colors text-sm">
                    料金プラン
                  </Link>
                </li>
                <li>
                  <Link href="#faq" className="text-slate-400 hover:text-white transition-colors text-sm">
                    よくある質問
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
              <Link href="#" className="hover:text-white transition-colors">特定商取引法</Link>
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
            {isLoggedIn ? '使ってみる' : '無料で始める'}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
        </Link>
      </div>
    </div>
  )
}
