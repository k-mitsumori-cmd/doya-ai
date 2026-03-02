'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  ArrowRight,
  Sparkles,
  Check,
  FileText,
  Image as ImageIcon,
  Clock,
  Users,
  TrendingUp,
} from 'lucide-react'
import { SEO_PRICING, BANNER_PRICING } from '@/lib/pricing'

export default function TestPortalPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'seo' | 'banner'>('seo')

  return (
    <div className="min-h-screen bg-[#0f1629] text-white overflow-x-hidden">
      {/* ============================================
          Header
          ============================================ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0f1629]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">ドヤAI</span>
            </Link>

            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-white/70 hover:text-white transition-colors">機能</a>
              <a href="#pricing" className="text-sm text-white/70 hover:text-white transition-colors">料金</a>
            </nav>

            <div className="flex items-center gap-4">
              {!session && (
                <Link href="/auth/signin" className="text-sm text-white/70 hover:text-white transition-colors hidden sm:block">
                  ログイン
                </Link>
              )}
              <Link href="/seo">
                <button className="px-6 py-2.5 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">
                  {session ? 'ダッシュボード' : '無料で試す'}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================
          Hero Section
          ============================================ */}
      <section className="relative pt-32 lg:pt-40 pb-20 lg:pb-32 px-6 lg:px-8">
        {/* 背景グラデーション */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-violet-600/20 via-fuchsia-600/10 to-transparent rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* バッジ */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-8"
            >
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-sm text-white/80">登録不要で今すぐ使える</span>
            </motion.div>

            {/* メインコピー */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-8"
            >
              コンテンツ制作を
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400">
                AIで10倍速に。
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg lg:text-xl text-white/60 mb-12 max-w-2xl mx-auto leading-relaxed"
            >
              SEO記事20,000字を30秒で生成。バナーはA/B/C3案を同時作成。
              <br className="hidden sm:block" />
              マーケティングの生産性を劇的に向上させます。
            </motion.p>

            {/* CTAボタン */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row justify-center gap-4 mb-16"
            >
              <Link href="/seo">
                <button className="group w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  無料で今すぐ始める
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/banner">
                <button className="w-full sm:w-auto px-8 py-4 bg-white/5 border border-white/10 text-white font-semibold rounded-lg hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  バナーを作成する
                </button>
              </Link>
            </motion.div>

            {/* 実績数値 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-3 gap-8 max-w-2xl mx-auto"
            >
              {[
                { value: '30', unit: '秒', label: '平均生成時間' },
                { value: '20,000', unit: '字', label: '最大文字数' },
                { value: '3', unit: '案', label: '同時生成' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-3xl lg:text-5xl font-bold text-white">
                    {stat.value}
                    <span className="text-violet-400 text-xl lg:text-2xl ml-1">{stat.unit}</span>
                  </div>
                  <div className="text-sm text-white/50 mt-2">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================
          課題セクション
          ============================================ */}
      <section className="py-20 lg:py-32 px-6 lg:px-8 bg-[#0a0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 font-semibold mb-4">PROBLEMS</p>
            <h2 className="text-3xl lg:text-5xl font-bold">
              こんな課題、ありませんか？
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Clock className="w-6 h-6" />,
                title: 'SEO記事に時間がかかる',
                desc: 'リサーチ・構成・執筆で4〜8時間。本業に集中できない。',
                stat: '平均 4〜8時間',
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: 'バナー外注コストが高い',
                desc: '1枚5,000円〜。A/Bテスト用に複数作ると費用が膨らむ。',
                stat: '月 10万円以上',
              },
              {
                icon: <TrendingUp className="w-6 h-6" />,
                title: 'コンテンツが続かない',
                desc: '人手不足でマーケ施策が止まり、機会損失が発生。',
                stat: '更新停止率 70%',
              },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-8 hover:bg-white/[0.07] transition-colors"
              >
                <div className="w-12 h-12 bg-violet-500/10 border border-violet-500/20 rounded-xl flex items-center justify-center text-violet-400 mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-white/60 text-sm leading-relaxed mb-4">{item.desc}</p>
                <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">
                  {item.stat}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          ソリューションセクション（タブ切り替え）
          ============================================ */}
      <section id="features" className="py-20 lg:py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 font-semibold mb-4">SOLUTIONS</p>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              ドヤAIが全て解決
            </h2>
            <p className="text-white/60 text-lg">目的に合わせて2つのツールから選べます</p>
          </div>

          {/* タブ */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex bg-white/5 border border-white/10 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('seo')}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'seo'
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 inline mr-2" />
                SEO記事を作りたい
              </button>
              <button
                onClick={() => setActiveTab('banner')}
                className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'banner'
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4 inline mr-2" />
                バナーを作りたい
              </button>
            </div>
          </div>

          {/* タブコンテンツ */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl p-8 lg:p-12"
          >
            {activeTab === 'seo' ? (
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-block px-3 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm rounded-lg mb-6">
                    ドヤライティングAI
                  </div>
                  <h3 className="text-2xl lg:text-4xl font-bold mb-6">
                    SEO記事を<br />30秒で自動生成
                  </h3>
                  <p className="text-white/60 leading-relaxed mb-8">
                    キーワードを入力するだけで、SEO最適化されたアウトラインから本文まで一括生成。最大20,000字の長文記事にも対応。
                  </p>
                  <ul className="space-y-4 mb-8">
                    {['キーワードからアウトライン自動生成', '最大20,000字の本文一括生成', 'SEO最適化済みの構成'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/seo">
                    <button className="px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                      今すぐ記事を作成
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <video
                    src="https://storage.googleapis.com/studio-design-asset-files/projects/Jgqe2P25ak/s-1236x720_9090dae4-65f8-4060-a4ad-540e2bb40d80.mp4#t=0.01"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto"
                  />
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400 text-sm rounded-lg mb-6">
                    ドヤバナーAI
                    <span className="px-1.5 py-0.5 bg-fuchsia-500 text-white text-xs rounded">NEW</span>
                  </div>
                  <h3 className="text-2xl lg:text-4xl font-bold mb-6">
                    プロ品質バナーを<br />3案同時生成
                  </h3>
                  <p className="text-white/60 leading-relaxed mb-8">
                    商品情報を入力するだけで、A/B/C3パターンのバナーを自動生成。デザイナー不要でプロ品質のバナーが手に入ります。
                  </p>
                  <ul className="space-y-4 mb-8">
                    {['A/B/C 3パターン同時生成', '複数サイズ対応', '即ダウンロード可能'].map((item, i) => (
                      <li key={i} className="flex items-center gap-3 text-white/80">
                        <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link href="/banner">
                    <button className="px-6 py-3 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
                      今すぐバナーを作成
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
                <div className="rounded-2xl overflow-hidden border border-white/10">
                  <video
                    src="https://storage.googleapis.com/studio-design-asset-files/projects/Jgqe2P25ak/s-1216x720_9a24b0af-50e3-4f43-9db4-9537408d3552.mp4#t=0.01"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* ============================================
          使い方
          ============================================ */}
      <section className="py-20 lg:py-32 px-6 lg:px-8 bg-[#0a0f1f]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 font-semibold mb-4">HOW IT WORKS</p>
            <h2 className="text-3xl lg:text-5xl font-bold">
              3ステップで完成
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'ツールを選ぶ', desc: 'SEO記事かバナーを選択' },
              { step: '02', title: '情報を入力', desc: 'テンプレートに沿って入力' },
              { step: '03', title: '完成', desc: 'AIが30秒で自動生成' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-5xl lg:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-b from-violet-400 to-violet-400/20 mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-white/60">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================
          料金プラン
          ============================================ */}
      <section id="pricing" className="py-20 lg:py-32 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-violet-400 font-semibold mb-4">PRICING</p>
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              シンプルな料金体系
            </h2>
            <p className="text-white/60 text-lg">まずは無料でお試しください</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* 無料プラン */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-2">無料プラン</h3>
              <div className="text-4xl font-bold mb-6">
                ¥0
                <span className="text-lg text-white/50 font-normal ml-2">永久無料</span>
              </div>
              <ul className="space-y-4 mb-8">
                {[
                  '登録なしで今すぐ使える',
                  `SEO記事: ログイン${SEO_PRICING.freeLimit}回/月（無料）`,
                  `バナー: ${BANNER_PRICING.guestLimit}枚/月`,
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/70">
                    <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/seo" className="block">
                <button className="w-full py-4 bg-white/10 border border-white/20 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors">
                  無料で始める
                </button>
              </Link>
            </div>

            {/* プロプラン */}
            <div className="relative bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-500/30 rounded-2xl p-8">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-semibold rounded-full">
                おすすめ
              </div>
              <h3 className="text-xl font-semibold mb-2">プロプラン</h3>
              <div className="text-4xl font-bold mb-1">
                ¥9,980〜
              </div>
              <p className="text-white/50 text-sm mb-6">/月（税込）</p>
              <ul className="space-y-4 mb-8">
                {[
                  'SEO記事: 1日3回 / 20,000字',
                  'バナー: 1日30枚',
                  '優先サポート',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-white/80">
                    <Check className="w-5 h-5 text-violet-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signin" className="block">
                <button className="w-full py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity">
                  アップグレード
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          最終CTA
          ============================================ */}
      <section className="py-20 lg:py-32 px-6 lg:px-8 bg-gradient-to-b from-[#0a0f1f] to-[#0f1629]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            今すぐ始めよう
          </h2>
          <p className="text-white/60 text-lg mb-10">
            登録不要・クレジットカード不要。
            <br />
            30秒後にはあなたのコンテンツが完成しています。
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/seo">
              <button className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                無料で始める
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================
          Footer
          ============================================ */}
      <footer className="py-12 px-6 lg:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">ドヤAI</span>
            </div>
            <div className="flex items-center gap-8 text-sm text-white/50">
              <Link href="/terms" className="hover:text-white/80 transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-white/80 transition-colors">プライバシー</Link>
              <a href="mailto:support@doya-ai.com" className="hover:text-white/80 transition-colors">お問い合わせ</a>
            </div>
            <p className="text-sm text-white/40">© 2025 ドヤAI</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
