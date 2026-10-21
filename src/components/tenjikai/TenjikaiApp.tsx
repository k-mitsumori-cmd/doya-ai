'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import TenjikaiSidebar from './TenjikaiSidebar'
import { sectionFromPath, sectionHref, type Section } from '@/lib/tenjikai/nav'
import { projectModeFromQuery, projectSectionHref, type ProjectMode } from '@/lib/tenjikai/project-detail-mode'
import { useSavedProjectDetail } from '@/lib/tenjikai/use-saved-project-detail'
import SavedProjectPartialView from './SavedProjectPartialView'
import Wizard from './Wizard'
import Generating from './Generating'
import Overview from './Overview'
import BoothStudio from './BoothStudio'
import CreativeStudio from './CreativeStudio'
import NoveltyPicker from './NoveltyPicker'
import BudgetPlanner from './BudgetPlanner'
import VendorBoard from './VendorBoard'
import DocsVault, { type TenjikaiDocumentDraft } from './DocsVault'
import { useEntryActorScope } from '@/lib/use-entry-organization'
import {
  SAMPLE_INPUT,
  applyBoothCopy,
  applyCreativeCopy,
  computeBudget,
  generateBoothPlans,
  generateCreatives,
  generateDeadlines,
  generateNovelties,
  mockGeneratedPlan,
  requestGeneratedPlan,
  type GeneratedPlan,
  type ProjectInput,
} from '@/lib/tenjikai/engine'

type Phase = 'input' | 'generating' | 'ready'

// ⚠️ src/app/(shell)/tenjikai/layout.tsx に置く。セクション（/tenjikai/<section>）を移っても、ここの状態は残る。
// shell=true のときは共通シェル（AppShell＋ToolFrame）の中身だけを描き、独自のサイドバーと外枠を出さない。
export default function TenjikaiApp({ shell = false }: { shell?: boolean }) {
  return <Suspense fallback={<p role="status" className="p-6">表示を確認しています。</p>}><TenjikaiAppBoundary shell={shell} /></Suspense>
}

function TenjikaiAppBoundary({ shell }: { shell: boolean }) {
  const mode = projectModeFromQuery(useSearchParams())
  const scope = useEntryActorScope()
  if (mode.kind === 'invalid') return <InvalidProjectMode shell={shell} mode={mode} />
  if (mode.kind === 'saved') return <SavedProjectMode shell={shell} mode={mode} />
  return <TenjikaiAppContent key={scope.version} shell={shell} currentActor={scope.current} />
}

function SavedProjectMode({ shell, mode }: { shell: boolean; mode: Extract<ProjectMode, { kind: 'saved' }> }) {
  const router = useRouter()
  const pathname = usePathname()
  const section = sectionFromPath(pathname)
  const { phase, detail, reload } = useSavedProjectDetail(mode.id)
  const overviewHref = projectSectionHref('overview', mode)
  useEffect(() => {
    if (section === 'new') router.replace(overviewHref)
  }, [section, overviewHref, router])
  if (section === 'new') return <p role="status" className="p-6">保存内容を読み込んでいます。</p>
  return <ProjectModeFrame shell={shell} mode={mode} section={section} projectName={detail?.project.projectName}>
    <SavedProjectPartialView phase={phase} detail={detail} section={section} onReload={reload} loginCallbackUrl={projectSectionHref(section, mode)} />
  </ProjectModeFrame>
}

function InvalidProjectMode({ shell, mode }: { shell: boolean; mode: Extract<ProjectMode, { kind: 'invalid' }> }) {
  const pathname = usePathname()
  const section = sectionFromPath(pathname)
  return <ProjectModeFrame shell={shell} mode={mode} section={section === 'new' ? 'overview' : section}>
    <SavedProjectPartialView phase="invalid_project" detail={null} section={section} onReload={() => {}} loginCallbackUrl={pathname ?? '/tenjikai'} />
  </ProjectModeFrame>
}

