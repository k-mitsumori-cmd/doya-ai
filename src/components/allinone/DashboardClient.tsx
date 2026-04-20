'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Trophy,
  Globe,
  Search,
  Target,
  Palette,
  Image as ImageIcon,
  ListChecks,
  BarChart3,
  Sparkles,
  MessageSquare,
  FileDown,
  ExternalLink,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'
import type {
  AnalysisSummary,
  SiteAnalysis,
  SeoAnalysis,
  Persona,
  BrandingAnalysis,
  KeyVisual,
  ActionItem,
} from '@/lib/allinone/types'
import { DashboardSummary } from './tabs/DashboardSummary'
import { SiteTab } from './tabs/SiteTab'
import { SeoTab } from './tabs/SeoTab'
import { PersonaTab } from './tabs/PersonaTab'
import { BrandingTab } from './tabs/BrandingTab'
import { VisualTab } from './tabs/VisualTab'
import { ActionTab } from './tabs/ActionTab'
import { AdsBridgeTab } from './tabs/AdsBridgeTab'
import { ChatPanel } from './ChatPanel'
import { ExportMenu } from './ExportMenu'

const TABS = [
  { id: 'summary', label: 'サマリー', icon: Trophy, color: 'from-violet-500 to-fuchsia-500' },
  { id: 'site', label: 'サイト診断', icon: Globe, color: 'from-cyan-500 to-blue-500' },
  { id: 'seo', label: 'SEO', icon: Search, color: 'from-emerald-500 to-teal-500' },
  { id: 'persona', label: 'ペルソナ', icon: Target, color: 'from-pink-500 to-rose-500' },
  { id: 'branding', label: 'ブランド', icon: Palette, color: 'from-amber-500 to-orange-500' },
  { id: 'visual', label: 'ビジュアル', icon: ImageIcon, color: 'from-fuchsia-500 to-pink-500' },
  { id: 'action', label: 'アクション', icon: ListChecks, color: 'from-indigo-500 to-blue-600' },
  { id: 'ads', label: '広告運用', icon: BarChart3, color: 'from-blue-500 to-indigo-600' },
] as const

type TabId = (typeof TABS)[number]['id']

interface DashboardAnalysis {
  id: string
  url: string
  title: string | null
  description: string | null
  favicon: string | null
  heroImage: string | null
  ogImage: string | null
  status: string
  overallScore: number | null
  radar: any
  summary: AnalysisSummary | null
  siteAnalysis: SiteAnalysis | null
  seoAnalysis: SeoAnalysis | null
  personas: Persona[] | null
  branding: BrandingAnalysis | null
  keyVisuals: KeyVisual[] | null
  actionPlan: ActionItem[] | null
  createdAt: string
  chats: any[]
}

