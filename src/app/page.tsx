'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { ArrowRight, Check, ArrowUpRight } from 'lucide-react'

// taste-skill Design Read:
// B2B SaaS landing for Japanese SMB marketing teams,
// clean/minimal language, Tailwind + Noto Sans JP.
// VARIANCE: 7 / MOTION: 5 / DENSITY: 3

const SERVICES = [
  {
    name: 'ドヤ記事作成',
    tagline: 'SEO記事を、30秒で。',
    desc: 'キーワードひとつで最大20,000字のSEO記事を自動生成。構成案から本文まで一括で仕上がります。',
    icon: '🧠',
    href: '/seo',
    span: 'md:col-span-2 md:row-span-2',
    featured: true,
    tinted: false,
  },
  {
    name: 'ドヤバナーAI',
    desc: 'プロ品質のバナーをA/B/C 3案同時生成',
    icon: '🎨',
    href: '/banner',
    tinted: true,
  },
  {
    name: 'ドヤコピーAI',
    desc: '広告コピー・キャッチコピーを大量生成',
    icon: '✍️',
    href: '/copy',
  },
  {
    name: 'ドヤインタビュー',
    desc: '音声からプロ品質のインタビュー記事を自動生成',
    icon: '🎙️',
    href: '/interview',
  },
  {
    name: 'ドヤワイヤーフレームAI',
    desc: 'LP構成・ワイヤーフレームを1分で設計',
    icon: '📄',
    href: '/lp',
    tinted: true,
  },
  {
    name: 'ドヤペルソナAI',
    desc: 'URLからターゲットペルソナを自動分析・生成',
    icon: '🎯',
    href: '/persona',
  },
  {
    name: 'ドヤムービーAI',
    desc: '動画広告を10分で企画・制作',
    icon: '🎬',
    href: '/movie',
  },
  {
    name: 'ドヤボイスAI',
    desc: 'プロ品質の音声コンテンツを数秒で生成',
    icon: '🔊',
    href: '/voice',
  },
  {
    name: 'ドヤHR',
    desc: 'タレントマネジメント。評価・1on1を効率化',
    icon: '👥',
    href: '/hr',
  },
]

