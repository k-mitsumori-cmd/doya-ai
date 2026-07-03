'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Bot,
  Briefcase,
  Check,
  CircleDot,
  Clock,
  Code2,
  Database,
  FileText,
  Headphones,
  Image as ImageIcon,
  LayoutTemplate,
  LineChart,
  ListChecks,
  Megaphone,
  Mic,
  PenTool,
  Play,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Volume2,
} from 'lucide-react'
import { SERVICES, HIDDEN_SERVICE_IDS, type ServiceStatus } from '@/lib/services'

type DisplayStatus = '公開中' | '開発中' | '調整中'

type ServiceCard = {
  name: string
  desc: string
  href: string
  status: DisplayStatus
  Icon: LucideIcon
  accent: string
}

type Proof = {
  value: string
  label: string
  note: string
}

// サービスの「存在・状態・名前・説明・導線」は src/lib/services.ts の SERVICES を単一の正本とし、
// ここ（トップページ）は見た目（アイコン/アクセント色）と並べ方だけを担当する。
// これにより、サービスを追加/改名/再パス/ステータス変更しても SERVICES を直すだけでトップに反映される。
const STATUS_LABEL: Record<ServiceStatus, DisplayStatus> = {
  active: '公開中',
  beta: '公開中',
  coming_soon: '開発中',
  maintenance: '調整中',
}

const DEFAULT_PRESENTATION = { Icon: Sparkles, accent: '#0066ff' }
// 未登録IDは DEFAULT_PRESENTATION にフォールバックするので、新サービスも自動でカード表示される。
const SERVICE_PRESENTATION: Record<string, { Icon: LucideIcon; accent: string }> = {
  seo: { Icon: FileText, accent: '#0066ff' },
  banner: { Icon: ImageIcon, accent: '#ff1e72' },
  adbanner: { Icon: Megaphone, accent: '#ffd400' },
  persona: { Icon: Target, accent: '#00e0ff' },
  interview: { Icon: Mic, accent: '#009bff' },
  doyaslide: { Icon: LayoutTemplate, accent: '#0066ff' },
  doyalist: { Icon: ListChecks, accent: '#ff1e72' },
  shodan: { Icon: Search, accent: '#ffd400' },
  aio: { Icon: Bot, accent: '#00e0ff' },
  hr: { Icon: Users, accent: '#009bff' },
  kintai: { Icon: Clock, accent: '#0066ff' },
  sfa: { Icon: BarChart3, accent: '#00e0ff' },
  promane: { Icon: Briefcase, accent: '#ffd400' },
  cunning: { Icon: Headphones, accent: '#ff1e72' },
  kantan: { Icon: Rocket, accent: '#00e0ff' },
  logo: { Icon: PenTool, accent: '#0066ff' },
  shindan: { Icon: LineChart, accent: '#009bff' },
  lp: { Icon: LayoutTemplate, accent: '#00e0ff' },
  copy: { Icon: Megaphone, accent: '#ffd400' },
  movie: { Icon: Play, accent: '#ff1e72' },
  voice: { Icon: Volume2, accent: '#0066ff' },
  tenkai: { Icon: Database, accent: '#009bff' },
}

function toServiceCard(service: (typeof SERVICES)[number]): ServiceCard {
  const pres = SERVICE_PRESENTATION[service.id] || DEFAULT_PRESENTATION
  return {
    name: service.name,
    desc: service.description,
    href: service.href,
    status: STATUS_LABEL[service.status],
    Icon: pres.Icon,
    accent: pres.accent,
  }
}

const sortedServices = [...SERVICES]
  .filter((s) => !HIDDEN_SERVICE_IDS.has(s.id))
  .sort((a, b) => a.order - b.order)
const activeServices: ServiceCard[] = sortedServices
  .filter((s) => s.status === 'active' || s.status === 'beta')
  .map(toServiceCard)
const labServices: ServiceCard[] = sortedServices
  .filter((s) => s.status === 'coming_soon' || s.status === 'maintenance')
  .map(toServiceCard)

const operatorMarks = [
  { label: 'YouTubeチャンネル', name: 'SaaSは死にましぇん' },
  { label: 'サービスブランド', name: 'ドヤマーケAI' },
  { label: '運営会社', name: '株式会社スリスタ' },
  { label: '運営者', name: '三森 捷暉' },
]

