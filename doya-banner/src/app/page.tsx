'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Sparkles, ArrowRight, Check, Zap, Image as ImageIcon, Clock, Shield, 
  ChevronRight, Star, Play, MousePointer, Layers, Palette, Target,
  TrendingUp, Users, Award, CheckCircle, ArrowDown
} from 'lucide-react'

// サンプルバナー画像（デモ用）
const SAMPLE_BANNERS = [
  { id: 1, label: 'A', type: 'ベネフィット訴求', color: 'from-blue-500 to-indigo-600' },
  { id: 2, label: 'B', type: '限定・緊急性', color: 'from-amber-500 to-orange-500' },
  { id: 3, label: 'C', type: '社会的証明', color: 'from-emerald-500 to-green-500' },
]

// 導入企業ロゴ（ダミー）
const COMPANY_LOGOS = [
  '株式会社A', '株式会社B', '株式会社C', '株式会社D', '株式会社E'
]

// お客様の声
const TESTIMONIALS = [
  {
    name: '田中 健太',
    role: 'マーケティング部長',
    company: '通信サービス会社',
    content: 'デザイナーに依頼すると3日かかっていたバナー制作が、ものの30秒で完成。クオリティも遜色なく、ABテストの回転率が劇的に向上しました。',
    avatar: '👨‍💼',
    rating: 5,
  },
  {
    name: '山田 美咲',
    role: 'EC事業責任者',
    company: 'アパレルEC',
    content: 'セール時のバナー差し替えが間に合わないことが多かったのですが、今は思い立ったらすぐに生成。売上に直結しています。',
    avatar: '👩‍💻',
    rating: 5,
  },
  {
    name: '佐藤 雄一',
    role: '広告運用担当',
    company: 'BtoBスタートアップ',
    content: '3案同時生成が神機能。「これだ！」というバナーが見つかる確率が格段に上がりました。月額以上の価値があります。',
    avatar: '👨‍🔧',
    rating: 5,
  },
]

// 機能一覧
const FEATURES = [
  {
    icon: Zap,
    title: 'ワンボタン生成',
    description: 'テンプレ選択→キーワード入力→生成。たった3ステップでプロ品質バナーが完成。',
    color: 'bg-amber-500',
  },
  {
    icon: Layers,
    title: 'A/B/C 3案同時',
    description: 'ベネフィット・緊急性・社会的証明の3パターンを自動生成。ABテストに最適。',
    color: 'bg-blue-500',
  },
  {
    icon: Palette,
    title: 'ブランドキット',
    description: 'ロゴ・カラー・フォント雰囲気を登録。ブランドガイドラインに沿った生成を実現。',
    color: 'bg-purple-500',
  },
  {
    icon: Target,
    title: '目的別最適化',
    description: 'CTR重視・CV重視・認知重視。目的に応じてレイアウトとコピーを最適化。',
    color: 'bg-emerald-500',
  },
  {
    icon: Clock,
    title: '履歴管理',
    description: '生成したバナーは自動保存。いつでもダウンロード・再生成が可能。',
    color: 'bg-rose-500',
  },
  {
    icon: Shield,
    title: '商用利用OK',
    description: '生成したバナーの著作権はお客様に帰属。広告・LP・SNSで自由に使用可能。',
    color: 'bg-indigo-500',
  },
]

// テンプレートカテゴリ
const CATEGORIES = [
  { icon: '📱', name: '通信向け', examples: ['格安SIM', '光回線', 'WiFi', '乗り換え'] },
  { icon: '📊', name: 'マーケティング', examples: ['リード獲得', 'ウェビナー', '資料DL'] },
  { icon: '🛒', name: 'EC向け', examples: ['セール', '新商品', 'キャンペーン'] },
  { icon: '👥', name: '採用向け', examples: ['求人', '説明会', 'インターン'] },
]

// サイズプリセット
const SIZE_PRESETS = [
  { name: '1080×1080', platform: 'Instagram/Facebook' },
  { name: '1200×628', platform: 'Facebook広告' },
  { name: '1080×1920', platform: 'ストーリーズ' },
  { name: '300×250', platform: 'ディスプレイ' },
]