export default function DoyaMarkePage() {
  const { data: session } = useSession()

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-900 antialiased">

      {/* ── Header ── max-h 64px, single line */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-zinc-100">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="h-16 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold tracking-tight">
              ドヤマーケ
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <a href="#tools" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">ツール</a>
              <a href="#pricing" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">料金</a>
            </nav>
            <div className="flex items-center gap-3">
              {!session && (
                <Link href="/auth/signin" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors hidden sm:block">
                  ログイン
                </Link>
              )}
              <Link href={session ? '/seo' : '/auth/signin'}>
                <button className="px-5 py-2 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors active:scale-[0.98]">
                  {session ? 'ダッシュボード' : '無料ではじめる'}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero: Asymmetric left-aligned, max 4 text elements ── */}
      <section className="pt-20 lg:pt-24 pb-16 lg:pb-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="max-w-xl">
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl md:text-6xl font-bold tracking-tighter leading-none mb-6"
              >
                マーケティングを、
                <br />
                もっとシンプルに。
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-base text-zinc-500 leading-relaxed max-w-[65ch] mb-8"
              >
                コンテンツ制作、デザイン、分析、動画、人事まで。
                9のプロフェッショナルツールが、ひとつのプランで使えます。
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link href={session ? '/seo' : '/auth/signin'}>
                  <button className="group w-full sm:w-auto px-7 py-3.5 bg-[#7f19e6] text-white font-medium rounded-full hover:bg-[#6b15c4] transition-colors active:scale-[0.98] flex items-center justify-center gap-2">
                    無料ではじめる
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </Link>
                <a href="#pricing">
                  <button className="w-full sm:w-auto px-7 py-3.5 border border-zinc-200 text-zinc-700 font-medium rounded-full hover:border-zinc-300 hover:bg-zinc-50 transition-all active:scale-[0.98]">
                    料金を見る
                  </button>
                </a>
              </motion.div>
            </div>

            {/* Right: stats in vertical stack */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="hidden lg:flex flex-col gap-8 pl-12 border-l border-zinc-200"
            >
              {[
                { value: '11', label: 'プロフェッショナルツール' },
                { value: '¥9,980', label: '月額で全サービスPRO' },
                { value: '¥0', label: 'から始められる' },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-4xl font-bold tracking-tight">{stat.value}</div>
                  <div className="text-sm text-zinc-400 mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Bento Grid: 2-3 cells tinted for visual diversity ── */}
      <section id="tools" className="pb-24 lg:pb-32 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SERVICES.map((service, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{
                  duration: 0.6,
                  delay: Math.min(i * 0.06, 0.3),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={service.span || ''}
              >
                <Link href={service.href} className="block h-full">
                  <div
                    className={`group relative rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 h-full ${
                      service.featured
                        ? 'p-8 lg:p-10 bg-zinc-900 text-white'
                        : service.tinted
                          ? 'p-6 bg-violet-50 border border-violet-100'
                          : 'p-6 bg-white border border-zinc-200/80'
                    }`}
                  >
                    {service.featured ? (
                      <>
                        <div className="flex items-start justify-between mb-8">
                          <span className="text-4xl">{service.icon}</span>
                          <ArrowUpRight className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                        </div>
                        <h3 className="text-2xl lg:text-3xl font-bold tracking-tight mb-3">{service.name}</h3>
                        <p className="text-lg text-zinc-300 mb-3">{service.tagline}</p>
                        <p className="text-sm text-zinc-400 leading-relaxed">{service.desc}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-2xl">{service.icon}</span>
                          <ArrowUpRight className="w-4 h-4 text-zinc-300 group-hover:text-[#7f19e6] transition-colors" />
                        </div>
                        <h3 className="font-semibold mb-1.5">{service.name}</h3>
                        <p className="text-sm text-zinc-500 leading-relaxed">{service.desc}</p>
                      </>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── One Plan: left-aligned text + right stat, not 3-equal-cards ── */}
      <section className="py-24 lg:py-32 px-6 border-t border-zinc-100">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-5 gap-12 lg:gap-20 items-start">
            <div className="lg:col-span-2">
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl lg:text-4xl font-bold tracking-tighter leading-none mb-4"
              >
                ひとつのプランで、
                <br />
                すべてが手に入る
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-base text-zinc-500 leading-relaxed max-w-[65ch]"
              >
                ツールごとに契約する必要はありません。プロプランひとつで全11サービスのPRO機能が解放されます。
                新しいサービスが追加されても、追加料金なしで自動的に利用可能になります。
              </motion.p>
            </div>

            <div className="lg:col-span-3">
              <div className="grid sm:grid-cols-2 gap-px bg-zinc-200 rounded-2xl overflow-hidden">
                {[
                  { title: '全サービスPRO', body: '11ツールすべてのPRO機能を利用可能' },
                  { title: 'コスト削減', body: '個別契約なら月数万円が¥9,980に' },
                  { title: '自動解放', body: '新サービスは追加料金なしで即利用' },
                  { title: '1アカウント', body: 'Googleログインで全サービスにアクセス' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.3 }}
                    transition={{
                      duration: 0.6,
                      delay: i * 0.06,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="bg-white p-6 lg:p-8"
                  >
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-sm text-zinc-500">{item.body}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing: asymmetric 2-col (pro highlighted), not 3 equal cards ── */}
      <section id="pricing" className="py-24 lg:py-32 px-6 bg-white">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tighter leading-none mb-4">
              料金プラン
            </h2>
            <p className="text-base text-zinc-500 max-w-[65ch]">
              まずは無料でお試しください。プロプランなら全サービスのPRO機能が使えます。
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Free */}
            <div className="lg:col-span-4 border border-zinc-200 rounded-2xl p-8">
              <p className="text-sm font-medium text-zinc-400 mb-6">無料プラン</p>
              <div className="text-4xl font-bold tracking-tight mb-1">¥0</div>
              <p className="text-sm text-zinc-400 mb-8">永久無料</p>
              <ul className="space-y-3 mb-8">
                {[
                  '全ツールの基本機能',
                  'サービスごとに回数制限',
                  '登録なしで利用可能',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <Check className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/seo" className="block">
                <button className="w-full py-3 border border-zinc-200 text-zinc-700 font-medium rounded-full hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-[0.98] text-sm">
                  無料ではじめる
                </button>
              </Link>
            </div>

            {/* Pro: larger, highlighted */}
            <div className="lg:col-span-5 relative border-2 border-[#7f19e6] rounded-2xl p-8 lg:p-10 bg-gradient-to-b from-violet-50/40 to-white">
              <div className="absolute -top-3.5 left-6 px-4 py-1 bg-[#7f19e6] text-white text-xs font-medium rounded-full">
                おすすめ
              </div>
              <p className="text-sm font-medium text-[#7f19e6] mb-6">プロプラン</p>
              <div className="text-5xl font-bold tracking-tight mb-1">¥9,980</div>
              <p className="text-sm text-zinc-400 mb-8">/月（税込）</p>
              <ul className="space-y-3 mb-8">
                {[
                  '全9サービスがPROに',
                  '大幅に増えた利用回数',
                  '新サービスも自動解放',
                  '優先サポート',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                    <Check className="w-4 h-4 text-[#7f19e6] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/signin" className="block">
                <button className="w-full py-3 bg-[#7f19e6] text-white font-medium rounded-full hover:bg-[#6b15c4] transition-colors active:scale-[0.98] text-sm">
                  プロプランに申し込む
                </button>
              </Link>
            </div>

            {/* Enterprise: compact */}
            <div className="lg:col-span-3 border border-zinc-200 rounded-2xl p-8">
              <p className="text-sm font-medium text-zinc-400 mb-6">エンタープライズ</p>
              <div className="text-4xl font-bold tracking-tight mb-1">要相談</div>
              <p className="text-sm text-zinc-400 mb-8">チーム・法人向け</p>
              <ul className="space-y-3 mb-8">
                {[
                  '全サービス無制限',
                  '専用サポート担当',
                  'カスタムAPI連携',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-600">
                    <Check className="w-4 h-4 text-zinc-400 flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <a href="mailto:support@doya-ai.com" className="block">
                <button className="w-full py-3 border border-zinc-200 text-zinc-700 font-medium rounded-full hover:bg-zinc-50 hover:border-zinc-300 transition-all active:scale-[0.98] text-sm">
                  お問い合わせ
                </button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA: full-width dark band ── */}
      <section className="py-20 lg:py-24 px-6 bg-zinc-900">
        <div className="max-w-[1400px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-white tracking-tighter leading-none mb-4">
                今すぐ始めよう
              </h2>
              <p className="text-base text-zinc-400 max-w-[65ch]">
                登録不要、クレジットカード不要。すべてのツールを無料で体験できます。
              </p>
            </div>
            <div className="flex lg:justify-end">
              <Link href={session ? '/seo' : '/auth/signin'}>
                <button className="group px-8 py-4 bg-white text-zinc-900 font-medium rounded-full hover:bg-zinc-100 transition-colors active:scale-[0.98] inline-flex items-center gap-2">
                  無料ではじめる
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-8 px-6 border-t border-zinc-200">
        <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-tight">ドヤマーケ</span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-400">
            <Link href="/terms" className="hover:text-zinc-600 transition-colors">利用規約</Link>
            <Link href="/privacy" className="hover:text-zinc-600 transition-colors">プライバシー</Link>
            <Link href="/tokushoho" className="hover:text-zinc-600 transition-colors">特定商取引法</Link>
            <a href="mailto:support@doya-ai.com" className="hover:text-zinc-600 transition-colors">お問い合わせ</a>
          </div>
          <p className="text-xs text-zinc-400">2025 ドヤAI</p>
        </div>
      </footer>
    </div>
  )
}
