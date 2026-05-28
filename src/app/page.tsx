'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Briefcase,
  Check,
  Clapperboard,
  Database,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Mic,
  Route,
  ShieldCheck,
  Users,
  Volume2,
} from 'lucide-react'

type Service = {
  name: string
  href: string
  desc: string
  Icon: LucideIcon
  span?: string
  tone?: 'dark' | 'tint'
}

const SERVICES: Service[] = [
  { name: 'ドヤ記事作成', href: '/seo', desc: 'SEO最適化された長文記事を30秒で自動生成。最大20,000字まで対応します。', Icon: FileText, span: 'md:col-span-2 md:row-span-2', tone: 'dark' },
  { name: 'ドヤバナーAI', href: '/banner', desc: 'プロ品質のバナーをA/B/C 3案同時生成。', Icon: ImageIcon, tone: 'tint' },
  { name: 'ドヤコピーAI', href: '/copy', desc: '広告コピーとキャッチコピーを大量生成。', Icon: Megaphone },
  { name: 'ドヤインタビュー', href: '/interview', desc: '音声からプロ品質のインタビュー記事を自動生成。', Icon: Mic },
  { name: 'ドヤワイヤーフレームAI', href: '/lp', desc: 'LP構成とワイヤーフレームを1分で設計。', Icon: LayoutTemplate, tone: 'tint' },
  { name: 'ドヤペルソナAI', href: '/persona', desc: 'URLからターゲットペルソナを自動分析。', Icon: Users },
  { name: 'ドヤムービーAI', href: '/movie', desc: '動画広告を10分で企画、制作。', Icon: Clapperboard },
  { name: 'ドヤボイスAI', href: '/voice', desc: 'プロ品質の音声コンテンツを数秒で生成。', Icon: Volume2 },
  { name: 'ドヤHR', href: '/hr', desc: 'AI搭載タレントマネジメント。評価と1on1を効率化。', Icon: Briefcase },
]

const HERO_STATS = [
  { value: '9', label: 'アクティブサービス' },
  { value: '¥9,980', label: '全サービスPRO' },
  { value: '¥0', label: '登録不要で開始' },
]

const QUICK_PATHS = [
  { title: '記事とSEOを整える', body: '検索流入を増やす長文記事を、構成から本文まで作成。', href: '/seo', Icon: FileText },
  { title: '広告素材をまとめて作る', body: 'コピー、バナー、動画の初稿を同じ流れで用意。', href: '/banner', Icon: Megaphone },
  { title: 'ターゲットを明確にする', body: 'URLからペルソナを分析し、LPや施策に接続。', href: '/persona', Icon: Users },
]

const PLATFORM_POINTS = [
  { title: '制作テーマを見つける', body: 'URL、商材、顧客像から、次に作るべき記事やLPの方向性を整理します。', Icon: Database },
  { title: '施策に変換する', body: '記事、コピー、バナー、動画、音声まで、必要なアウトプットを同じ画面から作れます。', Icon: Route },
  { title: '成果を見ながら続ける', body: '中小企業の少人数チームでも、制作と改善の流れを止めずに回せます。', Icon: BarChart3 },
]

const PLAN_POINTS = ['全9サービスがPROに', '新サービスも追加料金なし', '個別課金なし', 'ひとつのアカウントで利用']