const proofs: Proof[] = [
  // 数値は実際に表示するカード数/項目数に連動させる（手書き数値だとズレるため）
  { value: String(activeServices.length + labServices.length), label: 'サービス構想と実装', note: '公開中、開発中、調整中を含むドヤマーケAI全体' },
  { value: String(activeServices.length), label: '公開中の主要サービス', note: '制作、営業、人事、業務管理まで横断' },
  { value: '0', label: '無料枠から試せる', note: 'いきなり課金ではなく、触って判断できる設計' },
  { value: String(operatorMarks.length), label: '運営文脈を明確化', note: 'チャンネル、ブランド、会社、運営者を整理して表示' },
]

const characterMoments = [
  { title: '迷ったら、案内する', body: '入口で何を使えばいいか迷わせず、キャラクターが用途別にナビゲート。', image: '/character/hello.png' },
  { title: '施策を、解説する', body: '難しいAI機能をそのまま並べず、使いどころを噛み砕いて見せる。', image: '/character/point.png' },
  { title: '作業を、進める', body: '記事、バナー、営業資料などを“作っている感”のある画面で伝える。', image: '/character/working.png' },
  { title: '成果を、喜べる', body: '業務SaaSでも冷たく見せず、完了や改善の達成感をブランド体験にする。', image: '/character/success.png' },
]

const processSteps = [
  { label: 'Input', title: 'URLや素材を入れる', body: '商品URL、取材音声、商談先URL、広告条件などを入力。' },
  { label: 'Plan', title: 'AIが方針を組む', body: 'ペルソナ、訴求、構成、必要なアウトプットを整理。' },
  { label: 'Create', title: '制作物を生成する', body: '記事、バナー、営業文、資料、分析レポートを作成。' },
  { label: 'Improve', title: '改善して回す', body: '診断、採点、編集、再生成で実用品質まで磨く。' },
]

const businessPoints = [
  '主役をドヤマーケAIに統一し、SaaSは死にましぇんは発信元として整理。',
  'サービスが増えても、キャラクターを共通入口にすることで覚えやすい。',
  '制作系、営業系、人事系を分けて見せることで、用途がすぐ伝わる。',
  '公開中と開発中を正直に分けることで、期待値のズレを抑えられる。',
]

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

// カードを1枚ずつ whileInView すると Observer がカード枚数分作られるため、
// 親1つで whileInView し、子は staggerChildren で順番にアニメーションさせる。
const gridContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}