export default function LandingPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0)

  useEffect(() => {
    if (session) {
      router.push('/app')
    }
  }, [session, router])

  // バナーサンプルの自動切り替え
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % SAMPLE_BANNERS.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-blue-200">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ===== ヘッダー ===== */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between">
            {/* ロゴ */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <span className="font-bold text-xl sm:text-2xl text-gray-900">ドヤバナー</span>
                <span className="hidden sm:inline text-xs text-gray-500 ml-2">by AI</span>
              </div>
            </div>

            {/* ナビゲーション */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">機能</a>
              <Link href="/guide" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">使い方ガイド</Link>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">料金</a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 font-medium transition-colors">お客様の声</a>
            </nav>

            {/* CTAボタン */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => signIn()}
                className="hidden sm:inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors"
              >
                ログイン
              </button>
              <button
                onClick={() => signIn()}
                className="btn-primary text-sm sm:text-base"
              >
                <span className="hidden sm:inline">無料で始める</span>
                <span className="sm:hidden">始める</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ===== ヒーローセクション ===== */}
        <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-24 overflow-hidden">
          {/* 背景装飾 */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-40" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-100 rounded-full blur-3xl opacity-40" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-blue-50 to-indigo-50 rounded-full blur-3xl opacity-30" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* 左側: テキスト */}
              <div className="text-center lg:text-left">
                {/* バッジ */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 text-blue-700 text-sm font-medium mb-6 animate-fade-in-down">
                  <Zap className="w-4 h-4" />
                  AIが3案を自動生成
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">NEW</span>
                </div>

                {/* メインタイトル */}
                <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-gray-900 leading-tight mb-6 animate-fade-in-up">
                  ワンボタンで<br />
                  <span className="gradient-text">プロ品質</span>
                  <span className="text-gray-900">バナー</span>
                </h1>

                {/* サブタイトル */}
                <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0 animate-fade-in-up delay-100">
                  テンプレートを選んでキーワードを入力するだけ。<br className="hidden sm:block" />
                  AIがA/B/Cの3案を瞬時に生成。<br className="hidden sm:block" />
                  デザイナー不要で広告運用を加速。
                </p>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-6 animate-fade-in-up delay-200">
                  <button
                    onClick={() => signIn()}
                    className="btn-primary text-lg px-8 py-4 shadow-xl shadow-blue-500/30 animate-pulse-glow"
                  >
                    <Sparkles className="w-5 h-5" />
                    無料で始める
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <a
                    href="#how-it-works"
                    className="btn-secondary text-lg px-8 py-4"
                  >
                    <Play className="w-5 h-5" />
                    使い方を見る
                  </a>
                </div>

                {/* 信頼性バッジ */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-gray-500 animate-fade-in-up delay-300">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    クレジットカード不要
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    1日1枚無料
                  </span>
                  <span className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    30秒で登録完了
                  </span>
                </div>
              </div>

              {/* 右側: デモビジュアル */}
              <div className="relative animate-fade-in-up delay-200">
                <div className="relative">
                  {/* メインカード */}
                  <div className="relative bg-white rounded-3xl shadow-2xl shadow-gray-200/50 border border-gray-100 p-6 sm:p-8">
                    {/* ヘッダー */}
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">生成結果</p>
                        <h3 className="text-lg font-bold text-gray-900">格安SIM 乗り換えキャンペーン</h3>
                      </div>
                      <div className="badge-success">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        完了
                      </div>
                    </div>

                    {/* 3つのバナーサンプル */}
                    <div className="grid grid-cols-3 gap-3 sm:gap-4">
                      {SAMPLE_BANNERS.map((banner, index) => (
                        <div
                          key={banner.id}
                          className={`relative aspect-square rounded-xl overflow-hidden transition-all duration-500 ${
                            currentBannerIndex === index 
                              ? 'ring-4 ring-blue-500 ring-offset-2 scale-105 shadow-lg' 
                              : 'opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${banner.color}`}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-2">
                              <span className="text-2xl sm:text-3xl font-bold mb-1">{banner.label}</span>
                              <span className="text-[10px] sm:text-xs text-center opacity-90">{banner.type}</span>
                            </div>
                          </div>
                          {currentBannerIndex === index && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* アクションボタン */}
                    <div className="flex gap-3 mt-6">
                      <button className="flex-1 btn-primary text-sm">
                        <MousePointer className="w-4 h-4" />
                        ダウンロード
                      </button>
                      <button className="flex-1 btn-secondary text-sm">
                        再生成
                      </button>
                    </div>
                  </div>

                  {/* 装飾: フローティングバッジ */}
                  <div className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 bg-gradient-to-br from-amber-400 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg animate-bounce-subtle">
                    ⚡ 30秒で完成
                  </div>

                  {/* 装飾: 統計 */}
                  <div className="absolute -bottom-4 -left-4 sm:-bottom-6 sm:-left-6 bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 animate-float">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">生成成功率</p>
                        <p className="text-lg font-bold text-gray-900">99.8%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* スクロールダウン */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden lg:block">
            <a href="#features" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowDown className="w-6 h-6" />
            </a>
          </div>
        </section>

        {/* ===== 導入企業（信頼性） ===== */}
        <section className="py-12 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500 mb-8">多くの企業様にご利用いただいています</p>
            <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
              {COMPANY_LOGOS.map((company, index) => (
                <div 
                  key={index} 
                  className="text-gray-300 font-bold text-lg"
                >
                  {company}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 機能セクション ===== */}
        <section id="features" className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* セクションヘッダー */}
            <div className="text-center mb-16">
              <span className="badge-primary mb-4">Features</span>
              <h2 className="section-title mb-4">
                なぜ<span className="gradient-text">ドヤバナー</span>が選ばれるのか
              </h2>
              <p className="section-subtitle max-w-2xl mx-auto">
                広告運用者・マーケターのバナー制作の悩みを解決する、6つの強力な機能
              </p>
            </div>

            {/* 機能グリッド */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {FEATURES.map((feature, index) => (
                <div
                  key={index}
                  className="card-hover group"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 使い方セクション ===== */}
        <section id="how-it-works" className="py-20 sm:py-28 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white relative overflow-hidden">
          {/* 背景装飾 */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-1/4 left-0 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-0 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* セクションヘッダー */}
            <div className="text-center mb-16">
              <span className="badge bg-white/10 text-blue-300 mb-4">How it works</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
                たった<span className="text-blue-400">3ステップ</span>で完成
              </h2>
              <p className="text-lg text-blue-200 max-w-2xl mx-auto">
                複雑な操作は一切不要。誰でも30秒でプロ品質のバナーを作成できます
              </p>
            </div>

            {/* ステップ */}
            <div className="grid md:grid-cols-3 gap-8 sm:gap-12">
              {[
                {
                  step: 1,
                  title: 'テンプレートを選ぶ',
                  description: '通信・マーケ・EC・採用など、業種・目的に合ったテンプレートを選択',
                  icon: Layers,
                },
                {
                  step: 2,
                  title: 'キーワードを入力',
                  description: '訴求したいキャッチコピーやキーワードを入力。短い言葉でOK',
                  icon: Target,
                },
                {
                  step: 3,
                  title: 'ボタンを押すだけ',
                  description: 'AIがA/B/Cの3案を自動生成。お好みのバナーをダウンロード',
                  icon: Sparkles,
                },
              ].map((item, index) => (
                <div key={index} className="text-center relative">
                  {/* コネクター（デスクトップのみ） */}
                  {index < 2 && (
                    <div className="hidden md:block absolute top-8 left-[calc(50%+40px)] w-[calc(100%-80px)] h-0.5 bg-gradient-to-r from-blue-500 to-transparent" />
                  )}
                  
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                      <item.icon className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold shadow-lg">
                      {item.step}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-blue-200">{item.description}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center mt-16">
              <button
                onClick={() => signIn()}
                className="inline-flex items-center gap-3 bg-white text-blue-600 font-bold px-8 py-4 rounded-xl hover:bg-blue-50 transition-all shadow-xl text-lg"
              >
                <Sparkles className="w-5 h-5" />
                今すぐ試してみる
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>

        {/* ===== テンプレート紹介 ===== */}
        <section className="py-20 sm:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="badge-primary mb-4">Templates</span>
              <h2 className="section-title mb-4">豊富なテンプレート</h2>
              <p className="section-subtitle max-w-2xl mx-auto">
                業種・目的に最適化されたテンプレートで、高品質を保証
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {CATEGORIES.map((category, index) => (
                <div key={index} className="card-hover text-center p-8">
                  <span className="text-5xl block mb-4">{category.icon}</span>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{category.name}</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {category.examples.map((example, i) => (
                      <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                        {example}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* サイズプリセット */}
            <div className="mt-12 text-center">
              <p className="text-sm text-gray-500 mb-4">対応サイズ</p>
              <div className="flex flex-wrap justify-center gap-3">
                {SIZE_PRESETS.map((size, index) => (
                  <span key={index} className="px-4 py-2 bg-gray-100 rounded-lg text-sm">
                    <span className="font-semibold text-gray-900">{size.name}</span>
                    <span className="text-gray-500 ml-2">{size.platform}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== お客様の声 ===== */}
        <section id="testimonials" className="py-20 sm:py-28 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="badge-primary mb-4">Testimonials</span>
              <h2 className="section-title mb-4">お客様の声</h2>
              <p className="section-subtitle max-w-2xl mx-auto">
                すでに多くの企業様にご利用いただいています
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((testimonial, index) => (
                <div key={index} className="card bg-white relative">
                  {/* 星評価 */}
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* コメント */}
                  <p className="text-gray-700 leading-relaxed mb-6">
                    "{testimonial.content}"
                  </p>

                  {/* ユーザー情報 */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{testimonial.name}</p>
                      <p className="text-sm text-gray-500">{testimonial.role} / {testimonial.company}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== 料金セクション ===== */}
        <section id="pricing" className="py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <span className="badge-primary mb-4">Pricing</span>
              <h2 className="section-title mb-4">シンプルな料金プラン</h2>
              <p className="section-subtitle max-w-2xl mx-auto">
                まずは無料でお試し。納得してからプロプランへ。
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* 無料プラン */}
              <div className="card border-2 border-gray-200 relative">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">無料プラン</h3>
                <p className="text-gray-500 mb-6">まずはお試し</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-gray-900">¥0</span>
                  <span className="text-gray-500">/月</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {['1日1枚まで生成', '全テンプレート利用可', 'A/B/C 3案生成', '履歴保存', 'ダウンロード無制限'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => signIn()}
                  className="w-full btn-secondary text-lg py-4"
                >
                  無料で始める
                </button>
              </div>

              {/* プロプラン */}
              <div className="card border-2 border-blue-500 relative bg-gradient-to-br from-blue-50 to-indigo-50">
                {/* おすすめバッジ */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    おすすめ
                  </span>
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-2">プロプラン</h3>
                <p className="text-gray-500 mb-6">ヘビーユーザー向け</p>
                <div className="mb-8">
                  <span className="text-5xl font-bold text-gray-900">¥9,980</span>
                  <span className="text-gray-500">/月</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {['無制限に生成', 'ブランドキット設定', '高速生成', '優先サポート', '新機能の先行アクセス'].map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-gray-700">
                      <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => signIn()}
                  className="w-full btn-primary text-lg py-4"
                >
                  プロプランを始める
                </button>
              </div>
            </div>

            {/* 安心バッジ */}
            <div className="mt-12 text-center">
              <div className="inline-flex flex-wrap justify-center items-center gap-6 text-gray-500">
                <span className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  いつでもキャンセルOK
                </span>
                <span className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  安全なStripe決済
                </span>
                <span className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  商用利用OK
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== 最終CTA ===== */}
        <section className="py-20 sm:py-28 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white relative overflow-hidden">
          {/* 背景装飾 */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          </div>

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              今すぐドヤれるバナーを作ろう
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
              登録は30秒。今日から1枚無料で生成できます。<br />
              デザイナー不要で、広告運用を次のレベルへ。
            </p>
            <button
              onClick={() => signIn()}
              className="inline-flex items-center gap-3 bg-white text-blue-600 font-bold px-10 py-5 rounded-xl hover:bg-blue-50 transition-all shadow-2xl text-xl"
            >
              <Sparkles className="w-6 h-6" />
              無料で始める
              <ArrowRight className="w-6 h-6" />
            </button>
            <p className="mt-6 text-blue-200 text-sm">
              ✓ クレジットカード不要　✓ 1日1枚無料　✓ 30秒で登録完了
            </p>
          </div>
        </section>
      </main>

      {/* ===== フッター ===== */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* ロゴ & 説明 */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-white">ドヤバナー</span>
              </div>
              <p className="text-gray-400 mb-6 max-w-md">
                AIを活用してワンボタンでプロ品質のバナーを自動生成。
                広告運用者・マーケターの業務効率化を支援します。
              </p>
            </div>

            {/* リンク */}
            <div>
              <h4 className="font-bold text-white mb-4">サービス</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">機能</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">料金</a></li>
                <li><a href="#testimonials" className="hover:text-white transition-colors">お客様の声</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-white mb-4">法的情報</h4>
              <ul className="space-y-2">
                <li><Link href="/terms" className="hover:text-white transition-colors">利用規約</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">プライバシーポリシー</Link></li>
                <li><Link href="/legal" className="hover:text-white transition-colors">特定商取引法に基づく表記</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-sm">© 2024 ドヤバナー All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
