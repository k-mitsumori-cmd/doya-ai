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
import { previewWorkspaceBudget, type FullTenjikaiWorkspace } from '@/lib/tenjikai/workspace-dto'
import { readSavedTenjikaiWorkspace } from '@/lib/tenjikai/workspace-client'
import { cancelMissingSave, newSaveHandle, readSaveStatus, saveWorkspace, validSaveHandle, withSaveHandle, type SaveResponse, type WorkspacePatch } from '@/lib/tenjikai/workspace-save-client'

type Phase = 'input' | 'generating' | 'ready'
const isTerminalRecovery = (status: ClientOperationStatus | null): boolean =>
  !!status?.terminalConfirmed && ['completed', 'degraded', 'failed', 'canceled', 'superseded'].includes(status.state)

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
  if (mode.kind === 'saved' && mode.id !== currentWorking?.projectId) return <SavedProjectMode shell={shell} mode={mode} recoveryOperationId={recoveryOperationId} onRecoveryOperation={rememberRecovery} />
  return <TenjikaiAppContent key={`${scope.version}:${workspaceEpoch}`} shell={shell} currentActor={currentActor}
    actorId={scope.actor} activeProjectId={currentWorking?.projectId ?? null} recoveryOperationId={recoveryOperationId} onRecoveryOperation={rememberRecovery}
    onWorking={projectId => setWorking({ actor: scope.actor, epoch: scope.version, projectId })}
    onNew={() => { setWorking(null); setWorkspaceEpoch(value => value + 1) }} onAuthChanged={() => { setWorking(null); setBlocked(true) }} />
}

