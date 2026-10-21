'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
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
import type { GenerationResult, GenerationSave } from '@/lib/tenjikai/generation-result'
import { readGenerationStatus, cancelGenerationStatus, validOperationHandle, withGenerationOperation, type ClientOperationStatus } from '@/lib/tenjikai/generation-status-client'

type Phase = 'input' | 'generating' | 'ready'

// ⚠️ src/app/(shell)/tenjikai/layout.tsx に置く。セクション（/tenjikai/<section>）を移っても、ここの状態は残る。
// shell=true のときは共通シェル（AppShell＋ToolFrame）の中身だけを描き、独自のサイドバーと外枠を出さない。
export default function TenjikaiApp({ shell = false }: { shell?: boolean }) {
  return <Suspense fallback={<p role="status" className="p-6">表示を確認しています。</p>}><TenjikaiAppBoundary shell={shell} /></Suspense>
}

function TenjikaiAppBoundary({ shell }: { shell: boolean }) {
  const query = useSearchParams()
  const mode = projectModeFromQuery(query)
  const scope = useEntryActorScope()
  const urlOperation = query.get('operation')
  const [recoveryContext, setRecoveryContext] = useState<{ actor: string; version: number; operationId: string } | null>(null)
  const recoveryOperationId = validOperationHandle(urlOperation) ? urlOperation
    : recoveryContext?.version === scope.version && recoveryContext.actor === scope.actor ? recoveryContext.operationId : null
  useEffect(() => {
    if (scope.status !== 'authenticated' || !scope.actor || !validOperationHandle(urlOperation)) return
    setRecoveryContext(previous => previous?.actor && previous.actor !== scope.actor ? previous
      : { actor: scope.actor, version: scope.version, operationId: urlOperation })
  }, [urlOperation, scope.actor, scope.version, scope.status])
  const rememberRecovery = useCallback((operationId: string | null) => setRecoveryContext(operationId && scope.actor
    ? { actor: scope.actor, version: scope.version, operationId } : null), [scope.actor, scope.version])
  const scopeCurrent = scope.current, scopeActor = scope.actor, scopeStatus = scope.status
  const currentActor = useCallback(() => scopeStatus === 'authenticated' && !!scopeActor && scopeCurrent(), [scopeStatus, scopeActor, scopeCurrent])
  const { update } = useSession()
  const [working, setWorking] = useState<{ actor: string; epoch: number; projectId: string } | null>(null)
  const [workspaceEpoch, setWorkspaceEpoch] = useState(0)
  const [blocked, setBlocked] = useState(false)
  const verificationSeq = useRef(0)
  const currentWorking = working?.actor === scope.actor && working.epoch === scope.version && scope.status === 'authenticated' ? working : null
  const modeKind = mode.kind
  const modeId = mode.kind === 'saved' ? mode.id : null
  const previousMode = useRef({ kind: modeKind, id: modeId })
  const leavingWorking = previousMode.current.kind === 'saved'
    && (modeKind === 'new' || modeKind === 'saved' && modeId !== previousMode.current.id)
  useEffect(() => {
    previousMode.current = { kind: modeKind, id: modeId }
    if (leavingWorking) { setWorking(null); setWorkspaceEpoch(value => value + 1) }
  }, [modeKind, modeId, leavingWorking])
  useEffect(() => { verificationSeq.current += 1; setBlocked(false) }, [scope.version])
  const currentScope = scope.current
  useEffect(() => {
    const verify = () => {
      const seq = ++verificationSeq.current
      void update().then(checked => {
        if (seq === verificationSeq.current && currentScope() && checked?.user?.id === scope.actor && scope.status === 'authenticated') setBlocked(false)
      }).catch(() => {})
    }
    const hide = () => flushSync(() => { verificationSeq.current += 1; setBlocked(true); setWorking(null) })
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) { hide(); verify() }
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => { verificationSeq.current += 1; window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [update, currentScope, scope.actor, scope.status])
  if (blocked || scope.status === 'loading') return <div role="status" className="p-6">ログイン状態を確認しています。
    {blocked && <button type="button" className="ml-3 underline" onClick={() => {
      const seq = ++verificationSeq.current
      void update().then(checked => {
        if (seq === verificationSeq.current && scope.current() && checked?.user?.id === scope.actor && scope.status === 'authenticated') setBlocked(false)
      }).catch(() => {})
    }}>再読み込み</button>}
  </div>
  if (leavingWorking) return <p role="status" className="p-6">案件の表示を切り替えています。</p>
  if (mode.kind === 'invalid') return <InvalidProjectMode shell={shell} mode={mode} />
  if (mode.kind === 'saved' && mode.id !== currentWorking?.projectId) return <SavedProjectMode shell={shell} mode={mode} recoveryOperationId={recoveryOperationId} />
  return <TenjikaiAppContent key={`${scope.version}:${workspaceEpoch}`} shell={shell} currentActor={currentActor}
    actorId={scope.actor} activeProjectId={currentWorking?.projectId ?? null} recoveryOperationId={recoveryOperationId} onRecoveryOperation={rememberRecovery}
    onWorking={projectId => setWorking({ actor: scope.actor, epoch: scope.version, projectId })}
    onNew={() => { setWorking(null); setWorkspaceEpoch(value => value + 1) }} onAuthChanged={() => { setWorking(null); setBlocked(true) }} />
}

function SavedProjectMode({ shell, mode, recoveryOperationId }: { shell: boolean; mode: Extract<ProjectMode, { kind: 'saved' }>; recoveryOperationId: string | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const section = sectionFromPath(pathname)
  const { phase, detail, reload } = useSavedProjectDetail(mode.id)
  const overviewHref = withGenerationOperation(projectSectionHref('overview', mode), recoveryOperationId)
  useEffect(() => {
    if (section === 'new') router.replace(overviewHref)
  }, [section, overviewHref, router])
  if (section === 'new') return <p role="status" className="p-6">保存内容を読み込んでいます。</p>
  return <ProjectModeFrame shell={shell} mode={mode} section={section} projectName={detail?.project.projectName} recoveryOperationId={recoveryOperationId}>
    <SavedProjectPartialView phase={phase} detail={detail} section={section} onReload={reload} loginCallbackUrl={withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId)} newProjectHref={withGenerationOperation(sectionHref('new'), recoveryOperationId)} />
  </ProjectModeFrame>
}

function InvalidProjectMode({ shell, mode }: { shell: boolean; mode: Extract<ProjectMode, { kind: 'invalid' }> }) {
  const pathname = usePathname()
  const section = sectionFromPath(pathname)
  return <ProjectModeFrame shell={shell} mode={mode} section={section === 'new' ? 'overview' : section}>
    <SavedProjectPartialView phase="invalid_project" detail={null} section={section} onReload={() => {}} loginCallbackUrl={pathname ?? '/tenjikai'} />
  </ProjectModeFrame>
}

function ProjectModeFrame({ shell, mode, section, projectName, recoveryOperationId, children }: {
  shell: boolean; mode: ProjectMode; section: Section; projectName?: string; recoveryOperationId?: string | null; children: ReactNode
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const go = (next: Section) => { router.push(withGenerationOperation(projectSectionHref(next, mode), recoveryOperationId ?? null)); setMobileOpen(false) }
  if (shell) return <div className="tenjikai-root text-ink">{children}</div>
  return <div className="tenjikai-root flex h-screen overflow-hidden bg-[var(--bg)] text-ink">
    <div className="hidden md:flex"><TenjikaiSidebar section={section} ready go={go} isCollapsed={collapsed} onToggle={setCollapsed} projectName={projectName} savedMode loginCallbackUrl={withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId ?? null)} /></div>
    <AnimatePresence>{mobileOpen && <>
      <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
        <TenjikaiSidebar section={section} ready go={go} forceExpanded isMobile onToggle={() => setMobileOpen(false)} projectName={projectName} savedMode loginCallbackUrl={withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId ?? null)} />
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

function TenjikaiAppContent({ shell, currentActor, actorId, activeProjectId, recoveryOperationId, onRecoveryOperation, onWorking, onNew, onAuthChanged }: {
  shell: boolean; currentActor: () => boolean; actorId: string; activeProjectId: string | null
  recoveryOperationId: string | null; onRecoveryOperation: (operationId: string | null) => void
  onWorking: (projectId: string) => void; onNew: () => void; onAuthChanged: () => void
}) {
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
  const [save, setSave] = useState<GenerationSave | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [failureKind, setFailureKind] = useState<'unknown' | 'known' | 'rejected' | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [animDone, setAnimDone] = useState(false)
  const requestSeq = useRef(0)
  const requestController = useRef<AbortController | null>(null)
  const operationRef = useRef<string | null>(null)
  const locallyStartedOperation = useRef<string | null>(null)
  const [operationStatus, setOperationStatus] = useState<ClientOperationStatus | null>(null)
  useEffect(() => () => { requestSeq.current++; requestController.current?.abort() }, [])

  const activeRecoveryHandle = recoveryOperationId
  const recoveredStatus = operationStatus?.operationId === activeRecoveryHandle ? operationStatus : null
  const terminalRecovery = recoveredStatus && ['completed', 'degraded', 'failed', 'canceled'].includes(recoveredStatus.state)
  const recoveryBlocksNew = !!activeRecoveryHandle && !terminalRecovery
  useEffect(() => {
    if (!activeRecoveryHandle || requestController.current || locallyStartedOperation.current === activeRecoveryHandle) return
    operationRef.current = activeRecoveryHandle
    setOperationStatus(previous => previous?.operationId === activeRecoveryHandle ? previous : null)
    setFailureKind('unknown')
    setError('この操作の保存状態を確認しています。確認が終わるまで新しい操作は開始できません。')
    const controller = new AbortController()
    void readGenerationStatus(actorId, activeRecoveryHandle, controller.signal).then(status => {
      if (controller.signal.aborted || !currentActor()) return
      if (!status) {
        setOperationStatus(null)
        setError('この操作の保存状態を確認できませんでした。新しい操作を始めず、状態を再確認してください。')
        return
      }
      setOperationStatus(status)
      onRecoveryOperation(activeRecoveryHandle)
      setError(status.state === 'reserved'
        ? '作成結果を確認できませんでした。操作はAI開始前です。元と同じ入力で続けられます。'
        : status.state === 'missing'
          ? 'この操作はまだ到着していない可能性があります。遅れて届く操作の取消を確認するまで、新しい操作は開始できません。'
          : '操作の保存状態を確認しました。保存済みの範囲をご確認ください。')
    })
    return () => controller.abort()
  }, [activeRecoveryHandle, actorId, currentActor, onRecoveryOperation])

  const checkOperation = () => {
    const operationId = activeRecoveryHandle
    if (!operationId || !currentActor()) return
    const controller = new AbortController()
    void readGenerationStatus(actorId, operationId, controller.signal).then(status => {
      if (!currentActor() || operationRef.current !== operationId) return
      setOperationStatus(status)
      if (!status) setError('この操作の保存状態を確認できませんでした。新しい操作を始めず、状態を再確認してください。')
    })
  }
  const cancelMissingOperation = () => {
    const operationId = activeRecoveryHandle
    if (!operationId || recoveredStatus?.state !== 'missing' || !currentActor()) return
    const controller = new AbortController()
    void cancelGenerationStatus(actorId, operationId, controller.signal).then(status => {
      if (!currentActor() || operationRef.current !== operationId) return
      if (status) setOperationStatus(status)
      setError(status?.state === 'canceled'
        ? '遅れて届く操作の取消を確認しました。新しい操作を始められます。'
        : '取消を確認できませんでした。新しい操作を始めず、状態を再確認してください。')
    })
  }

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

  const start = (next: ProjectInput, explicitSameOperation = false) => {
    if (!currentActor() || requestController.current || failureKind === 'unknown' && !explicitSameOperation || failureKind === 'known' && !!projectId) return
    if (activeRecoveryHandle && !(explicitSameOperation && recoveredStatus?.state === 'reserved')) return
    if (explicitSameOperation && recoveredStatus?.state !== 'reserved') return
    setError(null)
    setFailureKind(null)
    setInput(next)
    setSelectedNovelty(generateNovelties(next).filter((n) => n.recommended).map((n) => n.id))
    setVariant(next.goal === 'demo' ? 'A' : next.goal === 'brand' ? 'B' : 'C')
    setAnimDone(false)
    setPending(true)
    setPhase('generating')
    const seq = ++requestSeq.current
    const requestId = crypto.randomUUID()
    const operationId = explicitSameOperation && activeRecoveryHandle ? activeRecoveryHandle : `${Date.now()}.${crypto.randomUUID()}`
    operationRef.current = operationId
    locallyStartedOperation.current = operationId
    onRecoveryOperation(operationId)
    setOperationStatus(null)
    const controller = new AbortController()
    requestController.current = controller
    router.replace(`${sectionHref('new')}?operation=${encodeURIComponent(operationId)}`)
    const recoverAfterUnknown = () => {
      const statusController = new AbortController()
      void readGenerationStatus(actorId, operationId, statusController.signal).then(status => {
        if (currentActor() && seq === requestSeq.current && operationRef.current === operationId && status) setOperationStatus(status)
      })
    }
    requestGeneratedPlan(next, actorId, operationId, requestId, controller.signal).then((result: GenerationResult) => {
      if (!currentActor() || seq !== requestSeq.current) return
      if (result.state === 'generated') {
        setDocs([])
        setDone([])
        setPanelImages({})
        setGenerated(result.plan)
        setProjectId(result.projectId)
        setSave(result.save)
        setOperationStatus({ actorId, operationId, state: result.save.analysis === 'saved' ? 'completed' : 'degraded', projectId: result.projectId, analysis: result.save.analysis, dispatchAllowed: false })
        setFailureKind(null)
        onWorking(result.projectId)
      } else if (result.state === 'auth_changed') {
        onAuthChanged()
        return
      } else {
        setError(result.message)
        setProjectId(result.projectId)
        setSave(result.save)
        setFailureKind(result.state === 'outcome_unknown' ? 'unknown' : result.state === 'generation_failed' ? 'known' : 'rejected')
        if (result.state === 'generation_failed') setOperationStatus({ actorId, operationId, state: 'failed', projectId: result.projectId, analysis: 'not_saved', dispatchAllowed: false })
        setPhase('input')
        if (result.state === 'outcome_unknown' || result.state === 'rejected') recoverAfterUnknown()
      }
      setPending(false)
    }).catch(() => {
      if (currentActor() && seq === requestSeq.current) {
        setError('案件の作成結果を確認できませんでした。再度作成せず、保存状況をご確認ください。')
        setFailureKind('unknown')
        setPhase('input')
        setPending(false)
        recoverAfterUnknown()
      }
    }).finally(() => { if (requestController.current === controller) requestController.current = null })
  }

  const onGeneratingDone = useCallback(() => setAnimDone(true), [])

  // 演出と API の両方が終わってから結果画面へ
  useEffect(() => {
    if (currentActor() && phase === 'generating' && animDone && !pending && projectId && activeProjectId === projectId) {
      setPhase('ready')
      // 条件を入れたら、次は 3D で確かめる（利用者の流れ。2026-10-19 ユーザー指示）
      router.push(projectSectionHref('booth', { kind: 'saved', id: projectId }))
    }
  }, [phase, animDone, pending, router, currentActor, projectId, activeProjectId])

  const go = (s: Section) => {
    if (s === 'new' && (requestController.current || recoveryBlocksNew)) return
    if (s === 'new') { requestSeq.current++; requestController.current?.abort(); requestController.current = null; operationRef.current = null; locallyStartedOperation.current = null; onRecoveryOperation(null); setOperationStatus(null); setPhase('input'); setProjectId(null); setError(null); setFailureKind(null); onNew() }
    router.push(s === 'new' || !activeProjectId ? sectionHref(s) : projectSectionHref(s, { kind: 'saved', id: activeProjectId }))
    setMobileOpen(false)
  }

  const content = (() => {
    if (phase === 'generating')
      return (
        <Generating
          analysis={pending ? null : analysis}
          input={input}
          onDone={onGeneratingDone}
        />
      )
    if (phase === 'input' || section === 'new') return <Wizard initial={input} onSubmit={next => start(next, recoveredStatus?.state === 'reserved')} submitLabel={recoveredStatus?.state === 'reserved' ? '同じ操作で生成を続ける' : undefined} submitDisabled={!!activeRecoveryHandle && recoveredStatus?.state !== 'reserved' || failureKind === 'unknown' && recoveredStatus?.state !== 'reserved' || failureKind === 'known' && !!projectId} />
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
      {error && <div role="alert" className="mx-auto max-w-6xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 md:mx-8">
        <p>{error}{failureKind === 'unknown' && ' 作成された可能性があるため、ここからの再送は停止しています。'}</p>
        {projectId ? <Link href={projectSectionHref('overview', { kind: 'saved', id: projectId })} className="mt-2 inline-block font-semibold underline">保存案件の基本情報を確認</Link>
          : failureKind === 'unknown' ? <Link href="/home" className="mt-2 inline-block font-semibold underline">ホームで保存案件を確認</Link> : null}
        {(failureKind === 'unknown' || failureKind === 'rejected') && <>
          {failureKind === 'unknown' && <p className="mt-2">一覧に見つからない場合も、案件が作成されなかった証明にはなりません。</p>}
          {activeRecoveryHandle && <button type="button" className="mt-2 block font-semibold underline" onClick={checkOperation}>この操作の状態を確認</button>}
          {recoveredStatus?.state === 'reserved' && <p className="mt-2">AIはまだ開始されていません。元と同じ入力を確認してから、同じ操作として生成を続けられます。</p>}
          {recoveredStatus?.state === 'missing' && <button type="button" className="mt-2 block font-semibold underline" onClick={cancelMissingOperation}>遅れて届く操作を取り消す</button>}
          {terminalRecovery && <button type="button" className="mt-2 block font-semibold underline" onClick={() => go('new')}>別の案件を新規作成</button>}
          {recoveredStatus?.projectId && <Link href={withGenerationOperation(projectSectionHref('overview', { kind: 'saved', id: recoveredStatus.projectId }), activeRecoveryHandle)} className="mt-2 block font-semibold underline">確認できる保存案件を開く</Link>}
          {recoveredStatus && <p className="mt-2">操作状態: {recoveredStatus.state === 'completed' ? '基本情報と分析を保存済み' : recoveredStatus.state === 'degraded' ? '基本情報のみ確認済み' : recoveredStatus.state === 'failed' ? '生成に失敗しました' : recoveredStatus.state === 'reserved' ? 'AI開始前' : recoveredStatus.state === 'processing' || recoveredStatus.state === 'unknown' ? 'AI実行結果を確認中' : recoveredStatus.state === 'missing' ? '未到着の可能性があります' : recoveredStatus.state === 'canceled' ? '取消済み' : recoveredStatus.state === 'deleted' ? '案件を確認できません' : '現在の案件と一致しません'}。元の3D案は再現されません。</p>}
        </>}
        {failureKind === 'known' && terminalRecovery && <button type="button" className="mt-2 block font-semibold underline" onClick={() => go('new')}>別の案件を新規作成</button>}
      </div>}
      {phase === 'ready' && section !== 'new' && save && (
        <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
          <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">
            案件の基本情報を保存しました。会場の指定やブース案などは、この画面内にのみ保持されています。
            {save.analysis !== 'saved' && ' 分析結果の保存を確認できません。この画面を閉じると失われる可能性があります。'}
            {generated.notice && ` ${generated.notice}`}
          </p>
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
        <TenjikaiSidebar section={phase === 'ready' ? section : 'new'} ready={phase === 'ready'} go={go} isCollapsed={collapsed} onToggle={setCollapsed} projectName={phase === 'input' ? undefined : input.eventName} workingMode={!!activeProjectId} />
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
            <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
              <TenjikaiSidebar section={phase === 'ready' ? section : 'new'} ready={phase === 'ready'} go={go} forceExpanded isMobile onToggle={() => setMobileOpen(false)} projectName={phase === 'input' ? undefined : input.eventName} workingMode={!!activeProjectId} />
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
