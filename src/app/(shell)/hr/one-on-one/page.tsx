'use client'
import { PageTitle, useToolUiNext } from '@/components/hr/ui-next'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { Button, EmptyState } from '@/components/ds'
import HrLoadError, { HrStatusError, hrErrorStatus } from '@/components/hr/HrLoadError'

import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'

import { useEffect, useId, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface OneOnOneRecord {
  id: string
  employeeId: string
  employeeName: string
  employeePhotoUrl?: string | null
  date: string
  duration: number
  status: string
  agendaCount: number
  actionItemCount: number
}

const AVATAR_COLORS = [
  'from-blue-500 to-blue-600',
  'from-red-400 to-red-500',
  'from-emerald-500 to-emerald-600',
  'from-amber-400 to-amber-500',
  'from-purple-500 to-purple-600',
  'from-pink-400 to-pink-500',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function OneOnOnePage() {
  const { request: fetch } = useHrOrganizationRequest()
  const { toast, router, live } = useHrPageLifetime()
  const [records, setRecords] = useState<OneOnOneRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<any[]>([])
  const [showNewModal, setShowNewModal] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedManager, setSelectedManager] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [creating, setCreating] = useState(false)
  const [canCreate, setCanCreate] = useState(false)
  const [creationManagerId, setCreationManagerId] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [listError, setListError] = useState('')
  // 新しい見た目で、失敗の種類（ログイン・権限・上限）を分けるためのステータス
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined)
  const uiNext = useToolUiNext()
  const reduceMotion = useReducedMotion()
  const still = uiNext && Boolean(reduceMotion)
  const dialogRef = useRef<HTMLDivElement>(null)
  const dialogTitleId = useId(), employeeFieldId = useId(), managerFieldId = useId(), dateFieldId = useId(), timeFieldId = useId(), durationLabelId = useId()
  const [employeePage, setEmployeePage] = useState(0)
  const [employeeHasMore, setEmployeeHasMore] = useState(false)
  const [employeeLoading, setEmployeeLoading] = useState(false)
  const [employeeError, setEmployeeError] = useState('')
  const recordSequence = useRef(0)
  const employeeSequence = useRef(0)

  useEffect(() => {
    fetchRecords()
    fetchEmployees()
    return () => { recordSequence.current++; employeeSequence.current++ }
  }, [])

  async function fetchRecords(nextPage = 1) {
    const sequence = ++recordSequence.current
    setLoading(true)
    setListError('')
    try {
      const res = await fetch(`/api/hr/one-on-one?page=${nextPage}`)
      if (!res.ok) throw new HrStatusError(res.status)
      const data = await res.json()
      if (!Array.isArray(data.items) || data.page !== nextPage || !Number.isInteger(data.totalPages)) throw new Error()
      if (sequence !== recordSequence.current) return
      setPage(nextPage)
      setTotalPages(data.totalPages)
      setCanCreate(data.canCreateOneOnOne === true)
      setCreationManagerId(data.creationManagerId || null)
      if (data.creationManagerId) setSelectedManager(data.creationManagerId)
      const items = (data.items ?? data.records ?? []).map((o: any) => ({
        id: o.id,
        employeeId: o.employeeId,
        employeeName: o.employee ? `${o.employee.lastName} ${o.employee.firstName}` : '',
        employeePhotoUrl: o.employee?.photoUrl || null,
        date: o.conductedAt || o.scheduledAt || '',
        duration: o.duration || 0,
        status: o.status,
        agendaCount: Array.isArray(o.agenda) ? o.agenda.length : 0,
        actionItemCount: Array.isArray(o.aiActionItems) ? o.aiActionItems.length : 0,
      }))
      setRecords(items)
    } catch (error) {
      if (sequence === recordSequence.current) { setListError('1on1の一覧を取得できませんでした。再読み込みしてください。'); setErrorStatus(hrErrorStatus(error)) }
    } finally {
      if (sequence === recordSequence.current) setLoading(false)
    }
  }

  async function fetchEmployees(nextPage = 1) {
    const sequence = ++employeeSequence.current
    setEmployeeLoading(true)
    setEmployeeError('')
    try {
      const res = await fetch(`/api/hr/employees?page=${nextPage}&pageSize=100`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (!Array.isArray(data.items) || data.page !== nextPage || !Number.isInteger(data.totalPages)) throw new Error()
      if (sequence !== employeeSequence.current) return
      setEmployees(previous => nextPage === 1 ? data.items : [...new Map([...previous, ...data.items].map(emp => [emp.id, emp])).values()])
      setEmployeePage(nextPage)
      setEmployeeHasMore(nextPage < data.totalPages)
    } catch {
      if (sequence === employeeSequence.current) setEmployeeError('従業員を取得できませんでした。選択肢がすべて表示されていない可能性があります。')
    } finally {
      if (sequence === employeeSequence.current) setEmployeeLoading(false)
    }
  }

  async function handleCreateRecord() {
    if (!canCreate || !selectedEmployee || !selectedManager) return
    if (!!scheduledDate !== !!scheduledTime) {
      toast.error('日付と時間を両方入力してください。未定の場合は両方を空欄にしてください。')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/hr/one-on-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee,
          managerId: selectedManager,
          scheduledAt: scheduledDate && scheduledTime
            ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
            : null,
          duration: selectedDuration,
        }),
      })
      if (!res.ok) throw new Error('1on1の作成に失敗しました')
      const data = await res.json()
      const newId = data.oneOnOne?.id ?? data.id
      if (newId) {
        router.push(`/hr/one-on-one/${newId}`)
      } else {
        setShowNewModal(false)
        fetchRecords()
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  // 新しい見た目: 記録のダイアログは Esc で閉じ、開いたら最初の欄に移る。閉じたら元のボタンに戻す
  useEffect(() => {
    if (!uiNext || !showNewModal) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('select')?.focus())
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setShowNewModal(false) } }
    document.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', onKey); opener?.focus() }
  }, [uiNext, showNewModal])

  const focusRing = uiNext ? ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)] focus-visible:ring-offset-2' : ''

  return (
    <div className={uiNext ? 'p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto' : 'p-6 lg:p-10 max-w-5xl mx-auto'}>
      <motion.div initial={still ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header（新しい見た目では、375px でボタンを下に回す） */}
        <div className={uiNext ? 'flex flex-wrap items-end justify-between gap-4 mb-6' : 'flex items-center justify-between mb-8'}>
          <div>
            <PageTitle className="text-3xl font-black text-slate-900">1on1</PageTitle>
            <p className="text-sm text-slate-500 mt-1">1対1ミーティングの記録を管理</p>
          </div>
          {canCreate && <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className={`${uiNext ? 'min-h-11 whitespace-nowrap' + focusRing + ' ' : ''}flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-full text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:bg-emerald-700 transition-all`}
          >
            <span aria-hidden className="material-symbols-outlined text-lg">add</span>
            1on1を記録
          </button>}
        </div>

        {listError && uiNext && <HrLoadError className="mb-4" subject="1on1の一覧" status={errorStatus} onRetry={() => { if (!loading) fetchRecords(page) }} />}
        {listError && !uiNext && <div role="alert" className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl">
          {listError} <button onClick={() => fetchRecords(page)} disabled={loading} className="underline">再読み込み</button>
        </div>}
        {/* Records List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-white rounded-3xl shadow-md animate-pulse" />
            ))}
          </div>
        ) : records.length > 0 ? (
          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.06 },
              },
            }}
          >
            {records.map((record) => {
              const nameParts = (record.employeeName || '').split(' ').filter(Boolean)
              const initials = nameParts.length >= 2
                ? `${nameParts[0][0]}${nameParts[1][0]}`
                : nameParts.length === 1
                  ? nameParts[0].slice(0, 2)
                  : '??'
              const avatarColor = getAvatarColor(record.employeeName || record.employeeId)
              return (
                <motion.div
                  key={record.id}
                  variants={{
                    hidden: { opacity: 0, x: -15 },
                    visible: { opacity: 1, x: 0 },
                  }}
                  whileHover={still ? undefined : { x: 4 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  <Link
                    href={`/hr/one-on-one/${record.id}`}
                    className={`flex items-center gap-4 bg-white rounded-3xl shadow-md p-5 hover:shadow-lg transition-all${uiNext ? ' min-w-0' + focusRing : ''}`}
                  >
                    {record.employeePhotoUrl ? (
                      <img src={record.employeePhotoUrl} alt={record.employeeName} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
                        {initials}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={uiNext ? 'truncate text-base font-bold text-slate-900' : 'text-base font-bold text-slate-900'}>{record.employeeName}</p>
                      <p className="text-xs text-slate-500">
                        {record.date && !isNaN(new Date(record.date).getTime())
                          ? new Date(record.date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '日時未設定'}
                        {' '}/ {record.duration || 0}分
                      </p>
                    </div>
                    <div className={uiNext ? 'flex shrink-0 items-center gap-3' : 'flex items-center gap-3'}>
                      <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">list_alt</span>
                          {record.agendaCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">task_alt</span>
                          {record.actionItemCount}
                        </span>
                      </div>
                      <span className={`${uiNext ? 'whitespace-nowrap ' : ''}px-3 py-1.5 rounded-full text-sm font-bold ${
                        record.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {record.status === 'COMPLETED' ? '完了' : '予定'}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        ) : !listError && uiNext ? (
          // 新しい見た目: 空の状態は絵＋次にやること1つ
          <EmptyState
            art="/hr/empty-members.webp"
            title="1on1の記録はまだありません"
            description={canCreate
              ? '定期的な1on1で、メンバーの成長を支えましょう。記録すると、AIが会話の要約とやることを作ります。'
              : '1on1の作成は、担当の上司か管理者に依頼してください。記録されると、ここに表示されます。'}
            action={canCreate
              ? <Button icon="Plus" onClick={() => setShowNewModal(true)}>1on1を記録する</Button>
              : <Button variant="secondary" href="/hr/dashboard" icon="LayoutDashboard">ダッシュボードに戻る</Button>}
          />
        ) : !listError ? (
          <div className="bg-white rounded-3xl shadow-lg p-12 text-center">
            <motion.img
              src="/hr/characters/present_%E3%83%97%E3%83%AC%E3%82%BC%E3%83%B3.png"
              alt="白くまキャラクター"
              className="w-40 mx-auto mb-4"
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            />
            <h3 className="text-2xl font-black text-slate-900 mb-2">1on1をはじめましょう！</h3>
            <p className="text-base text-slate-500 mb-2 max-w-md mx-auto">
              定期的な1on1で、メンバーの成長をサポートしましょう。
            </p>
            <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
              AIが会話の要約とアクションアイテムを自動生成します。
            </p>
            {canCreate && <motion.button
              onClick={() => setShowNewModal(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-600 text-white rounded-full text-base font-bold shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:bg-emerald-700 transition-all"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              1on1を記録する
            </motion.button>}
            {!canCreate && <p className="text-sm text-slate-500">1on1の作成は担当上司・管理者に依頼してください。</p>}
          </div>
        ) : null}
        {totalPages > (uiNext ? 1 : 0) && <nav aria-label="1on1一覧のページ" className="flex items-center justify-center gap-4 mt-6">
          <button type="button" disabled={loading || page <= 1} onClick={() => fetchRecords(page - 1)} className={`px-4 py-2 bg-white rounded-xl disabled:opacity-40${uiNext ? ' min-h-11 whitespace-nowrap' + focusRing : ''}`}>前へ</button>
          <span className={uiNext ? 'whitespace-nowrap' : undefined}>{page} / {totalPages}ページ</span>
          <button type="button" disabled={loading || page >= totalPages} onClick={() => fetchRecords(page + 1)} className={`px-4 py-2 bg-white rounded-xl disabled:opacity-40${uiNext ? ' min-h-11 whitespace-nowrap' + focusRing : ''}`}>次へ</button>
        </nav>}

        {/* FAB（新しい見た目では出さない。見出しの横の主ボタンと同じ役目で、375px では一覧に重なるため） */}
        {canCreate && !uiNext && <button
          onClick={() => setShowNewModal(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-xl shadow-emerald-500/30 flex items-center justify-center hover:bg-emerald-700 hover:shadow-2xl transition-all z-40"
          aria-label="1on1を記録"
        >
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>}

        {/* New 1on1 Modal */}
        {showNewModal && canCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => setShowNewModal(false)} />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={dialogTitleId}
              initial={still ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={uiNext ? 'relative bg-white rounded-3xl shadow-2xl p-5 sm:p-6 w-full max-w-md mx-4 max-h-[90dvh] overflow-y-auto' : 'relative bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md mx-4'}
            >
              <h2 id={dialogTitleId} className="text-lg font-bold text-slate-900 mb-4">1on1を記録</h2>
              <div className="space-y-4">
                {employeeLoading && <p role="status">従業員を読み込み中...</p>}
                {employeeError && <p role="alert" className="text-red-700">{employeeError}</p>}
                {(employeeHasMore || employeeError) && <button type="button" disabled={employeeLoading} onClick={() => fetchEmployees(employeePage + 1)} className="text-blue-700 underline disabled:opacity-40">
                  {employeeError ? '従業員の読み込みを再試行' : `従業員をさらに読み込む（現在${employees.length}名）`}
                </button>}
                <div>
                  <label htmlFor={employeeFieldId} className="block text-sm font-bold text-slate-700 mb-1">対象の従業員（部下）</label>
                  <select
                    id={employeeFieldId}
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    <option value="">選択してください</option>
                    {employees.filter((emp: any) => emp.id !== creationManagerId).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.lastName} {emp.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor={managerFieldId} className="block text-sm font-bold text-slate-700 mb-1">上司（面談者）</label>
                  <select
                    id={managerFieldId}
                    value={selectedManager}
                    disabled={!!creationManagerId}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                  >
                    <option value="">選択してください</option>
                    {creationManagerId && <option value={creationManagerId}>自分（担当上司）</option>}
                    {!creationManagerId && employees.filter((e: any) => e.id !== selectedEmployee).map((emp: any) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.lastName} {emp.firstName}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-sm text-slate-500">日時は任意です。未定の場合は日付・時間を両方空欄にしてください。</p>
                <div className={uiNext ? 'grid grid-cols-1 min-[400px]:grid-cols-2 gap-4' : 'grid grid-cols-2 gap-4'}>
                  <div className="min-w-0">
                    <label htmlFor={dateFieldId} className="block text-sm font-bold text-slate-700 mb-1">日付</label>
                    <input
                      id={dateFieldId}
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={timeFieldId} className="block text-sm font-bold text-slate-700 mb-1">時間</label>
                    <input
                      id={timeFieldId}
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border-b-2 border-slate-300 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>
                <div>
                  <p id={durationLabelId} className="block text-sm font-bold text-slate-700 mb-2">所要時間</p>
                  <div className="flex gap-2" role="group" aria-labelledby={durationLabelId}>
                    {[15, 30, 45, 60].map((min) => (
                      <button
                        key={min}
                        type="button"
                        onClick={() => setSelectedDuration(min)}
                        aria-pressed={selectedDuration === min}
                        className={`${uiNext ? 'min-h-11 whitespace-nowrap' + focusRing + ' ' : ''}flex-1 py-2 rounded-full text-sm font-bold transition-all ${
                          selectedDuration === min
                            ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-300'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {min}分
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className={`${uiNext ? 'min-h-11 whitespace-nowrap rounded-full' + focusRing + ' ' : ''}px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors`}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleCreateRecord}
                  disabled={creating || !selectedEmployee || !selectedManager}
                  className={`${uiNext ? 'min-h-11 whitespace-nowrap' + focusRing + ' ' : ''}flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md hover:shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50`}
                >
                  {creating ? '作成中...' : '開始'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
