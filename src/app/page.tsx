'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Briefcase,
  Check,
  ChevronDown,
  Clapperboard,
  Database,
  FileText,
  Image as ImageIcon,
  LayoutTemplate,
  Megaphone,
  Mic,
  Play,
  Route,
  ShieldCheck,
  Target,
  Users,
  Volume2,
} from 'lucide-react'

type Service = {
  name: string
  href: string
  desc: string
  Icon: LucideIcon
  span?: string
  variant?: 'primary' | 'blue' | 'plain'
}

type Benefit = {
  label: string
  title: string
  body: string
  Icon: LucideIcon
}

const SERVICES: Service[] = [
  {
    name: 'ドヤ記事作成',
    href: '/seo',
    desc: 'SEO最適化された長文記事を30秒で自動生成。最大20,000字まで対応します。',
    Icon: FileText,
    span: 'lg:col-span-2 lg:row-span-2',
    variant: 'primary',
  },
  { name: 'ドヤバナーAI', href: '/banner', desc: 'プロ品質のバナーをA/B/C 3案同時生成。', Icon: ImageIcon, variant: 'blue' },
  { name: 'ドヤコピーAI', href: '/copy', desc: '広告コピーとキャッチコピーを大量生成。', Icon: Megaphone },
  { name: 'ドヤインタビュー', href: '/interview', desc: '音声からプロ品質のインタビュー記事を自動生成。', Icon: Mic },
  { name: 'ドヤワイヤーフレームAI', href: '/lp', desc: 'LP構成とワイヤーフレームを1分で設計。', Icon: LayoutTemplate, variant: 'blue' },
  { name: 'ドヤペルソナAI', href: '/persona', desc: 'URLからターゲットペルソナを自動分析。', Icon: Users },
  { name: 'ドヤムービーAI', href: '/movie', desc: '動画広告を10分で企画、制作。', Icon: Clapperboard },
  { name: 'ドヤボイスAI', href: '/voice', desc: 'プロ品質の音声コンテンツを数秒で生成。', Icon: Volume2 },
  { name: 'ドヤHR', href: '/hr', desc: 'AI搭載タレントマネジメント。評価と1on1を効率化。', Icon: Briefcase },
]

const QUICK_LINKS = [
  { title: '成果を仕組みに変えるドヤマーケとは？', eyebrow: 'DOYA MARKE', href: '#concept', Icon: Target },
  { title: '共通プランで制作をつなぐ理由', eyebrow: 'ONE PLAN', href: '#one-plan', Icon: ShieldCheck },
  { title: '機能・サービス一覧', eyebrow: '9 TOOLS', href: '#tools', Icon: Database },
]

const PROOF_POINTS = [
  { value: '9', label: 'AI制作ツールを統合' },
  { value: '1', label: '共通プランで運用' },
  { value: '0', label: '無料プランから開始' },
  { value: '3', label: 'SEO・広告・LPを横断' },
]

const SCENARIOS = [
  {
    title: '検索流入を増やしたい',
    body: 'ペルソナとキーワードから、記事構成、本文、改善案まで一気通貫で作成。',
    Icon: FileText,
  },
  {
    title: '広告の初稿を揃えたい',
    body: 'コピー、バナー、動画のたたき台を同じ訴求軸で用意し、比較しやすくします。',
    Icon: Megaphone,
  },
  {
    title: 'LPの勝ち筋を作りたい',
    body: 'ターゲット、訴求、構成、ワイヤーフレームを短時間で整理します。',
    Icon: LayoutTemplate,
  },
]

const BENEFITS: Benefit[] = [
  {
    label: 'Benefit 1',
    title: '作るべき施策が見える',
    body: 'URL、商品、顧客像から、今打つべき記事、広告、LPの方向性を整理します。',
    Icon: Target,
  },
  {
    label: 'Benefit 2',
    title: '制作が一気につながる',
    body: 'コピー、バナー、動画、音声、記事を同じ文脈で作り、施策ごとのズレを抑えます。',
    Icon: Route,
  },
  {
    label: 'Benefit 3',
    title: '少人数でも止まらない',
    body: '個別契約やツール切り替えを減らし、毎月の改善に集中できる状態をつくります。',
    Icon: BarChart3,
  },
]