export default function DoyaAiHomePage() {
  const { data: session } = useSession()
  const primaryHref = session ? '/seo' : '/auth/signin'

  return (
    <div className="min-h-[100dvh] bg-white text-[#0a0f3c] antialiased">
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

      <header className="sticky top-0 z-50 border-b border-[#d8e7ff] bg-white/94 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="ドヤマーケAI">
            <span className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border border-[#cfe3ff] bg-[#f2f6ff]">
              <Image src="/character/hello.png" alt="" fill priority sizes="44px" className="object-cover object-top" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black tracking-normal text-[#0a0f3c] sm:text-xl">ドヤマーケAI</span>
              <span className="hidden text-[11px] font-black tracking-normal text-[#0066ff] sm:block">SaaSは死にましぇん運営</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-black lg:flex">
            {[
              ['サービス', '#services'],
              ['キャラクター', '#character'],
              ['制作フロー', '#process'],
              ['勝ち筋', '#business'],
              ['料金', '#pricing'],
            ].map(([label, href]) => (
              <a key={label} href={href} className="text-[#0a0f3c]/72 transition-colors hover:text-[#0066ff]">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <a href="#services" className="hidden rounded-full border border-[#bfd7ff] px-5 py-3 text-sm font-black text-[#0a0f3c] transition-all hover:-translate-y-0.5 hover:border-[#0066ff] hover:text-[#0066ff] sm:inline-flex">
              サービスを見る
            </a>
            <Link href={primaryHref} className="inline-flex items-center gap-2 rounded-full bg-[#0066ff] px-5 py-3 text-sm font-black text-white shadow-[0_12px_32px_rgba(0,102,255,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#0052d6]">
              <Sparkles className="h-4 w-4" />
              {session ? '使い始める' : '無料で試す'}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#0066ff] text-white">
          <Image
            src="/doya-home/hero-mascot-suite-v1.png"
            alt="キャラクターがドヤマーケAIのサービス群を案内するヒーロービジュアル"
            fill
            priority
            sizes="100vw"
            className="absolute inset-0 -z-30 object-cover object-[72%_center] opacity-100 md:object-center"
          />
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(4,10,52,0.96)_0%,rgba(0,102,255,0.88)_31%,rgba(0,102,255,0.34)_68%,rgba(0,102,255,0.04)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(0deg,rgba(4,10,52,0.58),transparent)]" />

          <div className="mx-auto flex min-h-[calc(100svh-112px)] max-w-[1240px] flex-col justify-center px-5 py-16 lg:px-8 lg:py-20">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              transition={{ duration: 0.58, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-[720px]"
            >
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/24 bg-white/12 px-4 py-2 text-xs font-black text-white/90 backdrop-blur">
                <Code2 className="h-4 w-4 text-[#ffd400]" />
                DOYA MARKE AI SERVICE SUITE
              </p>
              <h1 className="text-[40px] font-black leading-[1.08] tracking-normal [text-shadow:0_10px_28px_rgba(0,0,0,0.28)] sm:text-[56px] md:text-[70px] lg:text-[78px]">
                <span className="block">ドヤマーケAIの</span>
                <span className="block text-[#ffd400]">サービス群。</span>
                <span className="mt-3 block text-[26px] leading-[1.18] text-white [text-wrap:balance] sm:text-[34px] md:text-[42px]">
                  作る・売る・管理を
                  <br className="sm:hidden" />
                  前に進める。
                </span>
              </h1>
              <p className="mt-6 max-w-[620px] text-base font-bold leading-[1.78] text-white/88 [text-wrap:pretty] md:mt-7 md:text-lg md:leading-[1.9]">
                記事、広告、営業、人事、勤怠、資料から、
                <span className="inline-block">AI検索可視化まで。</span>
                <span className="mt-2 block">
                  ドヤマーケAIは、実験で終わらせず実務で使えるAIサービスを束ねるポータルです。
                </span>
                <span className="mt-2 hidden sm:block">
                  YouTubeチャンネル「SaaSは死にましぇん」、ドヤマーケ、株式会社スリスタ、三森 捷暉の運営文脈から生まれています。
                </span>
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row md:mt-8">
                <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-black text-[#0066ff] shadow-[0_18px_46px_rgba(0,0,0,0.2)] transition-all hover:-translate-y-0.5">
                  <Sparkles className="h-4 w-4 text-[#ff1e72]" />
                  無料で使ってみる
                </Link>
                <a href="#services" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/50 bg-white/10 px-7 py-4 text-sm font-black text-white backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white/16">
                  <CircleDot className="h-4 w-4 text-[#ffd400]" />
                  サービス全体を見る
                </a>
              </div>
              <div className="mt-5 rounded-lg border border-white/18 bg-white/10 px-4 py-3 backdrop-blur sm:hidden">
                <p className="mb-2 text-[10px] font-black leading-none text-white/58">運営</p>
                <div className="flex flex-wrap gap-1.5">
                  {operatorMarks.map((mark) => (
                    <span key={mark.name} className="rounded-full border border-white/14 bg-white/10 px-2.5 py-1.5 text-[10px] font-black leading-none text-white/86">
                      {mark.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-8 hidden max-w-[680px] flex-wrap gap-2 sm:flex">
                {operatorMarks.map((mark) => (
                  <div key={mark.label} className="rounded-full border border-white/22 bg-white/12 px-4 py-2 backdrop-blur">
                    <span className="mr-2 text-[11px] font-black text-white/58">{mark.label}</span>
                    <span className="text-xs font-black text-white">{mark.name}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        <section className="relative z-10 -mt-8 px-5 pb-16 lg:px-8">
          <div className="mx-auto grid max-w-[1240px] gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {proofs.map((proof) => (
              <div key={proof.label} className="min-h-[132px] rounded-lg border border-[#d8e7ff] bg-white p-5 shadow-[0_18px_54px_rgba(10,15,60,0.12)]">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="text-4xl font-black leading-none text-[#0066ff]">{proof.value}</div>
                  <Sparkles className="h-5 w-5 text-[#00e0ff]" />
                </div>
                <h2 className="text-sm font-black leading-relaxed text-[#0a0f3c]">{proof.label}</h2>
                <p className="mt-2 text-xs font-bold leading-relaxed text-[#425071]">{proof.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="services" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 grid gap-8 lg:grid-cols-[0.88fr_1.12fr] lg:items-end">
              <div>
                <p className="mb-4 text-sm font-black text-[#0066ff]">SERVICE PORTAL</p>
                <h2 className="text-4xl font-black leading-[1.12] tracking-normal text-[#0a0f3c] md:text-6xl">
                  作る、売る、管理する。
                  <br />
                  ぜんぶ事業の武器にする。
                </h2>
              </div>
              <p className="max-w-[64ch] text-base font-medium leading-[1.9] text-[#425071] lg:justify-self-end">
                ただのリンク集ではなく、用途別にAIツールを選べるドヤマーケAIの入口へ。
                公開中サービスと開発中サービスを分けて、期待値を正直に見せます。
              </p>
            </div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
              className="mb-8 overflow-hidden rounded-lg border border-[#d8e7ff] bg-[#f2f6ff] shadow-[0_24px_80px_rgba(0,102,255,0.16)]"
            >
              <div className="relative h-[280px] sm:h-[360px] lg:h-auto lg:aspect-[16/8.6]">
                <Image
                  src="/doya-home/service-map-mascot-v1.png"
                  alt="キャラクターを中心にドヤマーケAIの各サービスが並ぶサービスマップ"
                  fill
                  sizes="(min-width: 1024px) 1240px, 100vw"
                  className="object-cover"
                />
              </div>
            </motion.div>

            <motion.div
              variants={gridContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            >
              {activeServices.map((service) => (
                <ServiceTile key={service.name} service={service} />
              ))}
            </motion.div>
          </div>
        </section>

        <section id="character" className="bg-[#f2f6ff] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-12 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="mb-4 text-sm font-black text-[#0066ff]">CHARACTER SYSTEM</p>
                <h2 className="text-4xl font-black leading-[1.12] tracking-normal text-[#0a0f3c] md:text-6xl">
                  キャラがいるから、
                  <br />
                  AIサービスを選びやすい。
                </h2>
              </div>
              <p className="max-w-[64ch] text-base font-medium leading-[1.9] text-[#425071] lg:justify-self-end">
                BtoBツールは硬く見えがちです。だからこそ、共通のキャラクターで
                体験の入口をやわらかくし、覚えやすさと説明力を両立します。
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {characterMoments.map((moment) => (
                <article key={moment.title} className="overflow-hidden rounded-lg border border-[#d8e7ff] bg-white shadow-[0_14px_38px_rgba(10,15,60,0.08)]">
                  <div className="relative aspect-square bg-white">
                    <Image src={moment.image} alt={moment.title} fill sizes="(min-width: 1280px) 300px, 50vw" className="object-cover" />
                  </div>
                  <div className="border-t border-[#e4efff] p-5">
                    <h3 className="text-lg font-black leading-tight tracking-normal text-[#0a0f3c]">{moment.title}</h3>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">{moment.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-black text-[#0066ff]">WORKFLOW</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal text-[#0a0f3c] md:text-6xl">
                ひらめきから、
                <br />
                使える成果物まで。
              </h2>
              <p className="mt-6 max-w-[62ch] text-base font-medium leading-[1.9] text-[#425071]">
                キャラクターの楽しさだけで終わらせず、入力、設計、生成、改善という
                AIサービスとしての価値が伝わる流れに整理しました。
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {processSteps.map((step) => (
                  <div key={step.title} className="rounded-lg border border-[#d8e7ff] bg-white p-5 shadow-[0_10px_28px_rgba(10,15,60,0.06)]">
                    <p className="mb-3 text-xs font-black text-[#0066ff]">{step.label}</p>
                    <h3 className="text-base font-black leading-tight tracking-normal text-[#0a0f3c]">{step.title}</h3>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-[#425071]">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden rounded-lg border border-[#d8e7ff] bg-[#f2f6ff] shadow-[0_24px_80px_rgba(0,102,255,0.14)]"
            >
              <div className="relative h-[300px] sm:h-[380px] lg:h-auto lg:aspect-[16/10]">
                <Image
                  src="/doya-home/process-mascot-v1.png"
                  alt="キャラクターがAI SaaSの制作プロセスを案内するビジュアル"
                  fill
                  sizes="(min-width: 1024px) 610px, 100vw"
                  className="object-cover"
                />
              </div>
            </motion.div>
          </div>
        </section>

        <section id="business" className="bg-[#071345] px-5 py-20 text-white lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="mb-4 text-sm font-black text-[#00e0ff]">BUSINESS QUALITY</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-6xl">
                かわいいだけでは、
                <br />
                終わらせない。
              </h2>
              <p className="mt-6 max-w-[62ch] text-base font-bold leading-[1.9] text-white/76">
                事業として強く見える条件は、何を提供しているか、誰に効くか、
                どこから始めるかが一瞬で分かることです。
                そのために、見た目の熱量と情報の正確さを両立させています。
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {businessPoints.map((point, index) => (
                <div key={point} className="rounded-lg border border-white/12 bg-white/8 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.18)] backdrop-blur">
                  <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-[8px] bg-white text-[#0066ff]">
                    {index % 2 === 0 ? <ShieldCheck className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                  </div>
                  <p className="text-sm font-bold leading-relaxed text-white/84">{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-white px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1240px]">
            <div className="mb-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="mb-4 text-sm font-black text-[#0066ff]">LAB ROADMAP</p>
                <h2 className="text-4xl font-black leading-[1.12] tracking-normal text-[#0a0f3c] md:text-6xl">
                  まだ増える。
                  <br />
                  でも、正直に見せる。
                </h2>
              </div>
              <p className="max-w-[58ch] text-base font-medium leading-[1.9] text-[#425071]">
                開発中や調整中のサービスは、過度に完成品のように見せず、
                ロードマップとして期待を作る配置にしています。
              </p>
            </div>

            <motion.div
              variants={gridContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.15 }}
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            >
              {labServices.map((service) => (
                <ServiceTile key={service.name} service={service} compact />
              ))}
            </motion.div>
          </div>
        </section>

        <section id="pricing" className="bg-[#f2f6ff] px-5 py-20 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
            <div className="rounded-lg bg-[#0066ff] p-8 text-white shadow-[0_24px_80px_rgba(0,102,255,0.2)] lg:p-10">
              <p className="mb-4 text-sm font-black text-white/72">START POINT</p>
              <h2 className="text-4xl font-black leading-[1.12] tracking-normal md:text-5xl">
                まず無料で触る。
                <br />
                ひとつの契約で全部使う。
              </h2>
              <p className="mt-6 text-base font-bold leading-[1.9] text-white/82">
                ドヤマーケAIは統一プラン。プロプランひとつで全サービスのPRO機能が使えます。
                サービスごとの個別課金はなく、新しいサービスが増えても追加料金はかかりません。
              </p>
              <Link href={primaryHref} className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-black text-[#0066ff] transition-all hover:-translate-y-0.5">
                <Sparkles className="h-4 w-4 text-[#ff1e72]" />
                無料で使ってみる
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ['無料プラン', '¥0', 'まずは無料で。各サービスの無料枠でそのまま試せます。', false],
                ['プロプラン', '¥9,980', '月額・税込。全サービスのPRO機能が使い放題。個別課金なし。', true],
              ].map(([name, price, body, paid]) => (
                <div key={name as string} className={`rounded-lg border bg-white p-6 ${paid ? 'border-[#0066ff] shadow-[0_16px_44px_rgba(0,102,255,0.18)]' : 'border-[#d8e7ff] shadow-[0_12px_34px_rgba(10,15,60,0.08)]'}`}>
                  <p className="mb-5 text-sm font-black text-[#0066ff]">{name}</p>
                  <div className="text-4xl font-black tracking-normal text-[#0a0f3c]">
                    {price}
                    {paid ? <span className="ml-1 text-base font-bold text-[#425071]">/月</span> : null}
                  </div>
                  <p className="mt-4 text-sm font-medium leading-relaxed text-[#425071]">{body}</p>
                  {paid ? (
                    <Link href={primaryHref} className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#0066ff] px-5 py-3 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-[#0052d6]">
                      <Sparkles className="h-4 w-4" />
                      プロプランを始める
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-white px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto grid max-w-[1240px] gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-black text-[#0066ff]">BUILD WITH DOYA MARKE AI</p>
              <h2 className="text-3xl font-black leading-tight tracking-normal text-[#0a0f3c] md:text-5xl">
                ドヤマーケAIで、
                <br />
                まずは1つ、動かしてみる。
              </h2>
              <p className="mt-5 max-w-[68ch] text-base font-medium leading-[1.9] text-[#425071]">
                キャラクターの楽しさと、実用SaaSの具体性。
                その両方で、初見でも覚えやすいサービスサイトにしました。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link href={primaryHref} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0066ff] px-8 py-4 text-sm font-black text-white shadow-[0_16px_40px_rgba(0,102,255,0.22)] transition-all hover:-translate-y-0.5">
                <Sparkles className="h-4 w-4" />
                無料で始める
              </Link>
              <a href="mailto:support@surisuta.jp" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#bfd7ff] px-8 py-4 text-sm font-black text-[#0a0f3c] transition-all hover:-translate-y-0.5 hover:border-[#0066ff] hover:text-[#0066ff]">
                <CircleDot className="h-4 w-4" />
                相談する
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#d8e7ff] bg-[#f7fbff] px-5 py-8 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="relative h-9 w-9 overflow-hidden rounded-full border border-[#cfe3ff] bg-white">
              <Image src="/character/hello.png" alt="" fill sizes="36px" className="object-cover object-top" />
            </span>
            <span>
              <span className="block text-sm font-black text-[#0a0f3c]">ドヤマーケAI</span>
              <span className="block text-xs font-bold text-[#0066ff]">SaaSは死にましぇん運営</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-[#425071]">
            <Link href="/terms" className="transition-colors hover:text-[#0066ff]">利用規約</Link>
            <Link href="/privacy" className="transition-colors hover:text-[#0066ff]">プライバシー</Link>
            <Link href="/tokushoho" className="transition-colors hover:text-[#0066ff]">特定商取引法</Link>
            <a href="mailto:support@surisuta.jp" className="transition-colors hover:text-[#0066ff]">お問い合わせ</a>
          </div>
          <p className="max-w-[260px] text-center text-xs font-bold leading-relaxed text-[#7d8baa] md:text-right">
            2026 ドヤマーケAI / 株式会社スリスタ
            <br />
            運営: 三森 捷暉
          </p>
        </div>
      </footer>
    </div>
  )
}

function ServiceTile({ service, compact = false }: { service: ServiceCard; compact?: boolean }) {
  const Icon = service.Icon
  const statusClass =
    service.status === '公開中'
      ? 'bg-[#e8fff8] text-[#008f7a]'
      : service.status === '開発中'
        ? 'bg-[#fff7d6] text-[#8a6500]'
        : 'bg-[#edf4ff] text-[#0066ff]'

  return (
    <motion.div variants={fadeUp}>
      <Link
        href={service.href}
        className="group flex h-full min-h-[210px] flex-col rounded-lg border border-[#d8e7ff] bg-white p-5 shadow-[0_12px_34px_rgba(10,15,60,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#97c2ff] hover:shadow-[0_18px_52px_rgba(10,15,60,0.13)]"
      >
        <div className="mb-7 flex items-start justify-between gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-[8px] text-white" style={{ backgroundColor: service.accent }}>
            <Icon className="h-6 w-6" />
          </span>
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-black ${statusClass}`}>{service.status}</span>
        </div>
        <div className="mt-auto">
          <h3 className={compact ? 'text-lg font-black leading-tight tracking-normal text-[#0a0f3c]' : 'text-xl font-black leading-tight tracking-normal text-[#0a0f3c]'}>
            {service.name}
          </h3>
          <p className="mt-3 text-sm font-medium leading-relaxed text-[#425071]">{service.desc}</p>
          <div className="mt-5 flex items-center gap-2 text-xs font-black text-[#0066ff]">
            <CircleDot className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            詳しく見る
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