function SavedProjectMode({ shell, mode, recoveryOperationId, onRecoveryOperation }: {
  shell: boolean; mode: Extract<ProjectMode, { kind: 'saved' }>; recoveryOperationId: string | null
  onRecoveryOperation: (operationId: string | null) => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const query = useSearchParams()
  const rawSave = query.get('saveOperation')
  const saveOperationId = validSaveHandle(rawSave) ? rawSave : null
  const section = sectionFromPath(pathname)
  const { phase, detail, workspace, reload } = useSavedProjectDetail(mode.id)
  const scope = useEntryActorScope()
  const [recovery, setRecovery] = useState<ClientOperationStatus | null>(null)
  const recoveryActor = scope.actor
  const recoveryCurrent = scope.current
  const recoveryStatus = scope.status
  const recoveryVersion = scope.version
  const recoverySeq = useRef(0)
  const checkRecovery = useCallback(() => {
    if (!recoveryOperationId || recoveryStatus !== 'authenticated' || !recoveryActor || !recoveryCurrent()) return
    const seq = ++recoverySeq.current
    const controller = new AbortController()
    void readGenerationStatus(recoveryActor, recoveryOperationId, controller.signal).then(result => {
      if (!controller.signal.aborted && seq === recoverySeq.current && recoveryCurrent()) setRecovery(result)
    })
    return () => controller.abort()
  }, [recoveryOperationId, recoveryStatus, recoveryActor, recoveryCurrent])
  useEffect(() => {
    setRecovery(null)
    const cleanup = checkRecovery()
    return () => cleanup?.()
  }, [checkRecovery, recoveryVersion])
  const cancelRecovery = () => {
    if (recovery?.state !== 'missing' || !recoveryOperationId || !recoveryActor || !recoveryCurrent()) return
    const seq = ++recoverySeq.current
    const controller = new AbortController()
    void cancelGenerationStatus(recoveryActor, recoveryOperationId, controller.signal).then(result => {
      if (seq === recoverySeq.current && recoveryCurrent()) setRecovery(result)
    })
  }
  const terminalRecovery = !!recoveryOperationId && recovery?.operationId === recoveryOperationId && isTerminalRecovery(recovery)
  const releaseRecovery = () => { if (terminalRecovery) onRecoveryOperation(null) }
  const recoveryBanner = recoveryOperationId ? <div role="status" className="mx-auto my-3 max-w-6xl rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm md:mx-8">
    <p>前の生成操作を確認しています。状態が確定するまで新しい案件は開始できません。</p>
    <button type="button" className="mt-2 mr-4 font-semibold underline" onClick={checkRecovery}>生成状態を確認</button>
    {recovery?.state === 'reserved' && recovery.dispatchAllowed && <button type="button" className="mt-2 mr-4 font-semibold underline"
      onClick={() => router.push(withGenerationOperation(sectionHref('new'), recoveryOperationId))}>同じ生成操作を続ける</button>}
    {recovery?.state === 'missing' && <button type="button" className="mt-2 mr-4 font-semibold underline" onClick={cancelRecovery}>遅れて届く生成を取り消す</button>}
    {terminalRecovery && <button type="button" className="mt-2 font-semibold underline" onClick={() => { releaseRecovery(); router.push(sectionHref('new')) }}>別の案件を新規作成</button>}
  </div> : null
  const overviewHref = withSaveHandle(withGenerationOperation(projectSectionHref('overview', mode), recoveryOperationId), saveOperationId)
  useEffect(() => {
    if (section === 'new') router.replace(overviewHref)
  }, [section, overviewHref, router])
  if (section === 'new') return <p role="status" className="p-6">保存内容を読み込んでいます。</p>
  if (phase === 'ready_full' && workspace) return <FullSavedProjectMode key={`${mode.id}:${workspace.revision}`} shell={shell} mode={mode} section={section} workspace={workspace} recoveryOperationId={recoveryOperationId} onNewConfirmed={terminalRecovery ? releaseRecovery : undefined} recoveryBanner={recoveryBanner} />
  return <ProjectModeFrame shell={shell} mode={mode} section={section} projectName={detail?.project.projectName} recoveryOperationId={recoveryOperationId} saveOperationId={saveOperationId} onNewConfirmed={terminalRecovery ? releaseRecovery : undefined}>
    {recoveryBanner}
    <SavedProjectPartialView phase={phase === 'ready_full' ? 'loading' : phase} detail={detail} section={section} onReload={reload}
      loginCallbackUrl={withSaveHandle(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId), saveOperationId)}
      newProjectHref={saveOperationId ? withSaveHandle(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId), saveOperationId) : withGenerationOperation(sectionHref('new'), recoveryOperationId)} />
  </ProjectModeFrame>
}

