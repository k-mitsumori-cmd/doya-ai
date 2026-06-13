'use client'

import { useEffect, useState, useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { sfaInit, withOrg } from '@/lib/sfa/client'
import { ACTIVITY_TYPE_LABEL } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'

interface Stage { id: string; name: string; order: number; probability: number; color: string; isWon: boolean; isLost: boolean }
interface Deal {
  id: string
  name: string
  amount: number
  stageId: string | null
  probability: number
  accountId: string | null
  accountName: string | null
  contactName: string | null
  note: string | null
  status: string
  startDate: string | null
  expectedCloseDate: string | null
  wonAt: string | null
  lostAt: string | null
  lastActivityAt: string | null
}
interface Account { id: string; name: string }
interface Task { id: string; title: string; status: string; dueDate: string | null; dealId: string | null }
interface SfaActivityRow { id: string; type: string; subject: string | null; body: string | null; occurredAt: string }
interface AiTaskCandidate { title: string; dueDate: string | null; checked: boolean }

const STALE_DAYS = 14
const yen = (n: number) => '¥' + (n || 0).toLocaleString('ja-JP')
// Date → 'YYYY-MM-DD'（ローカル日付、<input type="date"> 用）
const toDateInput = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const isoToDateInput = (iso: string | null) => (iso ? toDateInput(new Date(iso)) : '')
const fmtShortDate = (iso: string | null) => {
  if (!iso) return null
  const dt = new Date(iso)
  return `${dt.getMonth() + 1}/${dt.getDate()}`
}
const isTaskOverdue = (t: Task) =>
  t.status !== 'done' && !!t.dueDate && new Date(t.dueDate).getTime() < new Date().setHours(0, 0, 0, 0)
// 商談日からの経過期間ラベル
const elapsedLabel = (d: Deal): string | null => {
  if (!d.startDate) return null
  const start = new Date(d.startDate)
  if (isNaN(start.getTime())) return null
  const closedAt = d.status !== 'open' ? d.wonAt || d.lostAt : null
  const end = closedAt ? new Date(closedAt) : new Date()
  const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000))
  return d.status === 'open' ? `${days}日経過` : `${days}日で決着`
}