function ProjectModeFrame({ shell, mode, section, projectName, children }: {
  shell: boolean; mode: ProjectMode; section: Section; projectName?: string; children: ReactNode
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const go = (next: Section) => { router.push(projectSectionHref(next, mode)); setMobileOpen(false) }
  if (shell) return <div className="tenjikai-root text-ink">{children}</div>
  return <div className="tenjikai-root flex h-screen overflow-hidden bg-[var(--bg)] text-ink">
    <div className="hidden md:flex"><TenjikaiSidebar section={section} ready go={go} isCollapsed={collapsed} onToggle={setCollapsed} projectName={projectName} savedMode loginCallbackUrl={projectSectionHref(section, mode)} /></div>
    <AnimatePresence>{mobileOpen && <>
      <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
        <TenjikaiSidebar section={section} ready go={go} forceExpanded isMobile onToggle={() => setMobileOpen(false)} projectName={projectName} savedMode loginCallbackUrl={projectSectionHref(section, mode)} />
      </motion.div>
    </>}</AnimatePresence>
    <main className="flex flex-1 flex-col overflow-hidden transition-[margin] duration-200 md:ml-[var(--tenjikai-sidebar-w)]" style={{ ['--tenjikai-sidebar-w' as string]: collapsed ? '72px' : '240px' }}>
      <div className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--paper)] p-3 md:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="rounded-[var(--r-sm)] p-2 text-[var(--sub)] hover:bg-[var(--blue-soft)]" aria-label="メニューを開く"><Menu className="h-6 w-6" /></button>
        <span className="font-display text-lg text-ink">ドヤ展示会</span>
      </div>
      <div className="floor flex-1 overflow-y-auto">{children}</div>
    </main>
  </div>
}