function FullSavedProjectMode({ shell, mode, section, workspace, recoveryOperationId, onWorkspace, onNewConfirmed, recoveryBanner }: {
  shell: boolean; mode: Extract<ProjectMode, { kind: 'saved' }>; section: Section
  workspace: FullTenjikaiWorkspace; recoveryOperationId: string | null; onWorkspace?: (workspace: FullTenjikaiWorkspace) => void
  onNewConfirmed?: () => void; recoveryBanner?: ReactNode
}) {
  const router = useRouter()
  const query = useSearchParams()
  const scope = useEntryActorScope()
  const scopeCurrent = scope.current
  const scopeStatus = scope.status
  const scopeVersion = scope.version
  const [currentWorkspace, setCurrentWorkspace] = useState(workspace)
  const [saveState, setSaveState] = useState<SaveResponse['state'] | null>(null)
  const [saveReadError, setSaveReadError] = useState<string | null>(null)
  const [activeSave, setActiveSave] = useState<string | null>(null)
  const saveSeq = useRef(0)
  const saveController = useRef<AbortController | null>(null)
  const localSave = useRef<string | null>(null)
  const urlSave = query.get('saveOperation')
  const pendingSave = validSaveHandle(urlSave) ? urlSave : activeSave
  const actor = scope.actor
  const workspaceActor = currentWorkspace.actorId
  const currentActor = useCallback(() => scopeStatus === 'authenticated' && actor === workspaceActor && scopeCurrent(), [scopeStatus, actor, workspaceActor, scopeCurrent])
  useEffect(() => () => { saveSeq.current++; saveController.current?.abort() }, [])
  useEffect(() => {
    if (!validSaveHandle(urlSave) || !currentActor() || saveController.current && localSave.current === urlSave) return
    const seq = ++saveSeq.current
    const controller = new AbortController()
    void readSaveStatus(currentWorkspace.actorId, currentWorkspace.projectId, urlSave, controller.signal).then(result => {
      if (controller.signal.aborted || seq !== saveSeq.current || !currentActor()) return
      setSaveState(result.state)
      if (result.state === 'committed' && result.workspace) {
        setCurrentWorkspace(result.workspace)
        onWorkspace?.(result.workspace)
        setInput(result.workspace.input)
        setVariant(result.workspace.selectedVariant)
        setSelectedNovelty(result.workspace.novelties.filter(item => item.selected).map(item => item.id))
        setDone(result.workspace.deadlines.filter(item => item.done).map(item => item.id))
        setLocalChanges(false)
        setActiveSave(null)
        localSave.current = null
        router.replace(withGenerationOperation(projectSectionHref(section, { kind: 'saved', id: mode.id }), recoveryOperationId))
      }
    })
    return () => controller.abort()
  }, [urlSave, scopeVersion, scopeStatus, actor, currentWorkspace.actorId, currentWorkspace.projectId, mode.id, section, recoveryOperationId, router, onWorkspace, currentActor])
  const [variant, setVariant] = useState(workspace.selectedVariant)
  const [selectedNovelty, setSelectedNovelty] = useState(workspace.novelties.filter(item => item.selected).map(item => item.id))
  const [input, setInput] = useState(workspace.input)
  const [done, setDone] = useState(workspace.deadlines.filter(item => item.done).map(item => item.id))
  const [docs, setDocs] = useState<TenjikaiDocumentDraft[]>([])
  const [panelImages, setPanelImages] = useState<Record<string, string>>({})
  const [localChanges, setLocalChanges] = useState(false)
  const plans = currentWorkspace.plans.map(item => item.plan)
  const plan = plans.find(item => item.variant === variant) ?? plans[0]
  const creatives = currentWorkspace.creatives
  const novelties = currentWorkspace.novelties
  const deadlines = currentWorkspace.deadlines
  const analysis = currentWorkspace.analysis
  const budget = previewWorkspaceBudget(currentWorkspace, variant, selectedNovelty)
  const go = (next: Section) => router.push(withSaveHandle(withGenerationOperation(projectSectionHref(next, mode), recoveryOperationId), pendingSave))
  const changeVariant = (next: 'A' | 'B' | 'C') => { if (pendingSave) return; setVariant(next); setLocalChanges(true) }
  const changeNovelty = (next: string[]) => { if (pendingSave) return; setSelectedNovelty(next); setLocalChanges(true) }
  const changeInput = (next: ProjectInput) => { if (pendingSave) return; setInput(next); setLocalChanges(true) }
  const changeDone: typeof setDone = next => { if (pendingSave) return; setDone(next); setLocalChanges(true) }
  const adoptSaved = (result: SaveResponse) => {
    if (result.state !== 'committed' || !result.workspace || !currentActor()) return false
    setCurrentWorkspace(result.workspace)
    onWorkspace?.(result.workspace)
    setInput(result.workspace.input)
    setVariant(result.workspace.selectedVariant)
    setSelectedNovelty(result.workspace.novelties.filter(item => item.selected).map(item => item.id))
    setDone(result.workspace.deadlines.filter(item => item.done).map(item => item.id))
    setLocalChanges(false)
    setSaveState(null)
    setActiveSave(null)
    localSave.current = null
    router.replace(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId))
    return true
  }
  const checkSave = () => {
    const operationId = pendingSave
    if (!operationId || !currentActor()) return
    const seq = ++saveSeq.current
    const controller = new AbortController()
    void readSaveStatus(currentWorkspace.actorId, currentWorkspace.projectId, operationId, controller.signal).then(result => {
      if (seq !== saveSeq.current || !currentActor()) return
      if (!adoptSaved(result)) setSaveState(result.state)
    })
  }
  const saveChanges = () => {
    if (!localChanges || pendingSave || saveController.current || !currentActor()) return
    const operationId = newSaveHandle()
    const patch: WorkspacePatch = {}
    if (variant !== currentWorkspace.selectedVariant) patch.variant = variant
    const oldSelected = currentWorkspace.novelties.filter(item => item.selected).map(item => item.id)
    if ([...selectedNovelty].sort().join(',') !== oldSelected.sort().join(',')) patch.selectedNoveltyIds = selectedNovelty
    if (input.budgetYen !== currentWorkspace.input.budgetYen) patch.budgetYen = input.budgetYen
    const oldDone = currentWorkspace.deadlines.filter(item => item.done).map(item => item.id)
    if ([...done].sort().join(',') !== oldDone.sort().join(',')) patch.doneDeadlineIds = done
    if (!Object.keys(patch).length) { setLocalChanges(false); return }
    const seq = ++saveSeq.current
    const controller = new AbortController()
    saveController.current = controller
    localSave.current = operationId
    setActiveSave(operationId)
    setSaveState(null)
    router.replace(withSaveHandle(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId), operationId))
    void saveWorkspace(currentWorkspace.actorId, currentWorkspace.projectId, currentWorkspace.revision, operationId, patch, controller.signal).then(result => {
      if (seq !== saveSeq.current || !currentActor()) return
      if (!adoptSaved(result)) {
        setSaveState(result.state)
        if (result.state === 'outcome_unknown' || result.state === 'rejected') checkSave()
      }
    }).finally(() => { if (saveController.current === controller) saveController.current = null })
  }
  const cancelMissing = () => {
    const operationId = pendingSave
    if (!operationId || saveState !== 'missing' || !currentActor()) return
    const seq = ++saveSeq.current
    const controller = new AbortController()
    void cancelMissingSave(currentWorkspace.actorId, currentWorkspace.projectId, operationId, controller.signal).then(result => {
      if (seq !== saveSeq.current || !currentActor()) return
      if (!adoptSaved(result)) setSaveState(result.state)
    })
  }
  const adoptLatestAfterCancel = () => {
    if (saveState !== 'canceled' || !pendingSave || !currentActor()) return
    const seq = ++saveSeq.current
    const controller = new AbortController()
    setSaveReadError(null)
    void readSavedTenjikaiWorkspace(currentWorkspace.actorId, currentWorkspace.projectId, controller.signal).then(result => {
      if (seq !== saveSeq.current || !currentActor()) return
      if (result.state !== 'ready_full') {
        setSaveReadError('最新の保存内容を確認できませんでした。保存操作を解除せず、後で再確認してください。')
        return
      }
      setCurrentWorkspace(result.workspace)
      onWorkspace?.(result.workspace)
      setInput(result.workspace.input)
      setVariant(result.workspace.selectedVariant)
      setSelectedNovelty(result.workspace.novelties.filter(item => item.selected).map(item => item.id))
      setDone(result.workspace.deadlines.filter(item => item.done).map(item => item.id))
      setLocalChanges(false)
      setSaveState(null)
      setActiveSave(null)
      localSave.current = null
      router.replace(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId))
    })
  }
  const adoptLatestAfterConflict = () => {
    if (saveState !== 'superseded' || !pendingSave || !currentActor()) return
    const seq = ++saveSeq.current
    const controller = new AbortController()
    void readSavedTenjikaiWorkspace(currentWorkspace.actorId, currentWorkspace.projectId, controller.signal).then(result => {
      if (seq !== saveSeq.current || !currentActor() || result.state !== 'ready_full') return
      setCurrentWorkspace(result.workspace)
      onWorkspace?.(result.workspace)
      setInput(result.workspace.input)
      setVariant(result.workspace.selectedVariant)
      setSelectedNovelty(result.workspace.novelties.filter(item => item.selected).map(item => item.id))
      setDone(result.workspace.deadlines.filter(item => item.done).map(item => item.id))
      setLocalChanges(false)
      setSaveState(null)
      setActiveSave(null)
      localSave.current = null
      router.replace(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId))
    })
  }
  const content = section === 'overview' ? <Overview input={input} analysis={analysis} plan={plan} budget={budget} deadlines={deadlines} creatives={creatives} go={go} savedWorkspace={currentWorkspace} />
    : section === 'booth' ? <BoothStudio plans={plans} variant={variant} setVariant={changeVariant} input={input} analysis={analysis} panelImages={panelImages} setPanelImages={setPanelImages} savedPlans={currentWorkspace.plans} />
    : section === 'creatives' ? <CreativeStudio creatives={creatives} analysis={analysis} />
    : section === 'novelty' ? <NoveltyPicker input={input} novelties={novelties} selected={selectedNovelty} setSelected={changeNovelty} savedNovelties={novelties} projectedVisitors={currentWorkspace.projectedVisitors} />
    : section === 'budget' ? <BudgetPlanner input={input} setInput={changeInput} budget={budget} />
    : section === 'vendors' ? <VendorBoard input={input} plan={plan} creatives={creatives} analysis={analysis} budget={budget} savedWorkspace={currentWorkspace} />
    : <DocsVault deadlines={deadlines} input={input} docs={docs} setDocs={setDocs} done={done} setDone={changeDone} />
  return <ProjectModeFrame shell={shell} mode={mode} section={section} projectName={input.eventName} recoveryOperationId={recoveryOperationId} saveOperationId={pendingSave} onNewConfirmed={onNewConfirmed}>
    {!pendingSave && recoveryBanner}
    <p role="status" className="mx-auto mt-4 max-w-6xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 md:mx-8">
      設計内容は保存済みです。画像・資料ファイル・業者選択はこの端末の画面内だけです。
      {localChanges && ' 変更中の選択と予算・締切はまだ保存されていません。'}
    </p>
    <div className="mx-auto mt-2 flex max-w-6xl flex-wrap items-center gap-3 px-4 text-xs md:px-8">
      <button type="button" onClick={saveChanges} disabled={!localChanges || !!pendingSave || !!saveController.current}
        className="rounded-lg bg-doya-500 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">変更を保存</button>
      {pendingSave && <p role="status">保存操作 {saveState === 'committed' ? '確認済み' : saveState === 'missing' ? '未到着の可能性' : saveState === 'superseded' ? '別の変更と競合' : saveState === 'canceled' ? '取消済み' : '確認中'}。新しい保存操作は確認まで開始できません。</p>}
      {pendingSave && <p>保存状態が確定するまで、この画面の編集操作は一時停止しています。</p>}
      {pendingSave && <button type="button" className="font-bold underline" onClick={checkSave}>保存状態を確認</button>}
      {saveState === 'missing' && <button type="button" className="font-bold underline" onClick={cancelMissing}>遅れて届く保存を取り消す</button>}
      {saveState === 'canceled' && <button type="button" className="font-bold underline" onClick={adoptLatestAfterCancel}>未保存変更を破棄して最新の保存内容を確認し、編集を続ける</button>}
      {saveReadError && <p role="alert">{saveReadError}</p>}
      {saveState === 'superseded' && <p>変更中の値は画面内に残しています。現在の保存内容と照合してください。</p>}
      {saveState === 'superseded' && <button type="button" className="font-bold underline" onClick={adoptLatestAfterConflict}>
        未保存変更を破棄して最新の保存内容を読み込む
      </button>}
    </div>
    <fieldset disabled={!!pendingSave} className="min-w-0 border-0 p-0">{content}</fieldset>
  </ProjectModeFrame>
}