export function DashboardClient({ analysis }: { analysis: DashboardAnalysis }) {
  const [active, setActive] = useState<TabId>('summary')
  const [chatOpen, setChatOpen] = useState(true)
  const [verbose, setVerbose] = useState(false)
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [data, setData] = useState(analysis)

  const handleRegenerate = async (section: string) => {
    setRegenerating(section)
    try {
      const res = await fetch(`/api/allinone/analysis/${data.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, verbose }),
      })
      if (res.ok) {
        const j = await res.json()
        setData((d) => ({ ...d, ...j.patch }))
      }
    } finally {
      setRegenerating(null)
    }
  }

  return (
    <div className="relative">
      {/* ヘッダー */}
      <DashboardHeader
        analysis={data}
        verbose={verbose}
        setVerbose={setVerbose}
        onToggleChat={() => setChatOpen((v) => !v)}
        chatOpen={chatOpen}
      />

      <div className={`mx-auto max-w-7xl px-4 sm:px-6 ${chatOpen ? 'lg:pr-[420px]' : ''}`}>
        {/* タブ */}
        <nav className="sticky top-[64px] z-30 -mx-4 mb-6 flex gap-1 overflow-x-auto bg-gradient-to-b from-white via-white to-white/80 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = active === t.id
            return (
              <button
                key={t.id}
                data-tab={t.id}
                onClick={() => setActive(t.id)}
                className={`group relative flex flex-none items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                  isActive
                    ? 'bg-allinone-ink text-white shadow-lg'
                    : 'border border-allinone-line bg-white text-allinone-inkSoft hover:border-allinone-primary/40 hover:text-allinone-primary'
                }`}
              >
                <span
                  className={`grid h-5 w-5 place-items-center rounded-md ${
                    isActive ? 'bg-white/20' : `bg-gradient-to-br ${t.color} text-white`
                  }`}
                >
                  <Icon className="h-3 w-3" />
                </span>
                {t.label}
              </button>
            )
          })}
        </nav>

        {/* タブ内容 */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.25 }}
          >
            {active === 'summary' && <DashboardSummary analysis={data} />}
            {active === 'site' && (
              <SiteTab
                site={data.siteAnalysis}
                onRegenerate={() => handleRegenerate('site')}
                isRegenerating={regenerating === 'site'}
              />
            )}
            {active === 'seo' && (
              <SeoTab
                seo={data.seoAnalysis}
                siteUrl={data.url}
                onRegenerate={() => handleRegenerate('seo')}
                isRegenerating={regenerating === 'seo'}
                verbose={verbose}
              />
            )}
            {active === 'persona' && (
              <PersonaTab
                personas={data.personas || []}
                siteUrl={data.url}
                onRegenerate={() => handleRegenerate('persona')}
                isRegenerating={regenerating === 'persona'}
              />
            )}
            {active === 'branding' && (
              <BrandingTab
                branding={data.branding}
                heroImage={data.heroImage}
                ogImage={data.ogImage}
                onRegenerate={() => handleRegenerate('branding')}
                isRegenerating={regenerating === 'branding'}
              />
            )}
            {active === 'visual' && (
              <VisualTab
                visuals={data.keyVisuals || []}
                siteUrl={data.url}
                onRegenerate={() => handleRegenerate('visual')}
                isRegenerating={regenerating === 'visual'}
              />
            )}
            {active === 'action' && (
              <ActionTab
                actions={data.actionPlan || []}
                onRegenerate={() => handleRegenerate('action')}
                isRegenerating={regenerating === 'action'}
                verbose={verbose}
              />
            )}
            {active === 'ads' && <AdsBridgeTab analysis={data} />}
          </motion.div>
        </AnimatePresence>

        {/* 下部: 全ドヤAIサービスへのブリッジ */}
        <ServiceBridgeGrid analysis={data} />
      </div>

      {/* チャットパネル */}
      <ChatPanel
        analysisId={data.id}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        initialMessages={data.chats}
        verbose={verbose}
        setVerbose={setVerbose}
        focusSection={active}
      />
    </div>
  )
}

// ==============================================
// ヘッダー
// ==============================================
function DashboardHeader({
  analysis,
  verbose,
  setVerbose,
  onToggleChat,
  chatOpen,
}: {
  analysis: DashboardAnalysis
  verbose: boolean
  setVerbose: (v: boolean) => void
  onToggleChat: () => void
  chatOpen: boolean
}) {
  return (
    <section className="relative overflow-hidden border-b border-allinone-line bg-white">
      {/* ヒーローイメージ（サイトのOG/ファーストビュー） */}
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-allinone-primarySoft via-white to-cyan-50 sm:h-56">
        {analysis.heroImage || analysis.ogImage ? (
          <>
            <img
              src={analysis.heroImage || analysis.ogImage || ''}
              alt="site hero"
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />
          </>
        ) : (
          <div aria-hidden className="absolute inset-0 bg-grid-pattern bg-grid opacity-20" />
        )}
      </div>

      <div className="mx-auto -mt-16 max-w-7xl px-4 pb-6 sm:px-6">
        <div className="flex flex-col items-start gap-4 rounded-3xl border border-allinone-line bg-white p-5 shadow-xl shadow-allinone-primary/5 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-4">
            <div className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-2xl border border-allinone-line bg-allinone-surface">
              {analysis.favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={analysis.favicon} alt="favicon" className="h-10 w-10 object-contain" />
              ) : (
                <Globe className="h-7 w-7 text-allinone-muted" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[10px] font-black tracking-widest text-allinone-muted">
                ANALYSIS RESULT
              </div>
              <h1 className="truncate text-xl font-black text-allinone-ink sm:text-2xl">
                {analysis.title || analysis.url}
              </h1>
              <a
                href={analysis.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-allinone-muted hover:text-allinone-primary"
              >
                {analysis.url}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div className="flex items-center gap-2 rounded-full border border-allinone-line bg-white px-3 py-1.5 text-xs">
              <span className="text-allinone-muted">詳細モード</span>
              <button
                onClick={() => setVerbose(!verbose)}
                className={`relative h-5 w-10 rounded-full transition ${
                  verbose ? 'bg-allinone-primary' : 'bg-allinone-line'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    verbose ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            <ExportMenu analysisId={analysis.id} />
            <button
              onClick={onToggleChat}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${
                chatOpen
                  ? 'bg-allinone-primary text-white'
                  : 'border border-allinone-line bg-white text-allinone-ink hover:border-allinone-primary'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              AIチャット
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ==============================================
// 下部: サービスブリッジ
// ==============================================
function ServiceBridgeGrid({ analysis }: { analysis: DashboardAnalysis }) {
  const enc = encodeURIComponent
  const bridges = [
    {
      id: 'banner',
      name: 'ドヤバナーAI',
      desc: 'このキービジュアルを軸に、バナーを量産',
      color: 'from-purple-500 to-pink-500',
      href: `/banner?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'seo',
      name: 'ドヤ記事AI',
      desc: '不足キーワードを、長文記事に',
      color: 'from-slate-700 to-slate-900',
      href: `/seo?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'persona',
      name: 'ドヤペルソナAI',
      desc: 'このペルソナを詳細化',
      color: 'from-purple-500 to-purple-700',
      href: `/persona?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'lp',
      name: 'ドヤLP AI',
      desc: 'アクションから LP を組む',
      color: 'from-cyan-500 to-blue-500',
      href: `/lp?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'copy',
      name: 'ドヤコピーAI',
      desc: '訴求コピーを量産',
      color: 'from-amber-500 to-orange-500',
      href: `/copy?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'adsim',
      name: 'ドヤ広告シミュAI',
      desc: 'この診断から広告提案資料に',
      color: 'from-indigo-500 to-blue-600',
      href: `/adsim?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'movie',
      name: 'ドヤムービーAI',
      desc: 'キービジュアルから動画広告',
      color: 'from-rose-500 to-pink-500',
      href: `/movie?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
    {
      id: 'voice',
      name: 'ドヤボイスAI',
      desc: 'ナレーションを生成',
      color: 'from-violet-500 to-purple-500',
      href: `/voice?siteUrl=${enc(analysis.url)}&allinoneId=${analysis.id}`,
    },
  ]

  return (
    <section className="mt-16 border-t border-allinone-line pt-12 pb-20">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-allinone-primarySoft px-3 py-1 text-[11px] font-black text-allinone-primary">
            <Sparkles className="h-3 w-3" />
            BRIDGE TO TOOLS
          </div>
          <h2 className="text-2xl font-black text-allinone-ink sm:text-3xl">
            分析結果をドヤAIの各ツールへ
          </h2>
          <p className="mt-1 text-sm text-allinone-muted">
            ワンクリックで、各ツールに分析結果を引き継いで本格制作へ。
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {bridges.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
          >
            <Link
              href={b.href}
              className="group flex h-full flex-col justify-between rounded-2xl border border-allinone-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-allinone-primary hover:shadow-lg"
            >
              <div>
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${b.color} text-white shadow-md transition group-hover:scale-110 group-hover:rotate-3`}
                >
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="text-sm font-black text-allinone-ink">{b.name}</div>
                <div className="mt-1 text-xs text-allinone-muted">{b.desc}</div>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-black text-allinone-primary">
                使う
                <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
