'use client'

import { useEffect, useState, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { withOrg, fetchAllSfaAccounts } from '@/lib/sfa/client'
import { sfaJson, SfaClientRejection, isSfaClientTask, isSfaClientActivity, type SfaClientTask, isSfaClientDeal, type SfaClientDeal, type SfaClientNextAction } from '@/lib/sfa/client-response'
import { useSfaClientMutations, useSfaDraftSnapshot } from '@/lib/sfa/use-client-mutations'
import MutationRecovery from '@/components/sfa/MutationRecovery'
import { isJstOverdue, jstDateKey } from '@/lib/sfa/task-date'
import { ACTIVITY_TYPE_LABEL } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'
import { isSfaSummary, summaryYen, type SfaSummary } from '@/lib/sfa/summary'

interface Stage { id: string; name: string; order: number; probability: number; color: string; isWon: boolean; isLost: boolean }
interface Deal extends SfaClientDeal {
  accountName: string | null
  openTaskCount: number
}
interface Account { id: string; name: string }
type Task = SfaClientTask
interface SfaActivityRow { id: string; type: string; subject: string | null; body: string | null; occurredAt: string }
interface AiTaskCandidate { id: string; title: string; dueDate: string | null; checked: boolean }
interface DealPage {
  stages: Stage[]
  deals: Deal[]
  nextCursor: string | null
  totalCount: number
  stageSummary: { stageId: string | null; count: number; total: string }[]
}

function isDealPage(value: unknown): value is DealPage {
  if (!value || typeof value !== 'object') return false
  const page = value as Partial<DealPage>
  return Array.isArray(page.stages) && page.stages.every(stage => stage && typeof stage.id === 'string' && typeof stage.name === 'string' && Number.isInteger(stage.order) && Number.isInteger(stage.probability) && stage.probability >= 0 && stage.probability <= 100 && typeof stage.color === 'string' && typeof stage.isWon === 'boolean' && typeof stage.isLost === 'boolean' && !(stage.isWon && stage.isLost)) && Array.isArray(page.deals)
    && page.deals.every((deal) => isSfaClientDeal(deal) && (deal.accountName === null || typeof deal.accountName === 'string') && Number.isSafeInteger(deal.openTaskCount) && deal.openTaskCount >= 0)
    && (page.nextCursor === null || typeof page.nextCursor === 'string')
    && Number.isSafeInteger(page.totalCount) && (page.totalCount as number) >= 0
    && Array.isArray(page.stageSummary)
    && page.stageSummary.every((row) => row && (row.stageId === null || typeof row.stageId === 'string') && Number.isSafeInteger(row.count) && row.count >= 0 && typeof row.total === 'string' && /^-?\d+$/.test(row.total))
}

const STALE_DAYS = 14
const yen = (n: number) => '¥' + (n || 0).toLocaleString('ja-JP')
// 日本時間の暦日を <input type="date"> に表示する。
const toDateInput = (d: Date) => jstDateKey(d) || ''
const isoToDateInput = (iso: string | null) => jstDateKey(iso) || ''
const fmtShortDate = (iso: string | null) => {
  const day = jstDateKey(iso)
  return day ? `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}` : null
}
const isTaskOverdue = (t: Task) => t.status !== 'done' && isJstOverdue(t.dueDate)
// 商談日からの経過期間ラベル
const elapsedLabel = (d: Deal): string | null => {
  if (!d.startDate) return null
  const start = new Date(d.startDate)
  if (isNaN(start.getTime())) return null
  if (!['open', 'won', 'lost'].includes(d.status)) return null
  const closedAt = d.status === 'won' ? d.wonAt : d.status === 'lost' ? d.lostAt : null
  if (d.status !== 'open' && !closedAt) return null
  const end = closedAt ? new Date(closedAt) : new Date()
  if (isNaN(end.getTime())) return null
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
  return d.status === 'open' ? `${days}日経過` : `${days}日で決着`
}

export default function SfaDealsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const mutations = useSfaClientMutations(orgSlug, (pending, state, row) => {
    if (pending.kind === 'next-action' && state === 'found') showAi(row as SfaClientNextAction)
    if (state === 'found' && pending.lane.startsWith('ai-task:')) setAiModal(m => m && ({ ...m, candidates: m.candidates.filter(c => 'ai-task:' + c.id !== pending.lane) }))
    loadTasks(); load()
    if (detailRef.current) { void loadDetailTasks(detailRef.current); void loadActivities(detailRef.current) }
  })
  const ready = mutations.allowed
  const detailRef = useRef<string | null>(null)
  const detailEpoch = useRef(0)
  const aiEpoch = useRef(0)
  const bulkRunning = useRef(false)
  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [stageSummary, setStageSummary] = useState<DealPage['stageSummary']>([])
  const [summary, setSummary] = useState<SfaSummary | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [detailTasks, setDetailTasks] = useState<Task[]>([])
  const [detailTasksPage, setDetailTasksPage] = useState(0)
  const [detailTasksHasMore, setDetailTasksHasMore] = useState(false)
  const [detailTasksLoading, setDetailTasksLoading] = useState(false)
  const [detailTasksError, setDetailTasksError] = useState(false)
  const [detailTasksRetryPage, setDetailTasksRetryPage] = useState(1)
  const [dealsLoading, setDealsLoading] = useState(true)
  const [dealsError, setDealsError] = useState(false)
  const [tasksError, setTasksError] = useState(false)
  const [accountsError, setAccountsError] = useState(false)
  const [accountsLoading, setAccountsLoading] = useState(true)
  const [activitiesError, setActivitiesError] = useState(false)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [activitiesCursor, setActivitiesCursor] = useState<string | null>(null)
  const [activitiesTotal, setActivitiesTotal] = useState(0)
  const [activitiesRetryCursor, setActivitiesRetryCursor] = useState<string | null>(null)
  const dealsRequest = useRef<AbortController | null>(null)
  const moreDealsRequest = useRef<AbortController | null>(null)
  const tasksRequest = useRef<AbortController | null>(null)
  const detailTasksRequest = useRef<AbortController | null>(null)
  const accountsRequest = useRef<AbortController | null>(null)
  const activitiesRequest = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState(() => toDateInput(new Date()))
  const [busy, setBusy] = useState(false)
  const createDraft = useSfaDraftSnapshot([name, amount, accountId, startDate, open])
  const previousIdentity = useRef(mutations.identity)

  const load = useCallback(() => {
    if (!ready || !mutations.active()) return
    dealsRequest.current?.abort()
    moreDealsRequest.current?.abort()
    const controller = new AbortController()
    dealsRequest.current = controller
    setDealsLoading(true)
    setLoadingMore(false)
    setDealsError(false)
    setSummaryError(false)
    setSummary(null)
    sfaJson('/api/sfa/deals', orgSlug, { signal: controller.signal })
      .then((d) => {
        if (!isDealPage(d)) throw new Error('商談の応答形式が不正です')
        return d
      })
      .then((d) => {
        if (!controller.signal.aborted && mutations.active()) {
          setStages(d.stages); setDeals(d.deals); setNextCursor(d.nextCursor)
          setTotalCount(d.totalCount); setStageSummary(d.stageSummary)
        }
      })
      .catch(() => { if (!controller.signal.aborted && mutations.active()) setDealsError(true) })
      .finally(() => { if (!controller.signal.aborted && mutations.active()) setDealsLoading(false) })
    sfaJson('/api/sfa/summary', orgSlug, { signal: controller.signal })
      .then((data) => {
        if (!isSfaSummary(data.summary)) throw new Error('商談集計の応答形式が不正です')
        return data.summary
      })
      .then((data) => { if (!controller.signal.aborted && mutations.active()) setSummary(data) })
      .catch(() => { if (!controller.signal.aborted && mutations.active()) setSummaryError(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  const loadMore = useCallback(() => {
    if (!ready || !mutations.active() || !nextCursor || dealsLoading || loadingMore) return
    moreDealsRequest.current?.abort()
    const controller = new AbortController()
    moreDealsRequest.current = controller
    setLoadingMore(true)
    setDealsError(false)
    sfaJson(`/api/sfa/deals?cursor=${encodeURIComponent(nextCursor)}`, orgSlug, { signal: controller.signal })
      .then((data) => {
        if (!isDealPage(data)) throw new Error('商談の応答形式が不正です')
        return data
      })
      .then((data) => {
        if (controller.signal.aborted || !mutations.active()) return
        setDeals((current) => {
          const seen = new Set(current.map((deal) => deal.id))
          return [...current, ...data.deals.filter((deal) => !seen.has(deal.id))]
        })
        setNextCursor(data.nextCursor)
        setTotalCount(data.totalCount)
        setStageSummary(data.stageSummary)
      })
      .catch(() => { if (!controller.signal.aborted && mutations.active()) setDealsError(true) })
      .finally(() => { if (!controller.signal.aborted && mutations.active()) setLoadingMore(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, nextCursor, dealsLoading, loadingMore, orgSlug, mutations.key])
  const loadTasks = useCallback(() => {
    if (!ready || !mutations.active()) return
    tasksRequest.current?.abort()
    const controller = new AbortController()
    tasksRequest.current = controller
    setTasksError(false)
    sfaJson('/api/sfa/tasks', orgSlug, { signal: controller.signal })
      .then(d => {
        if (!Array.isArray(d.tasks) || !d.tasks.every(isSfaClientTask)) throw new Error('タスクの応答形式が不正です')
        return d as { tasks: Task[] }
      })
      .then((d) => { if (!controller.signal.aborted && mutations.active()) setTasks(d.tasks) })
      .catch(() => { if (!controller.signal.aborted && mutations.active()) setTasksError(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  const loadDetailTasks = useCallback(async (dealId: string, page = 1) => {
    if (!ready || !mutations.active()) return
    detailTasksRequest.current?.abort()
    const controller = new AbortController()
    detailTasksRequest.current = controller
    setDetailTasksLoading(true)
    setDetailTasksError(false)
    try {
      const path = `/api/sfa/tasks?dealId=${encodeURIComponent(dealId)}&page=${page}`
      const data = await sfaJson(path, orgSlug, { signal: controller.signal })
      if (!Array.isArray(data.tasks) || !data.tasks.every(isSfaClientTask) || data.page !== page || typeof data.hasMore !== 'boolean' ||
          !data.tasks.every((task: Task) => task.dealId === dealId)) {
        throw new Error( '商談のタスクを取得できませんでした')
      }
      if (controller.signal.aborted || !mutations.active() || detailRef.current !== dealId) return
      const rows = data.tasks
      setDetailTasks((current) => page === 1
        ? rows
        : [...current, ...rows.filter((task: Task) => !current.some((item) => item.id === task.id))])
      setDetailTasksPage(page)
      setDetailTasksHasMore(data.hasMore)
      setDetailTasksRetryPage(1)
    } catch {
      if (!controller.signal.aborted && mutations.active()) {
        setDetailTasksError(true)
        setDetailTasksRetryPage(page)
      }
    } finally {
      if (!controller.signal.aborted && mutations.active()) setDetailTasksLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  const loadAccounts = useCallback(() => {
    if (!ready || !mutations.active()) return
    accountsRequest.current?.abort()
    const controller = new AbortController()
    accountsRequest.current = controller
    setAccountsError(false)
    setAccountsLoading(true)
    fetchAllSfaAccounts(orgSlug, controller.signal)
      .then((all) => { if (!controller.signal.aborted && mutations.active()) setAccounts(all) })
      .catch(() => { if (!controller.signal.aborted && mutations.active()) setAccountsError(true) })
      .finally(() => { if (!controller.signal.aborted && mutations.active()) setAccountsLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, mutations.key])
  const loadActivities = useCallback((dealId: string, cursor?: string) => {
    activitiesRequest.current?.abort()
    const controller = new AbortController()
    activitiesRequest.current = controller
    setActivitiesLoading(true)
    setActivitiesError(false)
    const path = `/api/sfa/activities?dealId=${encodeURIComponent(dealId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    return sfaJson(path, orgSlug, { signal: controller.signal })
      .then(d => {
        if (!Array.isArray(d.activities) || !d.activities.every(isSfaClientActivity) || typeof d.totalCount !== 'number' ||
            !(d.nextCursor === null || typeof d.nextCursor === 'string')) throw new Error('活動の応答形式が不正です')
        return d as { activities: SfaActivityRow[]; totalCount: number; nextCursor: string | null }
      })
      .then((d) => {
        if (controller.signal.aborted || !mutations.active() || detailRef.current !== dealId) return
        setDetailActs((previous) => cursor
          ? [...previous, ...d.activities.filter((activity) => !previous.some((item) => item.id === activity.id))]
          : d.activities)
        setActivitiesCursor(d.nextCursor)
        setActivitiesTotal(d.totalCount)
        setActivitiesRetryCursor(null)
      })
      .catch(() => {
        if (!controller.signal.aborted && mutations.active()) {
          setActivitiesError(true)
          setActivitiesRetryCursor(cursor || null)
        }
      })
      .finally(() => { if (!controller.signal.aborted && mutations.active()) setActivitiesLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, mutations.key])
  useEffect(() => {
    if (!ready || !mutations.active()) return
    setStages([])
    setDeals([])
    setLoadingMore(false)
    setNextCursor(null)
    setTotalCount(0)
    setStageSummary([])
    setSummary(null)
    setSummaryError(false)
    setTasks([])
    setAccounts([])
    if (previousIdentity.current !== mutations.identity) {
      previousIdentity.current = mutations.identity
      setName(''); setAmount(''); setAccountId(''); setStartDate(toDateInput(new Date()))
      setForm({ name: '', amount: '', accountId: '', contactName: '', startDate: '', expectedCloseDate: '', probability: '', note: '' })
      setOpen(false); setDetail(null); ++detailEpoch.current
    }
    setDealsLoading(true)
    load()
    loadTasks()
    loadAccounts()
    return () => {
      dealsRequest.current?.abort()
      moreDealsRequest.current?.abort()
      tasksRequest.current?.abort()
      detailTasksRequest.current?.abort()
      accountsRequest.current?.abort()
      activitiesRequest.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, orgSlug, load, loadTasks, loadAccounts, mutations.key])

  const create = async () => {
    if (!name.trim() || !mutations.active() || mutations.creationBlocked('deal')) return
    const revision = createDraft.current.revision
    setBusy(true)
    const row = await mutations.create('deal', 'create-deal', { name, amount: amount || '0', accountId: accountId || null, ...(startDate ? { startDate } : {}) })
    if (!mutations.active()) return
    setBusy(false)
    if (!row) return
    if (createDraft.current.revision === revision) {
      setName(''); setAmount(''); setAccountId(''); setStartDate(toDateInput(new Date())); setOpen(false)
    }
    toast.success('商談を追加しました')
    load()
  }

  const moveStage = async (deal: Deal, stageId: string) => {
    if (!mutations.active() || deal.stageId === stageId || mutations.blocked('deal:' + deal.id)) return
    const row = await mutations.mutateDeal(deal, { stageId })
    if (!row || !mutations.active()) return
    // Keep the confirmed board until the versioned write succeeds.
    load()
  }

  // ============ ポインタベースのドラッグ&ドロップ（マウス + タッチ対応） ============
  // ネイティブ HTML5 DnD はタッチ非対応で、カード上のボタン領域からは掴めないため、
  // Pointer Events で自前実装する（マウスはカード全体／タッチはハンドルから掴める）。
  const dragRef = useRef<{ deal: Deal; startX: number; startY: number; dragging: boolean } | null>(null)
  const movedRef = useRef(false) // 直近の操作がドラッグだったか（カード本体クリックの抑制用）
  const moveStageRef = useRef(moveStage)
  moveStageRef.current = moveStage
  const [dragDealId, setDragDealId] = useState<string | null>(null)
  const [ghost, setGhost] = useState<{ x: number; y: number; deal: Deal } | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)
  const DRAG_THRESHOLD = 8 // px。これ未満の移動はクリック扱い

  const stageIdAtPoint = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return (el?.closest('[data-stage-col]') as HTMLElement | null)?.getAttribute('data-stage-col') ?? null
  }

  const onCardPointerDown = (e: ReactPointerEvent, deal: Deal) => {
    movedRef.current = false // 新しい操作の開始時に必ずリセット（前回のドラッグを次回タップに持ち越さない）
    if (e.pointerType === 'mouse' && e.button !== 0) return // 左ボタンのみ
    const target = e.target as HTMLElement
    if (target.closest('[data-no-drag]')) return // 内部コントロール（select/チェック/AI）は除外
    // タッチはハンドルからのみ開始（カード本体のタップ＝詳細・縦スクロールを温存）
    if (e.pointerType !== 'mouse' && !target.closest('[data-drag-handle]')) return
    dragRef.current = { deal, startX: e.clientX, startY: e.clientY, dragging: false }
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (!s.dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        s.dragging = true
        movedRef.current = true
        setDragDealId(s.deal.id)
        document.body.style.userSelect = 'none'
      }
      e.preventDefault()
      setGhost({ x: e.clientX, y: e.clientY, deal: s.deal })
      setDragOverStageId(stageIdAtPoint(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => {
      const s = dragRef.current
      if (!s) return
      dragRef.current = null
      if (s.dragging) {
        const stageId = stageIdAtPoint(e.clientX, e.clientY)
        if (stageId && s.deal.stageId !== stageId) moveStageRef.current(s.deal, stageId)
      }
      setDragDealId(null)
      setGhost(null)
      setDragOverStageId(null)
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  // ============ タスク（カード表示 + 完了トグル） ============
  const tasksOf = (dealId: string) => tasks.filter((t) => t.dealId === dealId && t.status !== 'done')

  const toggleTask = async (t: Task) => {
    const result = await mutations.mutateTask(t, { status: t.status === 'done' ? 'open' : 'done' })
    if (!result || !mutations.active()) return
    tasksRequest.current?.abort(); detailTasksRequest.current?.abort()
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...(result.task as Task) } : x))
    setDetailTasks(prev => prev.map(x => x.id === t.id ? { ...x, ...(result.task as Task) } : x))
    loadTasks(); load()
    if (detailRef.current === t.dealId && t.dealId) void loadDetailTasks(t.dealId)
  }

  // ============ AI次アクション（提案 + タスク候補の選択追加） ============
  const aiDealId = mutations.busy.find(lane => lane.startsWith('next-action:'))?.slice('next-action:'.length)
  const [aiModal, setAiModal] = useState<{
    identity: string
    deal: Pick<Deal, 'id' | 'name'>
    nextAction: string
    reason: string
    risk: string
    candidates: AiTaskCandidate[]
  } | null>(null)
  const [aiAdding, setAiAdding] = useState(false)

  const showAi = (suggestion: SfaClientNextAction) => setAiModal({ identity: mutations.identity,
    deal: { id: suggestion.dealId, name: suggestion.dealName }, nextAction: suggestion.nextAction, reason: suggestion.reason, risk: suggestion.risk,
    candidates: suggestion.tasks.map((t, i) => ({ ...t, id: suggestion.id + ':' + i, checked: true })) })
  const aiNextAction = async (deal: Deal) => {
    if (!mutations.active()) return
    const epoch = aiEpoch.current
    const suggestion = await mutations.nextAction(deal)
    if (suggestion && mutations.active() && aiEpoch.current === epoch) showAi(suggestion)
  }
  const closeAi = () => { ++aiEpoch.current; setAiModal(null); setAiAdding(false) }
  const addCheckedTasks = async () => {
    if (!aiModal || !mutations.active() || bulkRunning.current) return
    const checked = aiModal.candidates.filter(c => c.checked && c.title.trim())
    if (!checked.length) { toast.error('追加するタスクにチェックを入れてください'); return }
    const epoch = aiEpoch.current
    bulkRunning.current = true
    setAiAdding(true)
    let accepted = 0
    try {
      for (const candidate of checked) {
        if (!mutations.active() || aiEpoch.current !== epoch) break
        const row = await mutations.create('task', 'ai-task:' + candidate.id, { title: candidate.title, dueDate: candidate.dueDate || null, dealId: aiModal.deal.id })
        if (!mutations.active() || aiEpoch.current !== epoch) break
        if (!row) break
        accepted++
        setAiModal(m => m && ({ ...m, candidates: m.candidates.filter(c => c.id !== candidate.id) }))
      }
      if (!mutations.active() || aiEpoch.current !== epoch) return
      if (accepted) { toast.success(`タスクを${accepted}件追加しました`); loadTasks(); load(); if (detailRef.current === aiModal.deal.id) void loadDetailTasks(aiModal.deal.id) }
    } finally {
      bulkRunning.current = false
      if (mutations.active() && aiEpoch.current === epoch) setAiAdding(false)
    }
  }

  // ============ 商談詳細モーダル ============
  const [detail, setDetail] = useState<Deal | null>(null)
  const [form, setForm] = useState({
    name: '', amount: '', accountId: '', contactName: '', startDate: '', expectedCloseDate: '', probability: '', note: '',
  })
  const [saving, setSaving] = useState(false)
  const [detailActs, setDetailActs] = useState<SfaActivityRow[]>([])
  const [actType, setActType] = useState<ActivityType>('note')
  const [actSubject, setActSubject] = useState('')
  const [actBusy, setActBusy] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDue, setNewTaskDue] = useState('')
  const [taskBusy, setTaskBusy] = useState(false)
  detailRef.current = detail?.id || null
  useEffect(() => { setAiModal(m => m?.identity === mutations.identity ? m : null) }, [mutations.identity])
  const editDraft = useSfaDraftSnapshot([form, detail?.id])
  const taskDraft = useSfaDraftSnapshot([newTaskTitle, newTaskDue, detail?.id])
  const activityDraft = useSfaDraftSnapshot([actType, actSubject, detail?.id])
  const closeDetail = () => { ++detailEpoch.current; detailRef.current = null; detailTasksRequest.current?.abort(); activitiesRequest.current?.abort(); setDetail(null); setTaskBusy(false); setActBusy(false); setSaving(false) }
  useEffect(() => { setBusy(false); setSaving(false); setTaskBusy(false); setActBusy(false); setAiAdding(false); ++detailEpoch.current; ++aiEpoch.current; }, [mutations.key])

  const openDetail = (d: Deal) => {
    ++detailEpoch.current; detailRef.current = d.id; setTaskBusy(false); setActBusy(false); setSaving(false)
    setDetail(d)
    setForm({
      name: d.name,
      amount: String(d.amount || 0),
      accountId: d.accountId || '',
      contactName: d.contactName || '',
      startDate: isoToDateInput(d.startDate),
      expectedCloseDate: isoToDateInput(d.expectedCloseDate),
      probability: String(d.probability ?? 0),
      note: d.note || '',
    })
    setDetailActs([])
    setActivitiesCursor(null)
    setActivitiesTotal(0)
    setDetailTasks([])
    setDetailTasksPage(0)
    setDetailTasksHasMore(false)
    setDetailTasksRetryPage(1)
    setActSubject('')
    setNewTaskTitle('')
    setNewTaskDue('')
    // 活動タイムライン（この商談のみ）
    loadActivities(d.id)
    loadDetailTasks(d.id)
  }

  const saveDetail = async () => {
    if (!detail || !mutations.active() || mutations.blocked('deal:' + detail.id)) return
    const epoch = detailEpoch.current, revision = editDraft.current.revision
    setSaving(true)
    const row = await mutations.mutateDeal(detail, {
      name: form.name, amount: form.amount || '0', accountId: form.accountId, contactName: form.contactName,
      startDate: form.startDate, expectedCloseDate: form.expectedCloseDate, probability: form.probability, note: form.note,
    })
    if (!mutations.active()) return
    if (detailEpoch.current === epoch) setSaving(false)
    if (!row) return
    load()
    if (detailEpoch.current !== epoch) return
    // A newer draft keeps its fields and receives only the confirmed baseline version.
    setDetail(current => current?.id === row.id ? { ...current, ...row } : current)
    if (editDraft.current.revision === revision) closeDetail()
    toast.success('保存しました')
  }

  const addDetailTask = async () => {
    if (!detail || !newTaskTitle.trim() || !mutations.active() || mutations.creationBlocked('task')) return
    const epoch = detailEpoch.current, revision = taskDraft.current.revision, dealId = detail.id
    setTaskBusy(true)
    const row = await mutations.create('task', 'deal-task:' + dealId, { title: newTaskTitle, dueDate: newTaskDue || null, dealId })
    if (!mutations.active()) return
    if (detailEpoch.current === epoch) setTaskBusy(false)
    if (!row) return
    loadTasks(); load()
    if (detailEpoch.current !== epoch || detailRef.current !== dealId) return
    if (taskDraft.current.revision === revision) { setNewTaskTitle(''); setNewTaskDue('') }
    void loadDetailTasks(dealId)
  }

  const addActivity = async () => {
    if (!detail || !actSubject.trim() || !mutations.active() || mutations.creationBlocked('activity')) return
    const epoch = detailEpoch.current, revision = activityDraft.current.revision, dealId = detail.id
    setActBusy(true)
    const row = await mutations.create('activity', 'deal-activity:' + dealId, { type: actType, subject: actSubject, dealId })
    if (!mutations.active()) return
    if (detailEpoch.current === epoch) setActBusy(false)
    if (!row) return
    load()
    if (detailEpoch.current !== epoch || detailRef.current !== dealId) return
    if (activityDraft.current.revision === revision) setActSubject('')
    void loadActivities(dealId)
  }

  const isStale = (d: Deal) =>
    d.status === 'open' && d.lastActivityAt && Date.now() - new Date(d.lastActivityAt).getTime() > STALE_DAYS * 86400000

  const knownStageIds = new Set(stages.map((stage) => stage.id))
  const unassignedSummary = stageSummary.filter((row) => !row.stageId || !knownStageIds.has(row.stageId))
  const unassignedCount = unassignedSummary.reduce((sum, row) => sum + row.count, 0)
  const unassignedTotal = unassignedSummary.reduce((sum, row) => sum + BigInt(row.total), 0n).toString()
  const boardStages: Stage[] = unassignedCount
    ? [...stages, { id: '__unassigned__', name: '未分類', order: Number.MAX_SAFE_INTEGER, probability: 0, color: '#94a3b8', isWon: false, isLost: false }]
    : stages

  return (
    <div className="p-4 lg:p-6">
      <MutationRecovery mutations={mutations} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900">商談パイプライン</h1>
          <p className="text-slate-500 font-bold text-sm">
            総額 {summary ? summaryYen(summary.openTotal) : '—'}・確度加重 <span className="text-green-600">{summary ? summaryYen(summary.weighted) : '—'}</span>
          </p>
          <p className="text-slate-400 font-bold text-xs mt-1">表示中 {deals.length}件 / 全{totalCount}件</p>
          <p className="text-slate-400 font-bold text-[11px] mt-0.5 flex items-center gap-0.5">
            <span className="material-symbols-outlined text-[14px] leading-none">drag_indicator</span>
            カードをドラッグしてステージを移動できます
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={withOrg('/api/sfa/export?type=deals', orgSlug)} className="px-4 py-3 rounded-full bg-white border border-slate-200 text-green-700 font-black shadow-sm hover:shadow flex items-center gap-1">
            <span className="material-symbols-outlined">download</span>CSV出力
          </a>
          <button onClick={() => setOpen((v) => !v)} className="px-5 py-3 rounded-full bg-gradient-to-r from-green-500 to-lime-600 text-white font-black shadow-lg hover:shadow-xl transition-all flex items-center gap-1">
            <span className="material-symbols-outlined">add</span>商談を追加
          </button>
        </div>
      </div>

      {(dealsError || tasksError || accountsError || summaryError) && (
        <div role="alert" className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800 space-y-2">
          {dealsError && <p>商談を読み込めませんでした。表示中の商談がある場合は更新前の情報です。</p>}
          {tasksError && <p>タスクを読み込めませんでした。表示中のタスクがある場合は更新前の情報です。</p>}
          {accountsError && <p>取引先を読み込めませんでした。選択肢がある場合は更新前の情報です。</p>}
          <div className="flex flex-wrap gap-2">
            {dealsError && <button type="button" onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-red-800 border border-red-200">商談を再試行</button>}
            {tasksError && <button type="button" onClick={loadTasks} className="rounded-lg bg-white px-3 py-1.5 text-red-800 border border-red-200">タスクを再試行</button>}
            {accountsError && <button type="button" onClick={loadAccounts} className="rounded-lg bg-white px-3 py-1.5 text-red-800 border border-red-200">取引先を再試行</button>}
            {summaryError && <button type="button" onClick={load} className="rounded-lg bg-white px-3 py-1.5 text-red-800 border border-red-200">金額集計を再試行</button>}
          </div>
        </div>
      )}

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-500 mb-1">商談名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 新規SaaS導入" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">金額(円)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1000000" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">取引先</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={accountsLoading || accountsError} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold disabled:opacity-50">
              <option value="">{accountsLoading ? '取引先を読み込み中' : '未選択'}</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">商談日</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div className="sm:col-span-4">
            <button onClick={create} disabled={busy || !ready || mutations.creationBlocked('deal')} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '追加中…' : '追加する'}</button>
          </div>
        </div>
      )}

      {/* カンバン */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {boardStages.map((st) => {
          const unassigned = st.id === '__unassigned__'
          const col = deals.filter((d) => unassigned ? !d.stageId || !knownStageIds.has(d.stageId) : d.stageId === st.id)
          const allStage = unassigned
            ? { count: unassignedCount, total: unassignedTotal }
            : stageSummary.find((row) => row.stageId === st.id)
          const isDropTarget = !unassigned && dragOverStageId === st.id && !!dragDealId
          return (
            <div
              key={st.id}
              data-stage-col={unassigned ? undefined : st.id}
              className={`flex-shrink-0 w-72 rounded-2xl p-3 transition-colors ${isDropTarget ? 'bg-green-100 ring-2 ring-green-400' : 'bg-slate-100'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
                  <span className="font-black text-slate-700 text-sm">{st.name}</span>
                  <span className="text-[11px] font-bold text-slate-400">{allStage?.count ?? 0}</span>
                </div>
                {!unassigned && <span className="text-[11px] font-bold text-slate-400">{st.probability}%</span>}
              </div>
              <p className="text-[11px] font-bold text-slate-400 mb-2">{summaryYen(allStage?.total ?? '0')}</p>
              <div className="space-y-2">
                {col.map((d) => {
                  const dealTasks = tasksOf(d.id)
                  const previewTasks = dealTasks.slice(0, 3)
                  return (
                    <div
                      key={d.id}
                      onPointerDown={(e) => onCardPointerDown(e, d)}
                      className={`bg-white rounded-xl shadow-sm select-none transition-opacity ${dragDealId === d.id ? 'opacity-40' : ''}`}
                    >
                      {/* ドラッグハンドル（マウスはカード全体でも掴めるが、タッチはここから。スクロール温存のため touch-action:none） */}
                      <div
                        data-drag-handle
                        style={{ touchAction: 'none' }}
                        title="ドラッグしてステージを移動"
                        className="flex items-center justify-center h-5 text-slate-300 hover:text-slate-400 cursor-grab active:cursor-grabbing"
                      >
                        <span className="material-symbols-outlined text-[18px] leading-none">drag_indicator</span>
                      </div>

                      <div className="px-3 pb-3">
                        {/* カード本体（クリック/タップで詳細。ドラッグ直後のクリックは抑制） */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => { if (movedRef.current) { movedRef.current = false; return } openDetail(d) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') openDetail(d) }}
                          className="block w-full text-left group cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <p className="font-black text-slate-800 text-sm leading-snug group-hover:text-green-700 transition-colors">{d.name}</p>
                            {isStale(d) && <span title="14日以上停滞" className="text-[10px] font-black text-white bg-red-500 rounded px-1.5 py-0.5 flex-shrink-0">停滞</span>}
                          </div>
                          {(d.accountName || d.contactName) && (
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                              {d.accountName ? `🏢 ${d.accountName}` : ''}{d.accountName && d.contactName ? '・' : ''}{d.contactName ? `👤 ${d.contactName}` : ''}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-green-600 font-black">{yen(d.amount)}</p>
                            {elapsedLabel(d) && (
                              <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px] leading-none">schedule</span>
                                {elapsedLabel(d)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* タスク（未完了。チェックで完了） */}
                        {d.openTaskCount > 0 && (
                          <div data-no-drag className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                            {previewTasks.map((t) => (
                              <div key={t.id} className="flex items-center gap-1.5">
                                <button
                                  disabled={mutations.blocked('task:' + t.id) || !ready} onClick={() => toggleTask(t)}
                                  className="w-4 h-4 rounded border-2 border-slate-300 hover:border-green-500 flex-shrink-0 flex items-center justify-center"
                                  title="完了にする"
                                />
                                <span className="text-[11px] font-bold text-slate-600 truncate flex-1">{t.title}</span>
                                {t.dueDate && (
                                  <span className={`text-[10px] font-black flex-shrink-0 ${isTaskOverdue(t) ? 'text-red-500' : 'text-slate-400'}`}>
                                    {fmtShortDate(t.dueDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                            {d.openTaskCount > previewTasks.length && (
                              <button onClick={() => openDetail(d)} className="text-[10px] font-black text-slate-400 hover:text-green-600">
                                ほか{d.openTaskCount - previewTasks.length}件のタスク…
                              </button>
                            )}
                          </div>
                        )}

                        <select
                          data-no-drag
                          value={d.stageId || ''}
                          disabled={!ready || mutations.blocked('deal:' + d.id)}
                          onChange={(e) => moveStage(d, e.target.value)}
                          className="mt-2 w-full text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50"
                        >
                          {!knownStageIds.has(d.stageId || '') && <option value="" disabled>ステージを選択</option>}
                          {stages.map((s) => <option key={s.id} value={s.id}>→ {s.name}</option>)}
                        </select>
                        <button
                          data-no-drag
                          onClick={() => aiNextAction(d)}
                          disabled={!!aiDealId || mutations.creationBlocked('next-action')}
                          className="mt-1.5 w-full text-[11px] font-black text-[#7f19e6] hover:bg-purple-50 rounded-lg py-1.5 flex items-center justify-center gap-0.5 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                          {aiDealId === d.id ? 'AI考え中…' : 'AI次アクション'}
                        </button>
                      </div>
                    </div>
                  )
                })}
                {col.length === 0 && <p className="text-[11px] font-bold text-slate-300 text-center py-4">なし</p>}
              </div>
            </div>
          )
        })}
        {stages.length === 0 && (
          <p className="text-slate-400 font-bold">{dealsError ? '商談を表示できません' : dealsLoading || !ready ? 'パイプラインを読み込み中…' : '商談ステージはありません'}</p>
        )}
      </div>
      {nextCursor && (
        <div className="flex justify-center py-4">
          <button type="button" onClick={loadMore} disabled={loadingMore || dealsLoading} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50">
            {loadingMore ? '読み込み中…' : '商談をさらに表示'}
          </button>
        </div>
      )}
      {!nextCursor && totalCount > deals.length && !dealsLoading && (
        <div className="flex justify-center py-4">
          <button type="button" onClick={load} className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm">
            更新された商談を読み込む
          </button>
        </div>
      )}

      {/* ドラッグ中のゴースト（ポインタ追従） */}
      {ghost && (
        <div className="fixed z-[60] pointer-events-none w-64" style={{ left: ghost.x + 12, top: ghost.y + 8 }}>
          <div className="bg-white rounded-xl p-3 shadow-2xl ring-2 ring-green-400 rotate-2">
            <p className="font-black text-slate-800 text-sm truncate">{ghost.deal.name}</p>
            <p className="text-green-600 font-black text-sm">{yen(ghost.deal.amount)}</p>
          </div>
        </div>
      )}

      {/* ===== AI次アクション モーダル（提案 + タスク候補をチェックして追加） ===== */}
      {ready && aiModal && aiModal.identity === mutations.identity && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeAi}>
          <div role="dialog" aria-modal="true" aria-label="保存済みのAI次アクション" className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 break-words" onClick={(e) => e.stopPropagation()}>
            <MutationRecovery mutations={mutations} />
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-[11px] font-black text-[#7f19e6] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>保存済みのAI次アクション
                </p>
                <p className="text-xs text-slate-500">実行時点の情報による提案です。その後の変更は含まれません。</p>
                <h2 className="text-lg font-black text-slate-900 leading-snug">{aiModal.deal.name}</h2>
              </div>
              <button onClick={closeAi} className="text-slate-300 hover:text-slate-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded-2xl bg-purple-50 p-4 mb-3">
              <p className="font-black text-slate-800 text-sm">{aiModal.nextAction}</p>
              {aiModal.reason && <p className="text-xs font-bold text-slate-500 mt-1">{aiModal.reason}</p>}
            </div>
            {aiModal.risk && (
              <div className="rounded-2xl bg-red-50 p-3 mb-3">
                <p className="text-xs font-black text-red-600">{aiModal.risk}</p>
              </div>
            )}

            {aiModal.candidates.length > 0 ? (
              <>
                <p className="text-xs font-black text-slate-500 mb-2">タスク候補（チェックしたものを追加・期日は変更できます）</p>
                <div className="space-y-2 mb-4">
                  {aiModal.candidates.map((c, i) => (
                    <div key={c.id} className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 transition-colors ${c.checked ? 'border-green-400 bg-green-50/50' : 'border-slate-200'}`}>
                      <button
                        disabled={aiAdding} onClick={() => setAiModal((m) => m && ({ ...m, candidates: m.candidates.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) }))}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${c.checked ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}
                      >
                        {c.checked && <span className="material-symbols-outlined text-[16px]">check</span>}
                      </button>
                      <span className="font-bold text-sm text-slate-800 flex-1 leading-snug">{c.title}</span>
                      <input
                        type="date"
                        value={c.dueDate || ''}
                        disabled={aiAdding}
                        onChange={(e) => setAiModal((m) => m && ({ ...m, candidates: m.candidates.map((x, j) => (j === i ? { ...x, dueDate: e.target.value || null } : x)) }))}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold flex-shrink-0 w-[8.5rem]"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={addCheckedTasks}
                  disabled={aiAdding || aiModal.candidates.every((c) => !c.checked)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50"
                >
                  {aiAdding ? '追加中…' : `チェックしたタスクを追加（${aiModal.candidates.filter((c) => c.checked).length}件）`}
                </button>
              </>
            ) : (
              <p className="text-xs font-bold text-slate-400">タスク候補はありませんでした。</p>
            )}
          </div>
        </div>
      )}

      {/* ===== 商談詳細モーダル（プロパティ編集 + タスク + 活動タイムライン） ===== */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={closeDetail}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <MutationRecovery mutations={mutations} />
            <div className="flex items-start justify-between gap-2 mb-4">
              <h2 className="text-lg font-black text-slate-900">商談の詳細</h2>
              <button onClick={closeDetail} className="text-slate-300 hover:text-slate-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* プロパティ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-slate-500 mb-1">商談名 *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">金額(円)</label>
                <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">確度(%)</label>
                <input value={form.probability} inputMode="numeric" maxLength={3} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">取引先</label>
                <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} disabled={accountsLoading || accountsError} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold disabled:opacity-50">
                  <option value="">{accountsLoading ? '取引先を読み込み中' : '未選択'}</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">先方担当者名</label>
                <input value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} placeholder="例: 山田様（営業部長）" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">商談日</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">完了予定日</label>
                <input type="date" value={form.expectedCloseDate} onChange={(e) => setForm((f) => ({ ...f, expectedCloseDate: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-black text-slate-500 mb-1">メモ</label>
                <textarea value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} rows={3} placeholder="商談の状況・先方の要望など" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
            </div>
            <button onClick={saveDetail} disabled={saving || !ready || mutations.blocked('deal:' + detail.id)} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 mb-6">
              {saving ? '保存中…' : '保存する'}
            </button>

            {/* タスク */}
            <div className="mb-6">
              <p className="text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">check_box</span>タスク
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && addDetailTask()}
                  placeholder="やることを入力（例: 見積を送る）"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-bold text-sm"
                />
                <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 font-bold text-xs w-[8.5rem]" />
                <button onClick={addDetailTask} disabled={taskBusy || mutations.creationBlocked('task') || !ready || !newTaskTitle.trim()} className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm disabled:opacity-50">追加</button>
              </div>
              <div className="space-y-1.5">
                {detailTasksError && <p role="alert" className="text-xs font-bold text-red-700">商談のタスクを読み込めませんでした。<button type="button" onClick={() => loadDetailTasks(detail.id, detailTasksRetryPage)} className="underline">再試行</button></p>}
                {detailTasksLoading && <p role="status" className="text-xs font-bold text-slate-400">タスクを読み込んでいます…</p>}
                {detailTasks.length === 0 && detailTasksPage > 0 && !detailTasksLoading && !detailTasksError && <p className="text-xs font-bold text-slate-300">タスクはまだありません</p>}
                {detailTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <button
                      disabled={mutations.blocked('task:' + t.id) || !ready} onClick={() => toggleTask(t)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${t.status === 'done' ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 hover:border-green-500'}`}
                    >
                      {t.status === 'done' && <span className="material-symbols-outlined text-[14px]">check</span>}
                    </button>
                    <span className={`text-sm font-bold flex-1 truncate ${t.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{t.title}</span>
                    {t.dueDate && (
                      <span className={`text-[11px] font-black flex-shrink-0 ${isTaskOverdue(t) ? 'text-red-500' : 'text-slate-400'}`}>
                        <span className="material-symbols-outlined text-[12px] align-middle">event</span> {fmtShortDate(t.dueDate)}{isTaskOverdue(t) ? '（期限切れ）' : ''}
                      </span>
                    )}
                  </div>
                ))}
                {detailTasksPage > 0 && <p className="text-xs text-slate-500">{detailTasks.length}件を表示中{detailTasksHasMore ? '（続きがあります）' : ''}</p>}
                {detailTasksHasMore && <button type="button" onClick={() => loadDetailTasks(detail.id, detailTasksPage + 1)} disabled={detailTasksLoading || detailTasksError} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">次の200件を表示</button>}
              </div>
            </div>

            {/* 活動タイムライン（タスクと同じ操作感: 上に追加フォーム・下にリスト） */}
            <div>
              <p className="text-sm font-black text-slate-700 mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[18px]">history</span>活動タイムライン
              </p>
              <div className="flex gap-2 mb-2">
                <select value={actType} onChange={(e) => setActType(e.target.value as ActivityType)} className="rounded-xl border border-slate-200 px-2 py-2 font-bold text-xs">
                  {(Object.keys(ACTIVITY_TYPE_LABEL) as ActivityType[]).map((k) => (
                    <option key={k} value={k}>{ACTIVITY_TYPE_LABEL[k]}</option>
                  ))}
                </select>
                <input
                  value={actSubject}
                  onChange={(e) => setActSubject(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229 && addActivity()}
                  placeholder="活動内容を入力（例: 初回ヒアリング実施）"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-bold text-sm"
                />
                <button onClick={addActivity} disabled={actBusy || mutations.creationBlocked('activity') || !ready || !actSubject.trim()} className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm disabled:opacity-50">追加</button>
              </div>
              <div className="space-y-1.5">
                {activitiesError && (
                  <div role="alert" className="text-xs font-bold text-red-700">
                    活動を読み込めませんでした。<button type="button" onClick={() => loadActivities(detail.id, activitiesRetryCursor || undefined)} className="underline">再試行</button>
                  </div>
                )}
                {activitiesLoading && <p className="text-xs font-bold text-slate-400">活動を読み込み中…</p>}
                {detailActs.length === 0 && !activitiesError && !activitiesLoading && <p className="text-xs font-bold text-slate-300">活動はまだ記録されていません</p>}
                {detailActs.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-[10px] font-black text-white bg-slate-400 rounded px-1.5 py-0.5 flex-shrink-0">
                      {ACTIVITY_TYPE_LABEL[a.type as ActivityType] || a.type}
                    </span>
                    <span className="text-sm font-bold text-slate-700 flex-1 truncate">{a.subject || a.body}</span>
                    <span className="text-[11px] font-black text-slate-400 flex-shrink-0">{fmtShortDate(a.occurredAt)}</span>
                  </div>
                ))}
                {!activitiesLoading && !activitiesError && <p className="text-xs text-slate-500">{detailActs.length} / {activitiesTotal}件を表示</p>}
                {activitiesCursor && <button type="button" onClick={() => loadActivities(detail.id, activitiesCursor)} disabled={activitiesLoading} className="rounded-lg border px-3 py-2 text-xs disabled:opacity-50">次の200件を表示</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