export default function DoyaMarkePage() {
  const { data: session } = useSession()
  const primaryHref = session ? '/seo' : '/auth/signin'

  return (
    <div className="min-h-[100dvh] bg-stone-50 text-zinc-900 antialiased">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #hs-web-interactives-top-anchor,
            [id^='hs-overlay-cta'],
            iframe[src*='hs-web-interactive'] {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
            }
          `,
        }}
      />
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="text-lg font-bold tracking-tight">ドヤマーケ</Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#tools" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">機能</a>
            <a href="#platform" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">選ばれる理由</a>
            <a href="#pricing" className="text-sm text-zinc-500 transition-colors hover:text-zinc-900">料金</a>
          </nav>
          <div className="flex items-center gap-3">
            {!session && <Link href="/auth/signin" className="hidden text-sm text-zinc-500 transition-colors hover:text-zinc-900 sm:block">ログイン</Link>}
            <a href="#tools" className="hidden rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-zinc-700 transition-all duration-300 hover:border-zinc-300 hover:bg-zinc-50 lg:inline-flex">サービス一覧</a>
            <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-zinc-800 active:scale-[0.98]">
              {session ? 'ダッシュボード' : '無料ではじめる'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[calc(100dvh-120px)] overflow-hidden bg-white px-5 pb-8 pt-12 sm:pt-16 lg:min-h-[calc(100dvh-96px)] lg:px-8 lg:pb-12 lg:pt-24">
          <div className="mx-auto grid max-w-[1400px] items-center gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
            <div className="max-w-xl">
              <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }} className="mb-5 text-sm font-semibold text-[#7f19e6]">
                AIマーケティングプラットフォーム
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06, ease: [0.16, 1, 0.3, 1] }} className="mb-6 text-4xl font-bold leading-none tracking-tighter md:text-6xl">
                マーケ施策を
                <br />
                ひとつの場所から。
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12, ease: [0.16, 1, 0.3, 1] }} className="mb-8 max-w-[65ch] text-base leading-relaxed text-zinc-500">
                記事、バナー、コピー、LP、ペルソナまで。中小企業のマーケ施策を、ひとつのプランで前に進めます。
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.18, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-3 sm:flex-row">
                <Link href={primaryHref} className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#7f19e6] px-7 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:bg-[#6812c5] active:scale-[0.98]">
                  無料ではじめる
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <a href="#pricing" className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-7 py-3.5 text-sm font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg active:scale-[0.98]">
                  料金を見る
                </a>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24, ease: [0.16, 1, 0.3, 1] }} className="mt-10 hidden max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 sm:grid">
                {HERO_STATS.map((stat) => (
                  <div key={stat.label} className="bg-stone-50 px-4 py-4">
                    <div className="text-lg font-bold tracking-tight text-zinc-900 md:text-2xl">{stat.value}</div>
                    <div className="mt-1 text-xs leading-snug text-zinc-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.72, delay: 0.16, ease: [0.16, 1, 0.3, 1] }} className="relative">
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_32px_100px_rgba(39,39,42,0.12)]">
                <Image src="/doyamarke/hero-growth.png" alt="ドヤマーケの統合マーケティング画面イメージ" width={1800} height={841} priority sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-[16/9] h-auto w-full object-cover" />
              </div>
              <div className="absolute right-5 top-5 hidden rounded-2xl border border-white/70 bg-white/88 p-4 shadow-lg backdrop-blur md:block">
                <div className="mb-1 text-2xl font-bold tracking-tight text-zinc-900">A/B/C</div>
                <p className="max-w-44 text-xs leading-relaxed text-zinc-500">バナーやコピーは複数案を同時に比較できます。</p>
              </div>
              <div className="absolute bottom-5 left-5 hidden rounded-2xl border border-zinc-200 bg-white/92 p-4 shadow-lg backdrop-blur md:block">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#7f19e6]" />
                  <span className="text-sm font-semibold">全9サービスを統合</span>
                </div>
                <p className="max-w-56 text-sm leading-relaxed text-zinc-500">個別契約なしで、制作から改善まで同じプランで使えます。</p>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="border-y border-zinc-200 bg-stone-50 px-5 py-5 lg:px-8">
          <div className="mx-auto grid max-w-[1400px] gap-3 lg:grid-cols-3">
            {QUICK_PATHS.map((path, index) => {
              const Icon = path.Icon

              return (
                <motion.div key={path.title} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.5, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}>
                  <Link href={path.href} className="group grid min-h-32 grid-cols-[auto_1fr_auto] items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-[#7f19e6]"><Icon className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-semibold text-zinc-900">{path.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-zinc-500">{path.body}</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-[#7f19e6]" />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>

        <section id="tools" className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-10 grid gap-5 lg:grid-cols-[0.8fr_1fr] lg:items-end">
              <h2 className="text-4xl font-bold leading-none tracking-tighter md:text-6xl">
                9つの制作ツールを
                <br />
                まとめて使える
              </h2>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-500 lg:justify-self-end">SEO記事、広告クリエイティブ、LP設計、動画、音声、人事まで。必要になったタイミングで追加契約せずに使えます。</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {SERVICES.map((service, index) => {
                const Icon = service.Icon
                const isDark = service.tone === 'dark'
                const isTint = service.tone === 'tint'

                return (
                  <motion.div key={service.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.55, delay: Math.min(index * 0.05, 0.28), ease: [0.16, 1, 0.3, 1] }} className={service.span}>
                    <Link href={service.href} className="group block h-full">
                      <div className={[
                        'flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]',
                        isDark ? 'border-zinc-900 bg-zinc-900 text-white' : isTint ? 'border-violet-100 bg-violet-50' : 'border-zinc-200 bg-white',
                        isDark ? 'justify-between lg:min-h-[430px] lg:p-9' : 'min-h-[210px]',
                      ].join(' ')}>
                        <div className="mb-8 flex items-start justify-between">
                          <div className={['flex h-11 w-11 items-center justify-center rounded-full', isDark ? 'bg-white/10 text-white' : 'bg-white text-[#7f19e6]'].join(' ')}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <ArrowUpRight className={['h-5 w-5 transition-colors', isDark ? 'text-zinc-500 group-hover:text-white' : 'text-zinc-300 group-hover:text-[#7f19e6]'].join(' ')} />
                        </div>
                        <div>
                          <h3 className={isDark ? 'mb-3 text-3xl font-bold tracking-tight' : 'mb-2 font-semibold'}>{service.name}</h3>
                          <p className={isDark ? 'max-w-md text-sm leading-relaxed text-zinc-300' : 'text-sm leading-relaxed text-zinc-500'}>{service.desc}</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="platform" className="border-y border-zinc-200 bg-white px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div>
              <motion.h2 initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="mb-5 text-4xl font-bold leading-none tracking-tighter md:text-6xl">
                欲しい施策を
                <br />
                迷わず作る
              </motion.h2>
              <motion.p initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }} className="max-w-[65ch] text-base leading-relaxed text-zinc-500">
                顧客の興味、制作テーマ、配信するクリエイティブを分断しない。統合プラットフォームとして、マーケ制作の流れをひとつにつなぎます。
              </motion.p>
            </div>
            <div className="space-y-4">
              {PLATFORM_POINTS.map((point, index) => {
                const Icon = point.Icon
                return (
                  <motion.div key={point.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.35 }} transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }} className="grid gap-5 rounded-2xl border border-zinc-200 bg-stone-50 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:grid-cols-[auto_1fr]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#7f19e6]"><Icon className="h-5 w-5" /></div>
                    <div>
                      <h3 className="mb-1 font-semibold">{point.title}</h3>
                      <p className="text-sm leading-relaxed text-zinc-500">{point.body}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto grid max-w-[1400px] gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <h2 className="mb-5 text-4xl font-bold leading-none tracking-tighter md:text-6xl">
                ひとつのプランで、
                <br />
                すべてが手に入る
              </h2>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-500">プロプランひとつで全サービスのPRO機能が解放されます。新しいサービスが追加されても、追加料金なしで自動的に利用できます。</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_20px_70px_rgba(39,39,42,0.06)] lg:p-8">
              <div className="mb-8 grid gap-4 sm:grid-cols-2">
                {PLAN_POINTS.map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-50 text-[#7f19e6]"><Check className="h-4 w-4" /></span>
                    <span className="text-sm font-medium text-zinc-700">{point}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-zinc-900 p-6 text-white">
                <div className="mb-3 flex items-end gap-2">
                  <span className="text-5xl font-bold tracking-tight">¥9,980</span>
                  <span className="pb-1 text-sm text-zinc-400">/月（税込）</span>
                </div>
                <p className="max-w-[65ch] text-sm leading-relaxed text-zinc-400">記事作成だけ、バナーだけ、動画だけで別々に課金しない。少人数チームでも予算管理しやすい統一プランです。</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-white px-5 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-14 grid gap-5 lg:grid-cols-[0.7fr_1fr] lg:items-end">
              <h2 className="text-4xl font-bold leading-none tracking-tighter md:text-6xl">料金プラン</h2>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-500 lg:justify-self-end">まずは無料でお試しください。プロプランなら、全9サービスを本格利用できます。</p>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-12">
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 lg:col-span-4">
                <p className="mb-6 text-sm font-medium text-zinc-400">無料プラン</p>
                <div className="mb-1 text-4xl font-bold tracking-tight">¥0</div>
                <p className="mb-8 text-sm text-zinc-400">永久無料</p>
                <ul className="mb-8 space-y-3">
                  {['全ツールの基本機能', 'サービスごとに回数制限', '登録不要で利用可能'].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />{item}</li>
                  ))}
                </ul>
                <Link href="/seo" className="block rounded-full border border-zinc-200 py-3 text-center text-sm font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-lg active:scale-[0.98]">無料ではじめる</Link>
              </div>
              <div className="relative rounded-2xl border-2 border-[#7f19e6] bg-violet-50 p-8 shadow-[0_24px_80px_rgba(127,25,230,0.12)] lg:col-span-5 lg:p-10">
                <div className="absolute -top-3.5 left-6 rounded-full bg-[#7f19e6] px-4 py-1 text-xs font-medium text-white">おすすめ</div>
                <p className="mb-6 text-sm font-medium text-[#7f19e6]">プロプラン</p>
                <div className="mb-1 text-5xl font-bold tracking-tight">¥9,980</div>
                <p className="mb-8 text-sm text-zinc-500">/月（税込）</p>
                <ul className="mb-8 space-y-3">
                  {['全9サービスがPROに', '利用回数を大幅に拡張', '新サービスも自動解放', '優先サポート'].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-700"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#7f19e6]" />{item}</li>
                  ))}
                </ul>
                <Link href="/auth/signin" className="block rounded-full bg-[#7f19e6] py-3 text-center text-sm font-medium text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#6812c5] hover:shadow-lg active:scale-[0.98]">プロプランに申し込む</Link>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 lg:col-span-3">
                <p className="mb-6 text-sm font-medium text-zinc-400">エンタープライズ</p>
                <div className="mb-1 text-4xl font-bold tracking-tight">要相談</div>
                <p className="mb-8 text-sm text-zinc-400">チーム・法人向け</p>
                <ul className="mb-8 space-y-3">
                  {['全サービス無制限', '専用サポート', 'カスタムAPI連携'].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-zinc-600"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400" />{item}</li>
                  ))}
                </ul>
                <a href="mailto:support@doya-ai.com" className="block rounded-full border border-zinc-200 py-3 text-center text-sm font-medium text-zinc-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-lg active:scale-[0.98]">お問い合わせ</a>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-zinc-900 px-5 py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1400px] gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="mb-4 text-3xl font-bold leading-none tracking-tighter text-white lg:text-4xl">まずは1つ、施策を作ってみる</h2>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-400">登録不要、クレジットカード不要。無料プランから、ドヤマーケの制作フローを試せます。</p>
            </div>
            <div className="flex lg:justify-end">
              <Link href={primaryHref} className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-medium text-zinc-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-100 active:scale-[0.98]">
                無料ではじめる
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 md:flex-row">
          <span className="text-sm font-semibold tracking-tight">ドヤマーケ</span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-400">
            <Link href="/terms" className="transition-colors hover:text-zinc-600">利用規約</Link>
            <Link href="/privacy" className="transition-colors hover:text-zinc-600">プライバシー</Link>
            <Link href="/tokushoho" className="transition-colors hover:text-zinc-600">特定商取引法</Link>
            <a href="mailto:support@doya-ai.com" className="transition-colors hover:text-zinc-600">お問い合わせ</a>
          </div>
          <p className="text-xs text-zinc-400">2026 ドヤAI</p>
        </div>
      </footer>
    </div>
  )
}