function InvalidProjectMode({ shell, mode }: { shell: boolean; mode: Extract<ProjectMode, { kind: 'invalid' }> }) {
  const pathname = usePathname()
  const section = sectionFromPath(pathname)
  return <ProjectModeFrame shell={shell} mode={mode} section={section === 'new' ? 'overview' : section}>
    <SavedProjectPartialView phase="invalid_project" detail={null} section={section} onReload={() => {}} loginCallbackUrl={pathname ?? '/tenjikai'} />
  </ProjectModeFrame>
}

function ProjectModeFrame({ shell, mode, section, projectName, recoveryOperationId, saveOperationId, onNewConfirmed, children }: {
  shell: boolean; mode: ProjectMode; section: Section; projectName?: string; recoveryOperationId?: string | null; saveOperationId?: string | null; onNewConfirmed?: () => void; children: ReactNode
}) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const callback = withSaveHandle(withGenerationOperation(projectSectionHref(section, mode), recoveryOperationId ?? null), saveOperationId ?? null)
  const go = (next: Section) => {
    if (next === 'new' && (saveOperationId || recoveryOperationId && !onNewConfirmed)) { setMobileOpen(false); return }
    if (next === 'new') onNewConfirmed?.()
    router.push(withSaveHandle(withGenerationOperation(projectSectionHref(next, mode), next === 'new' && onNewConfirmed ? null : recoveryOperationId ?? null), saveOperationId ?? null)); setMobileOpen(false)
  }
  if (shell) return <div className="tenjikai-root text-ink">{children}</div>
  return <div className="tenjikai-root flex h-screen overflow-hidden bg-[var(--bg)] text-ink">
    <div className="hidden md:flex"><TenjikaiSidebar section={section} ready go={go} isCollapsed={collapsed} onToggle={setCollapsed} projectName={projectName} savedMode loginCallbackUrl={callback} /></div>
    <AnimatePresence>{mobileOpen && <>
      <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />
      <motion.div initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 md:hidden">
        <TenjikaiSidebar section={section} ready go={go} forceExpanded isMobile onToggle={() => setMobileOpen(false)} projectName={projectName} savedMode loginCallbackUrl={callback} />
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
  const [fullWorkspace, setFullWorkspace] = useState<FullTenjikaiWorkspace | null>(null)
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
  const terminalRecovery = isTerminalRecovery(recoveredStatus)
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
      setError(status.state === 'reserved' && status.dispatchAllowed
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

  const analysis = fullWorkspace?.analysis ?? generated.analysis
  const plans = useMemo(() => fullWorkspace ? fullWorkspace.plans.map(item => item.plan) : applyBoothCopy(generateBoothPlans(input), generated.boothCopy), [fullWorkspace, input, generated.boothCopy])
  const plan = plans.find((p) => p.variant === variant) ?? plans[0]
  const creatives = useMemo(() => fullWorkspace?.creatives ?? applyCreativeCopy(generateCreatives(analysis, input), generated.creativeCopy), [fullWorkspace, analysis, input, generated.creativeCopy])
  const novelties = useMemo(() => fullWorkspace?.novelties ?? generateNovelties(input), [fullWorkspace, input])
  const deadlines = useMemo(() => fullWorkspace?.deadlines ?? generateDeadlines(input), [fullWorkspace, input])
  const budget = useMemo(
    () => fullWorkspace?.budgetLines ?? computeBudget(input, plan, creatives, novelties, selectedNovelty),
    [fullWorkspace, input, plan, creatives, novelties, selectedNovelty],
  )

  const start = (next: ProjectInput, explicitSameOperation = false) => {
    if (!currentActor() || requestController.current || failureKind === 'unknown' && !explicitSameOperation || failureKind === 'known' && !!projectId) return
    if (activeRecoveryHandle && !(explicitSameOperation && recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed)) return
    if (explicitSameOperation && !(recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed)) return
    setError(null)
    setFailureKind(null)
    setFullWorkspace(null)
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
        setFullWorkspace(result.workspace ?? null)
        if (result.workspace) {
          setVariant(result.workspace.selectedVariant)
          setSelectedNovelty(result.workspace.novelties.filter(item => item.selected).map(item => item.id))
        }
        setProjectId(result.projectId)
        setSave(result.save)
        setOperationStatus({ actorId, operationId, state: result.save.analysis === 'saved' ? 'completed' : 'degraded', projectId: result.projectId, analysis: result.save.analysis, dispatchAllowed: false, terminalConfirmed: true })
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
        if (result.state === 'generation_failed') setOperationStatus({ actorId, operationId, state: 'failed', projectId: result.projectId, analysis: 'not_saved', dispatchAllowed: false, terminalConfirmed: true })
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
    if (s === 'new') { requestSeq.current++; requestController.current?.abort(); requestController.current = null; operationRef.current = null; locallyStartedOperation.current = null; onRecoveryOperation(null); setOperationStatus(null); setPhase('input'); setProjectId(null); setError(null); setFailureKind(null); setFullWorkspace(null); onNew() }
    router.push(s === 'new' || !activeProjectId ? sectionHref(s) : projectSectionHref(s, { kind: 'saved', id: activeProjectId }))
    setMobileOpen(false)
  }

  if (phase === 'ready' && fullWorkspace && activeProjectId === fullWorkspace.projectId && section !== 'new') {
    return <FullSavedProjectMode shell={shell} mode={{ kind: 'saved', id: fullWorkspace.projectId }} section={section}
      workspace={fullWorkspace} recoveryOperationId={null} onWorkspace={setFullWorkspace}
      onNewConfirmed={() => { onRecoveryOperation(null); onNew() }} />
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
    if (phase === 'input' || section === 'new') return <Wizard initial={input} onSubmit={next => start(next, recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed)} submitLabel={recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed ? '同じ操作で生成を続ける' : undefined} submitDisabled={!!activeRecoveryHandle && !(recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed) || failureKind === 'unknown' && !(recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed) || failureKind === 'known' && !!projectId} />
    switch (section) {
      case 'overview':
        return <Overview input={input} analysis={analysis} plan={plan} budget={budget} deadlines={deadlines} creatives={creatives} go={go} savedWorkspace={fullWorkspace ?? undefined} />
      case 'booth':
        return <BoothStudio plans={plans} variant={variant} setVariant={setVariant} input={input} analysis={analysis} panelImages={panelImages} setPanelImages={setPanelImages} savedPlans={fullWorkspace?.plans} />
      case 'creatives':
        return <CreativeStudio creatives={creatives} analysis={analysis} />
      case 'novelty':
        return <NoveltyPicker input={input} novelties={novelties} selected={selectedNovelty} setSelected={setSelectedNovelty} savedNovelties={fullWorkspace?.novelties} projectedVisitors={fullWorkspace?.projectedVisitors} />
      case 'budget':
        return <BudgetPlanner input={input} setInput={setInput} budget={budget} />
      case 'vendors':
        return <VendorBoard input={input} plan={plan} creatives={creatives} analysis={analysis} budget={budget} savedWorkspace={fullWorkspace ?? undefined} />
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
          {recoveredStatus?.state === 'reserved' && recoveredStatus.dispatchAllowed && <p className="mt-2">AIはまだ開始されていません。元と同じ入力を確認してから、同じ操作として生成を続けられます。</p>}
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
            {fullWorkspace ? '案件の設計内容を保存しました。画像・資料ファイル・業者選択はこの画面内だけです。' : '案件の基本情報を保存しました。会場の指定やブース案などは、この画面内にのみ保持されています。'}
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