export default function SfaDealsPage() {
  const orgSlug = (useParams().orgSlug as string) || ''
  const ready = !!orgSlug
  const [stages, setStages] = useState<Stage[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [startDate, setStartDate] = useState(() => toDateInput(new Date()))
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/deals', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => {
        setStages(d.stages || [])
        setDeals(d.deals || [])
      })
      .catch(() => {})
  }, [ready, orgSlug])
  const loadTasks = useCallback(() => {
    if (!ready) return
    fetch('/api/sfa/tasks', sfaInit(orgSlug))
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {})
  }, [ready, orgSlug])
  useEffect(() => {
    if (!ready) return
    load()
    loadTasks()
    fetch('/api/sfa/accounts', sfaInit(orgSlug)).then((r) => r.json()).then((d) => setAccounts(d.accounts || [])).catch(() => {})
  }, [ready, orgSlug, load, loadTasks])

  const create = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/sfa/deals', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount: Number(amount) || 0, accountId: accountId || null, startDate: startDate || null }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setName(''); setAmount(''); setAccountId(''); setStartDate(toDateInput(new Date())); setOpen(false)
      toast.success('商談を追加しました')
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const moveStage = async (deal: Deal, stageId: string) => {
    // 楽観更新
    setDeals((prev) => prev.map((x) => (x.id === deal.id ? { ...x, stageId } : x)))
    try {
      const res = await fetch(`/api/sfa/deals/${deal.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId }),
      }))
      if (!res.ok) throw new Error()
      load()
    } catch {
      toast.error('移動に失敗しました')
      load()
    }
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
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: x.status === 'done' ? 'open' : 'done' } : x)))
    try {
      const res = await fetch(`/api/sfa/tasks/${t.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }))
      if (!res.ok) throw new Error()
      loadTasks()
    } catch {
      toast.error('更新に失敗しました')
      loadTasks()
    }
  }

  // ============ AI次アクション（提案 + タスク候補の選択追加） ============
  const [aiDealId, setAiDealId] = useState<string | null>(null) // ローディング中の商談
  const [aiModal, setAiModal] = useState<{
    deal: Deal
    nextAction: string
    reason: string
    risk: string
    candidates: AiTaskCandidate[]
  } | null>(null)
  const [aiAdding, setAiAdding] = useState(false)

  const aiNextAction = async (deal: Deal) => {
    setAiDealId(deal.id)
    try {
      const res = await fetch('/api/sfa/ai/next-action', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setAiModal({
        deal,
        nextAction: d.nextAction || '',
        reason: d.reason || '',
        risk: d.risk || '',
        candidates: (d.tasks || []).map((t: { title: string; dueDate: string | null }) => ({ ...t, checked: true })),
      })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setAiDealId(null)
    }
  }

  const addCheckedTasks = async () => {
    if (!aiModal) return
    const checked = aiModal.candidates.filter((c) => c.checked && c.title.trim())
    if (checked.length === 0) {
      toast.error('追加するタスクにチェックを入れてください')
      return
    }
    setAiAdding(true)
    try {
      let ok = 0
      for (const c of checked) {
        const res = await fetch('/api/sfa/tasks', sfaInit(orgSlug, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: c.title, dueDate: c.dueDate || null, dealId: aiModal.deal.id }),
        }))
        if (res.ok) ok++
      }
      toast.success(`タスクを${ok}件追加しました`)
      setAiModal(null)
      loadTasks()
    } catch {
      toast.error('追加に失敗しました')
    } finally {
      setAiAdding(false)
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

  const openDetail = (d: Deal) => {
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
    setActSubject('')
    setNewTaskTitle('')
    setNewTaskDue('')
    // 活動タイムライン（この商談のみ）
    fetch(withOrg(`/api/sfa/activities?dealId=${d.id}`, orgSlug), sfaInit(orgSlug))
      .then((r) => r.json())
      .then((x) => setDetailActs(x.activities || []))
      .catch(() => {})
  }

  const saveDetail = async () => {
    if (!detail) return
    if (!form.name.trim()) {
      toast.error('商談名は必須です')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/sfa/deals/${detail.id}`, sfaInit(orgSlug, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          amount: Number(form.amount) || 0,
          accountId: form.accountId, // '' で解除
          contactName: form.contactName,
          startDate: form.startDate,
          expectedCloseDate: form.expectedCloseDate,
          probability: Number(form.probability) || 0,
          note: form.note,
        }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success('保存しました')
      setDetail(null)
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const addDetailTask = async () => {
    if (!detail || !newTaskTitle.trim()) return
    setTaskBusy(true)
    try {
      const res = await fetch('/api/sfa/tasks', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle, dueDate: newTaskDue || null, dealId: detail.id }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setNewTaskTitle(''); setNewTaskDue('')
      loadTasks()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setTaskBusy(false)
    }
  }

  const addActivity = async () => {
    if (!detail || !actSubject.trim()) return
    setActBusy(true)
    try {
      const res = await fetch('/api/sfa/activities', sfaInit(orgSlug, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: actType, subject: actSubject, dealId: detail.id }),
      }))
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setActSubject('')
      // タイムライン再取得 + 一覧の lastActivityAt 反映
      fetch(withOrg(`/api/sfa/activities?dealId=${detail.id}`, orgSlug), sfaInit(orgSlug))
        .then((r) => r.json())
        .then((x) => setDetailActs(x.activities || []))
        .catch(() => {})
      load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setActBusy(false)
    }
  }

  const isStale = (d: Deal) =>
    d.status === 'open' && d.lastActivityAt && Date.now() - new Date(d.lastActivityAt).getTime() > STALE_DAYS * 86400000

  // 重み付きパイプライン（open のみ）
  const weighted = deals.filter((d) => d.status === 'open').reduce((s, d) => s + (d.amount * d.probability) / 100, 0)
  const openTotal = deals.filter((d) => d.status === 'open').reduce((s, d) => s + d.amount, 0)

  const detailTasks = detail ? tasks.filter((t) => t.dealId === detail.id) : []

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-black text-slate-900">商談パイプライン</h1>
          <p className="text-slate-500 font-bold text-sm">
            総額 {yen(openTotal)}・確度加重 <span className="text-green-600">{yen(Math.round(weighted))}</span>
          </p>
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

      {open && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs font-black text-slate-500 mb-1">商談名</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例: 新規SaaS導入" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">金額(円)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1000000" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">取引先</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold">
              <option value="">未選択</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">商談日</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
          </div>
          <div className="sm:col-span-4">
            <button onClick={create} disabled={busy} className="px-5 py-2.5 rounded-xl bg-green-600 text-white font-black disabled:opacity-50">{busy ? '追加中…' : '追加する'}</button>
          </div>
        </div>
      )}

      {/* カンバン */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((st) => {
          const col = deals.filter((d) => d.stageId === st.id)
          const colTotal = col.reduce((s, d) => s + d.amount, 0)
          const isDropTarget = dragOverStageId === st.id && !!dragDealId
          return (
            <div
              key={st.id}
              data-stage-col={st.id}
              className={`flex-shrink-0 w-72 rounded-2xl p-3 transition-colors ${isDropTarget ? 'bg-green-100 ring-2 ring-green-400' : 'bg-slate-100'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
                  <span className="font-black text-slate-700 text-sm">{st.name}</span>
                  <span className="text-[11px] font-bold text-slate-400">{col.length}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">{st.probability}%</span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 mb-2">{yen(colTotal)}</p>
              <div className="space-y-2">
                {col.map((d) => {
                  const dealTasks = tasksOf(d.id)
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
                        {dealTasks.length > 0 && (
                          <div data-no-drag className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                            {dealTasks.slice(0, 3).map((t) => (
                              <div key={t.id} className="flex items-center gap-1.5">
                                <button
                                  onClick={() => toggleTask(t)}
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
                            {dealTasks.length > 3 && (
                              <button onClick={() => openDetail(d)} className="text-[10px] font-black text-slate-400 hover:text-green-600">
                                ほか{dealTasks.length - 3}件のタスク…
                              </button>
                            )}
                          </div>
                        )}

                        <select
                          data-no-drag
                          value={d.stageId || ''}
                          onChange={(e) => moveStage(d, e.target.value)}
                          className="mt-2 w-full text-[11px] font-bold rounded-lg border border-slate-200 px-2 py-1.5 bg-slate-50"
                        >
                          {stages.map((s) => <option key={s.id} value={s.id}>→ {s.name}</option>)}
                        </select>
                        <button
                          data-no-drag
                          onClick={() => aiNextAction(d)}
                          disabled={aiDealId === d.id}
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
          <p className="text-slate-400 font-bold">{ready ? 'パイプラインを読み込み中…' : '読み込み中…'}</p>
        )}
      </div>

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
      {aiModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setAiModal(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <div>
                <p className="text-[11px] font-black text-[#7f19e6] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>AI次アクション
                </p>
                <h2 className="text-lg font-black text-slate-900 leading-snug">{aiModal.deal.name}</h2>
              </div>
              <button onClick={() => setAiModal(null)} className="text-slate-300 hover:text-slate-500">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="rounded-2xl bg-purple-50 p-4 mb-3">
              <p className="font-black text-slate-800 text-sm">💡 {aiModal.nextAction}</p>
              {aiModal.reason && <p className="text-xs font-bold text-slate-500 mt-1">{aiModal.reason}</p>}
            </div>
            {aiModal.risk && (
              <div className="rounded-2xl bg-red-50 p-3 mb-3">
                <p className="text-xs font-black text-red-600">⚠️ {aiModal.risk}</p>
              </div>
            )}

            {aiModal.candidates.length > 0 ? (
              <>
                <p className="text-xs font-black text-slate-500 mb-2">タスク候補（チェックしたものを追加・期日は変更できます）</p>
                <div className="space-y-2 mb-4">
                  {aiModal.candidates.map((c, i) => (
                    <div key={i} className={`flex items-center gap-2.5 rounded-xl border-2 p-2.5 transition-colors ${c.checked ? 'border-green-400 bg-green-50/50' : 'border-slate-200'}`}>
                      <button
                        onClick={() => setAiModal((m) => m && ({ ...m, candidates: m.candidates.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) }))}
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${c.checked ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300'}`}
                      >
                        {c.checked && <span className="material-symbols-outlined text-[16px]">check</span>}
                      </button>
                      <span className="font-bold text-sm text-slate-800 flex-1 leading-snug">{c.title}</span>
                      <input
                        type="date"
                        value={c.dueDate || ''}
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
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-4">
              <h2 className="text-lg font-black text-slate-900">商談の詳細</h2>
              <button onClick={() => setDetail(null)} className="text-slate-300 hover:text-slate-500">
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
                <input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^0-9]/g, '') }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">確度(%)</label>
                <input value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value.replace(/[^0-9]/g, '') }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold" />
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">取引先</label>
                <select value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-bold">
                  <option value="">未選択</option>
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
            <button onClick={saveDetail} disabled={saving} className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-lime-600 text-white font-black disabled:opacity-50 mb-6">
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
                  onKeyDown={(e) => e.key === 'Enter' && addDetailTask()}
                  placeholder="やることを入力（例: 見積を送る）"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-bold text-sm"
                />
                <input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="rounded-xl border border-slate-200 px-2 py-2 font-bold text-xs w-[8.5rem]" />
                <button onClick={addDetailTask} disabled={taskBusy || !newTaskTitle.trim()} className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm disabled:opacity-50">追加</button>
              </div>
              <div className="space-y-1.5">
                {detailTasks.length === 0 && <p className="text-xs font-bold text-slate-300">タスクはまだありません</p>}
                {detailTasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <button
                      onClick={() => toggleTask(t)}
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
                  onKeyDown={(e) => e.key === 'Enter' && addActivity()}
                  placeholder="活動内容を入力（例: 初回ヒアリング実施）"
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 font-bold text-sm"
                />
                <button onClick={addActivity} disabled={actBusy || !actSubject.trim()} className="px-4 py-2 rounded-xl bg-green-600 text-white font-black text-sm disabled:opacity-50">追加</button>
              </div>
              <div className="space-y-1.5">
                {detailActs.length === 0 && <p className="text-xs font-bold text-slate-300">活動はまだ記録されていません</p>}
                {detailActs.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-[10px] font-black text-white bg-slate-400 rounded px-1.5 py-0.5 flex-shrink-0">
                      {ACTIVITY_TYPE_LABEL[a.type as ActivityType] || a.type}
                    </span>
                    <span className="text-sm font-bold text-slate-700 flex-1 truncate">{a.subject || a.body}</span>
                    <span className="text-[11px] font-black text-slate-400 flex-shrink-0">{fmtShortDate(a.occurredAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