function TenjikaiAppContent({ shell, currentActor }: { shell: boolean; currentActor: () => boolean }) {
  const router = useRouter()
  const section = sectionFromPath(usePathname())
  const [phase, setPhase] = useState<Phase>('input')
  const [input, setInput] = useState<ProjectInput>(SAMPLE_INPUT)
  const [variant, setVariant] = useState<'A' | 'B' | 'C'>('A')
  const [selectedNovelty, setSelectedNovelty] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  // 3D図面の面ごとの画像と完成予想図。セクションを移っても消えないよう、ここで持つ
  const [panelImages, setPanelImages] = useState<Record<string, string>>({})
  const [docs, setDocs] = useState<TenjikaiDocumentDraft[]>([])
  const [done, setDone] = useState<string[]>([])

  // 文面（解析・ブース案・制作物）は API で作り、寸法・金額はルール計算に重ねる
  const [generated, setGenerated] = useState<GeneratedPlan>(() => mockGeneratedPlan(SAMPLE_INPUT))
  const [pending, setPending] = useState(false)
  const [animDone, setAnimDone] = useState(false)
  const requestSeq = useRef(0)
  useEffect(() => () => { requestSeq.current++ }, [])

  const analysis = generated.analysis
  const plans = useMemo(() => applyBoothCopy(generateBoothPlans(input), generated.boothCopy), [input, generated.boothCopy])
  const plan = plans.find((p) => p.variant === variant) ?? plans[0]
  const creatives = useMemo(() => applyCreativeCopy(generateCreatives(analysis, input), generated.creativeCopy), [analysis, input, generated.creativeCopy])
  const novelties = useMemo(() => generateNovelties(input), [input])
  const deadlines = useMemo(() => generateDeadlines(input), [input])
  const budget = useMemo(
    () => computeBudget(input, plan, creatives, novelties, selectedNovelty),
    [input, plan, creatives, novelties, selectedNovelty],
  )

  const start = (next: ProjectInput) => {
    if (!currentActor()) return
    setDocs([])
    setDone([])
    setPanelImages({})
    setInput(next)
    setSelectedNovelty(generateNovelties(next).filter((n) => n.recommended).map((n) => n.id))
    setVariant(next.goal === 'demo' ? 'A' : next.goal === 'brand' ? 'B' : 'C')
    setGenerated(mockGeneratedPlan(next))
    setAnimDone(false)
    setPending(true)
    setPhase('generating')
    const seq = ++requestSeq.current
    requestGeneratedPlan(next).then((g) => {
      if (!currentActor() || seq !== requestSeq.current) return
      setGenerated(g)
      setPending(false)
    })
  }

  const onGeneratingDone = useCallback(() => setAnimDone(true), [])

  // 演出と API の両方が終わってから結果画面へ
  useEffect(() => {
    if (currentActor() && phase === 'generating' && animDone && !pending) {
      setPhase('ready')
      // 条件を入れたら、次は 3D で確かめる（利用者の流れ。2026-10-19 ユーザー指示）
      router.push(sectionHref('booth'))
    }
  }, [phase, animDone, pending, router, currentActor])

  const go = (s: Section) => {
    if (s === 'new') setPhase('input')
    router.push(sectionHref(s))
    setMobileOpen(false)
  }

  const content = (() => {
    if (phase === 'generating')
      return (
        <Generating
          analysis={analysis}
          input={input}
          onDone={onGeneratingDone}
        />
      )
    if (phase === 'input' || section === 'new') return <Wizard initial={input} onSubmit={start} />
    switch (section) {
      case 'overview':
        return <Overview input={input} analysis={analysis} plan={plan} budget={budget} deadlines={deadlines} creatives={creatives} go={go} />
      case 'booth':
        return <BoothStudio plans={plans} variant={variant} setVariant={setVariant} input={input} analysis={analysis} panelImages={panelImages} setPanelImages={setPanelImages} />
      case 'creatives':
        return <CreativeStudio creatives={creatives} analysis={analysis} />
      case 'novelty':
        return <NoveltyPicker input={input} novelties={novelties} selected={selectedNovelty} setSelected={setSelectedNovelty} />
      case 'budget':
        return <BudgetPlanner input={input} setInput={setInput} budget={budget} />
      case 'vendors':
        return <VendorBoard input={input} plan={plan} creatives={creatives} analysis={analysis} budget={budget} />
      case 'docs':
        return <DocsVault deadlines={deadlines} input={input} docs={docs} setDocs={setDocs} done={done} setDone={setDone} />
    }
  })()

  const key = phase === 'ready' ? section : phase

  const body = (
    <>
      {phase === 'ready' && section !== 'new' && generated.notice && (
        <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">{generated.notice}</p>
        </div>
      )}
      {/* 画面の切り替えにアニメーションを付けない。前の画面が消えるのを待つ作りだと、
          アニメーションが止まる環境（裏のタブ・重い端末）で、薄い色や空白のまま止まって見えるため（F-12） */}
      <div key={key} className="min-h-full">
        {content}
      </div>
    </>
  )

  // 共通シェルの中：外枠・サイドバー・スマホの見出しはシェル側が持つ
  if (shell) return <div className="tenjikai-root text-ink">{body}</div>

  return (
    <div className="tenjikai-root flex h-screen overflow-hidden bg-[var(--bg)] text-ink">
      <div className="hidden md:flex">
        <TenjikaiSidebar section={phase === 'ready' ? section : 'new'} ready={phase === 'ready'} go={go} isCollapsed={collapsed} onToggle={setCollapsed} projectName={phase === 'input' ? undefined : input.eventName} />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
              <TenjikaiSidebar section={phase === 'ready' ? section : 'new'} ready={phase === 'ready'} go={go} forceExpanded isMobile onToggle={() => setMobileOpen(false)} projectName={phase === 'input' ? undefined : input.eventName} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 共通サイドバー（SidebarShell）はデスクトップで fixed のため、幅のぶん本文をずらす */}
      <main className="flex flex-1 flex-col overflow-hidden transition-[margin] duration-200 md:ml-[var(--tenjikai-sidebar-w)]" style={{ ['--tenjikai-sidebar-w' as string]: collapsed ? '72px' : '240px' }}>
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gradient-to-r from-doya-50 to-white p-3 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100" aria-label="メニューを開く">
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-display text-lg text-ink">ドヤ展示会</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">開発中</span>
        </div>
        <div className="floor flex-1 overflow-y-auto">{body}</div>
      </main>
    </div>
  )
}