const PLAN_FEATURES = ['全9サービスのPRO機能', '新サービスも追加料金なし', '個別課金なしで予算管理', 'ひとつのアカウントで利用']

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0 },
}

export default function DoyaMarkePage() {
  const { data: session } = useSession()
  const primaryHref = session ? '/seo' : '/auth/signin'

  return (
    <div className="min-h-[100dvh] bg-white text-zinc-950 antialiased">
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

      <header className="sticky top-0 z-50 bg-[#0647a6] text-white shadow-[0_1px_0_rgba(255,255,255,0.14)]">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="ドヤマーケ">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#0647a6]">
              <Route className="h-5 w-5" />
            </span>
            <span className="text-xl font-black tracking-normal">ドヤマーケ</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-bold lg:flex">
            {[
              ['進化したドヤマーケ', '#concept'],
              ['制作フローとは', '#workflow'],
              ['選ばれる理由', '#benefits'],
              ['機能', '#tools'],
              ['プラン', '#pricing'],
            ].map(([label, href]) => (
              <a key={label} href={href} className="inline-flex items-center gap-1 text-white/88 transition-colors hover:text-white">
                {label}
                {label === '機能' || label === 'プラン' ? <ChevronDown className="h-4 w-4" /> : null}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {!session ? (
              <Link href="/auth/signin" className="hidden rounded-full bg-white px-6 py-3 text-sm font-black text-[#0647a6] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] sm:inline-flex">
                サービス紹介資料
              </Link>
            ) : null}
            <Link href={primaryHref} className="rounded-full border border-white/75 px-5 py-3 text-sm font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:text-[#0647a6] active:scale-[0.98]">
              {session ? 'ダッシュボード' : '無料デモ申込'}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#0647a6] text-white">
          <Image
            src="/doyamarke/intent-hero-v3.png"
            alt="ドヤマーケの成長を表すビジネスビジュアル"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 -z-30 object-cover object-[79%_center] opacity-95 md:object-center"
          />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(4,41,104,0.98)_0%,rgba(6,71,166,0.92)_28%,rgba(6,71,166,0.52)_58%,rgba(6,71,166,0.14)_100%)] md:bg-[linear-gradient(90deg,rgba(4,41,104,0.92)_0%,rgba(6,71,166,0.72)_34%,rgba(6,71,166,0.24)_72%,rgba(6,71,166,0.06)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-[linear-gradient(0deg,rgba(5,29,74,0.72),transparent)]" />
          <div className="absolute left-[14%] top-[36%] -z-10 hidden select-none text-[116px] font-black tracking-normal text-[#003c92]/35 lg:block">
            DOYA MARKE
          </div>

          <div className="mx-auto flex min-h-[calc(100svh-116px)] max-w-[1440px] flex-col justify-end px-5 pb-14 pt-20 lg:px-8 lg:pb-20 lg:pt-24">
            <div className="max-w-[760px]">
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="mb-5 text-sm font-black tracking-normal text-white/92"
              >
                AI MARKETING PLATFORM
              </motion.p>
              <motion.h1
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.62, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-[820px] text-[42px] font-black leading-[1.08] tracking-normal [text-shadow:0_8px_30px_rgba(0,0,0,0.24)] sm:text-[54px] md:text-[68px] lg:text-[76px]"
              >
                <span className="md:hidden">
                  顧客の“今”を捉え
                  <br />
                  売れる施策をつくる
                </span>
                <span className="hidden md:inline">
                  顧客の“今”を捉えて、
                  <br />
                  売れる施策をつくる
                </span>
              </motion.h1>
              <motion.p
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.62, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 max-w-[610px] text-base font-bold leading-relaxed text-white/90 md:text-lg"
              >
                記事、広告、LP、動画まで。中小企業のマーケ制作を、ひとつの共通プランで前に進めます。
              </motion.p>
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.62, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="mt-6 flex flex-wrap gap-2"
              >
                {['全9サービス共通', '個別課金なし', '無料プランあり'].map((item) => (
                  <span key={item} className="rounded-full border border-white/24 bg-white/10 px-4 py-2 text-xs font-black text-white/90 backdrop-blur">
                    {item}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.62, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-9 grid gap-4 lg:grid-cols-[0.86fr_1.26fr_0.88fr] lg:items-end"
            >
              <div className="hidden grid-cols-2 gap-5 sm:grid">
                {['全9ツールを統合', '月額9,980円'].map((item, index) => (
                  <div key={item} className="border-l-2 border-[#f8d963] pl-4">
                    <Award className="mb-2 h-8 w-8 text-[#f8d963]" />
                    <p className="text-sm font-black leading-relaxed">{item}</p>
                    <p className="mt-1 text-xs font-bold text-white/68">{index === 0 ? '制作から改善まで' : 'PRO機能をまとめて'}</p>
                  </div>
                ))}
              </div>

              <Link href={primaryHref} className="group grid min-h-[96px] grid-cols-[94px_1fr_auto] items-center gap-5 rounded-lg bg-white p-4 text-[#06347b] shadow-[0_24px_70px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_30px_85px_rgba(0,0,0,0.32)] active:scale-[0.98]">
                <span className="flex h-16 items-center justify-center rounded-[8px] bg-[#edf5ff] text-xs font-black text-[#0647a6]">
                  GUIDE
                </span>
                <span>
                  <span className="block text-sm font-black text-zinc-400">ドヤマーケがわかる</span>
                  <span className="mt-1 block text-xl font-black tracking-normal text-[#06347b]">無料ではじめる</span>
                </span>
                <ArrowRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
              </Link>

              <a href="#concept" className="hidden rounded-lg border border-white/20 bg-[#052a67]/74 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#052a67] active:scale-[0.98] lg:block">
                <div className="mb-3 flex items-center justify-between text-xs font-black">
                  <span>3分でわかるドヤマーケ</span>
                  <Play className="h-4 w-4" />
                </div>
                <div className="h-[82px] rounded-[8px] bg-[#2e54e8] p-3">
                  <div className="h-3 w-24 rounded-full bg-white/82" />
                  <div className="mt-7 h-3 w-40 rounded-full bg-white/52" />
                  <div className="mt-2 h-3 w-28 rounded-full bg-white/40" />
                </div>
              </a>
            </motion.div>
          </div>
        </section>

        <section className="relative z-10 -mt-8 px-5 pb-16 lg:px-8">
          <div className="mx-auto grid max-w-[1210px] gap-4 md:grid-cols-3">
            {QUICK_LINKS.map(({ title, eyebrow, href, Icon }) => (
              <a key={title} href={href} className="group grid min-h-[112px] grid-cols-[auto_1fr_auto] items-center gap-4 rounded-lg bg-white p-6 shadow-[0_18px_54px_rgba(15,23,42,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(15,23,42,0.18)] active:scale-[0.98]">
                <span className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#edf5ff] text-[#0647a6]">
                  <Icon className="h-6 w-6" />
                </span>
                <span>
                  <span className="block text-xs font-black text-[#1f66cf]">{eyebrow}</span>
                  <span className="mt-1 block text-sm font-black leading-relaxed text-zinc-900">{title}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-[#0647a6] transition-transform group-hover:translate-x-1" />
              </a>
            ))}
          </div>
        </section>

        <section className="border-y border-[#d9e6fb] bg-[#f7fbff] px-5 py-8 lg:px-8">
          <div className="mx-auto grid max-w-[1210px] gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF_POINTS.map((item) => (
              <div key={item.label} className="grid grid-cols-[auto_1fr] items-center gap-4">
                <div className="text-4xl font-black leading-none text-[#0647a6]">{item.value}</div>
                <div className="text-sm font-black leading-relaxed text-zinc-800">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="concept" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1210px] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mb-4 text-sm font-black text-[#0647a6]">INTENT MARKETING</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                “何を作るか”から
                <br />
                “どう届けるか”まで
              </h2>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-600">
                市場も顧客も掴みにくく、広告や記事の本数だけでは成果が安定しにくい時代です。ドヤマーケは、顧客理解、制作、改善をひとつの視界にまとめます。
              </p>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-600">
                ペルソナ分析からSEO記事、広告コピー、バナー、LP、動画までを共通プランで使えるため、少人数チームでも施策を止めずに前へ進められます。
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0647a6] px-7 py-4 text-sm font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#053984] hover:shadow-lg active:scale-[0.98]">
                  無料で試す
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#tools" className="inline-flex items-center justify-center rounded-full border border-zinc-300 px-7 py-4 text-sm font-black text-zinc-800 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-lg active:scale-[0.98]">
                  機能を見る
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="bg-white px-5 pb-20 lg:px-8 lg:pb-28">
          <div className="mx-auto max-w-[1210px]">
            <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-3 text-sm font-black text-[#0647a6]">USE CASES</p>
                <h2 className="text-3xl font-black leading-tight tracking-normal md:text-5xl">すぐ使える制作シーン</h2>
              </div>
              <p className="max-w-[48ch] text-sm leading-relaxed text-zinc-600">
                単体ツールではなく、日々のマーケ業務の流れに合わせて使える設計です。
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {SCENARIOS.map(({ title, body, Icon }) => (
                <div key={title} className="group rounded-lg border border-zinc-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="mb-8 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#edf5ff] text-[#0647a6]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-[#0647a6]" />
                  </div>
                  <h3 className="mb-3 text-xl font-black leading-tight tracking-normal text-zinc-950">{title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="benefits" className="bg-[#f2f7ff] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1210px]">
            <div className="mb-12 max-w-[850px]">
              <p className="mb-4 text-sm font-black text-[#0647a6]">WHY DOYA MARKE</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                成果に向かう流れを、
                <br />
                チームの標準にする
              </h2>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {BENEFITS.map(({ label, title, body, Icon }, index) => (
                <motion.article
                  key={title}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-lg bg-white p-7 shadow-[0_16px_42px_rgba(15,23,42,0.08)]"
                >
                  <div className="mb-12 flex items-center justify-between">
                    <span className="text-xs font-black text-[#1f66cf]">{label}</span>
                    <span className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#0647a6] text-white">
                      <Icon className="h-6 w-6" />
                    </span>
                  </div>
                  <h3 className="mb-4 text-2xl font-black leading-tight tracking-normal text-zinc-950">{title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-600">{body}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="overflow-hidden bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1210px] gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-black text-[#0647a6]">PLATFORM</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                施策の分断をなくす
                <br />
                制作ワークスペース
              </h2>
              <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-zinc-600">
                リサーチ、コピー、クリエイティブ、LP設計を同じ文脈で扱うことで、施策ごとのズレを減らします。
              </p>
            </div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg bg-[#0647a6] p-5 shadow-[0_28px_90px_rgba(6,71,166,0.22)]"
            >
              <div className="mb-5 flex items-center justify-between border-b border-white/15 pb-4">
                <div>
                  <div className="h-3 w-28 rounded-full bg-white/90" />
                  <div className="mt-3 h-2 w-44 rounded-full bg-white/35" />
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#0647a6]">Live Plan</div>
              </div>
              <div className="grid gap-4 lg:grid-cols-[1fr_0.72fr]">
                <div className="space-y-4">
                  {['ペルソナ分析', 'SEO記事作成', '広告コピー生成'].map((item, index) => (
                    <div key={item} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[8px] bg-white p-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#edf5ff] text-sm font-black text-[#0647a6]">{index + 1}</span>
                      <span>
                        <span className="block text-sm font-black text-zinc-950">{item}</span>
                        <span className="mt-1 block h-2 w-4/5 rounded-full bg-zinc-200" />
                      </span>
                      <Check className="h-5 w-5 text-[#0647a6]" />
                    </div>
                  ))}
                </div>
                <div className="rounded-[8px] bg-white p-5">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-sm font-black text-zinc-950">施策スコア</span>
                    <span className="text-2xl font-black text-[#0647a6]">86</span>
                  </div>
                  <div className="flex h-40 items-end gap-2">
                    {[34, 54, 46, 72, 65, 92].map((height, index) => (
                      <div key={index} className="flex-1 rounded-t bg-[#1f66cf]" style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="tools" className="bg-[#f7f9fc] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1210px]">
            <div className="mb-12 grid gap-6 lg:grid-cols-[0.9fr_1fr] lg:items-end">
              <div>
                <p className="mb-4 text-sm font-black text-[#0647a6]">FUNCTIONS</p>
                <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                  マーケ制作に必要な
                  <br />
                  9つのAIツール
                </h2>
              </div>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-600 lg:justify-self-end">
                記事、広告、LP、動画、音声、人事まで。必要になったタイミングで追加契約せずに使えます。
              </p>
            </div>

            <div className="grid auto-rows-[minmax(190px,auto)] gap-4 md:grid-cols-2 lg:grid-cols-4">
              {SERVICES.map((service, index) => {
                const Icon = service.Icon
                const isPrimary = service.variant === 'primary'
                const isBlue = service.variant === 'blue'

                return (
                  <motion.div
                    key={service.name}
                    variants={fadeUp}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.25 }}
                    transition={{ duration: 0.52, delay: Math.min(index * 0.04, 0.22), ease: [0.16, 1, 0.3, 1] }}
                    className={service.span}
                  >
                    <Link
                      href={service.href}
                      className={[
                        'group flex h-full flex-col rounded-lg p-6 shadow-[0_14px_42px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_58px_rgba(15,23,42,0.14)] active:scale-[0.98]',
                        isPrimary ? 'bg-[#0647a6] text-white' : isBlue ? 'bg-[#edf5ff] text-zinc-950' : 'bg-white text-zinc-950',
                      ].join(' ')}
                    >
                      <div className="mb-10 flex items-start justify-between">
                        <span className={isPrimary ? 'flex h-12 w-12 items-center justify-center rounded-[8px] bg-white/12 text-white' : 'flex h-12 w-12 items-center justify-center rounded-[8px] bg-white text-[#0647a6]'}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <ArrowUpRight className={isPrimary ? 'h-5 w-5 text-white/50 transition-colors group-hover:text-white' : 'h-5 w-5 text-zinc-300 transition-colors group-hover:text-[#0647a6]'} />
                      </div>
                      <div className="mt-auto">
                        <h3 className={isPrimary ? 'mb-4 text-3xl font-black leading-tight tracking-normal' : 'mb-3 text-lg font-black tracking-normal'}>{service.name}</h3>
                        <p className={isPrimary ? 'max-w-md text-sm leading-relaxed text-white/78' : 'text-sm leading-relaxed text-zinc-600'}>{service.desc}</p>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="one-plan" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1210px] gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-black text-[#0647a6]">ONE PLAN</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                ひとつのプランで、
                <br />
                すべてが手に入る
              </h2>
              <p className="mt-6 max-w-[65ch] text-base leading-relaxed text-zinc-600">
                プロプランひとつで全サービスのPRO機能が解放されます。新しいサービスが追加されても、追加料金なしで利用できます。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PLAN_FEATURES.map((feature) => (
                <div key={feature} className="flex min-h-24 items-center gap-4 rounded-lg border border-zinc-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#edf5ff] text-[#0647a6]">
                    <Check className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-black text-zinc-900">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f7f9fc] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1210px]">
            <div className="mb-12 grid gap-6 lg:grid-cols-[0.7fr_1fr] lg:items-end">
              <div>
                <p className="mb-4 text-sm font-black text-[#0647a6]">PLAN</p>
                <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">料金プラン</h2>
              </div>
              <p className="max-w-[65ch] text-base leading-relaxed text-zinc-600 lg:justify-self-end">
                まずは無料でお試しください。プロプランなら、全9サービスを本格利用できます。
              </p>
            </div>

            <div className="grid items-start gap-5 lg:grid-cols-12">
              <PlanCard
                className="lg:col-span-4"
                name="無料プラン"
                price="¥0"
                note="永久無料"
                href="/seo"
                cta="無料ではじめる"
                features={['全ツールの基本機能', 'サービスごとに回数制限', '登録不要で利用可能']}
              />
              <PlanCard
                className="border-2 border-[#0647a6] bg-white shadow-[0_26px_80px_rgba(6,71,166,0.18)] lg:col-span-5 lg:-mt-5"
                name="プロプラン"
                price="¥9,980"
                note="/月（税込）"
                href="/auth/signin"
                cta="プロプランに申し込む"
                recommended
                features={['全9サービスがPROに', '利用回数を大幅に拡張', '新サービスも自動解放', '優先サポート']}
              />
              <PlanCard
                className="lg:col-span-3"
                name="エンタープライズ"
                price="要相談"
                note="チーム・法人向け"
                href="mailto:support@doya-ai.com"
                cta="お問い合わせ"
                features={['全サービス無制限', '専用サポート', 'カスタムAPI連携']}
              />
            </div>
          </div>
        </section>

        <section className="bg-[#0647a6] px-5 py-18 text-white lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-[1210px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-black text-white/70">START NOW</p>
              <h2 className="text-3xl font-black leading-tight tracking-normal md:text-5xl">まずは1つ、施策を作ってみる</h2>
              <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-white/80">
                登録不要、クレジットカード不要。無料プランから、ドヤマーケの制作フローを試せます。
              </p>
            </div>
            <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-black text-[#0647a6] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98]">
              無料ではじめる
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-white px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1210px] flex-col items-center justify-between gap-4 md:flex-row">
          <span className="text-sm font-black text-zinc-950">ドヤマーケ</span>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500">
            <Link href="/terms" className="transition-colors hover:text-zinc-900">利用規約</Link>
            <Link href="/privacy" className="transition-colors hover:text-zinc-900">プライバシー</Link>
            <Link href="/tokushoho" className="transition-colors hover:text-zinc-900">特定商取引法</Link>
            <a href="mailto:support@doya-ai.com" className="transition-colors hover:text-zinc-900">お問い合わせ</a>
          </div>
          <p className="text-xs text-zinc-400">2026 ドヤAI</p>
        </div>
      </footer>
    </div>
  )
}

function PlanCard({
  className = '',
  name,
  price,
  note,
  features,
  href,
  cta,
  recommended = false,
}: {
  className?: string
  name: string
  price: string
  note: string
  features: string[]
  href: string
  cta: string
  recommended?: boolean
}) {
  const ctaClass = recommended
    ? 'block rounded-full bg-[#0647a6] py-3.5 text-center text-sm font-black text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#053984] hover:shadow-lg active:scale-[0.98]'
    : 'block rounded-full border border-zinc-300 py-3.5 text-center text-sm font-black text-zinc-800 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-500 hover:shadow-lg active:scale-[0.98]'

  const content = (
    <>
      {recommended ? (
        <div className="absolute -top-4 left-6 rounded-full bg-[#0647a6] px-4 py-2 text-xs font-black text-white">
          おすすめ
        </div>
      ) : null}
      <p className={recommended ? 'mb-6 text-sm font-black text-[#0647a6]' : 'mb-6 text-sm font-black text-zinc-500'}>{name}</p>
      <div className={recommended ? 'mb-2 text-5xl font-black tracking-normal text-zinc-950' : 'mb-2 text-4xl font-black tracking-normal text-zinc-950'}>{price}</div>
      <p className="mb-8 text-sm text-zinc-500">{note}</p>
      <ul className="mb-8 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-zinc-700">
            <Check className={recommended ? 'mt-0.5 h-4 w-4 flex-shrink-0 text-[#0647a6]' : 'mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-400'} />
            {feature}
          </li>
        ))}
      </ul>
      {href.startsWith('mailto:') ? (
        <a href={href} className={ctaClass}>
          {cta}
        </a>
      ) : (
        <Link href={href} className={ctaClass}>
          {cta}
        </Link>
      )}
    </>
  )

  return <div className={['relative rounded-lg border border-zinc-200 bg-white p-7 shadow-[0_12px_34px_rgba(15,23,42,0.06)]', className].join(' ')}>{content}</div>
}
