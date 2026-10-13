'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import HrAuthenticatedScope from '@/components/hr/HrAuthenticatedScope'
import { HrEvaluationOverviewClientError, loadHrEvaluationPeriodOverview } from '@/lib/hr/evaluation-period-client'
import { findHrEvaluationCreationOrganization, useHrEvaluationCreation } from '@/lib/hr/use-evaluation-creation'
import { findHrEvaluationPeriodOperationOrganization, useHrEvaluationPeriodOperation } from '@/lib/hr/use-evaluation-period-operation'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'

type Overview = Awaited<ReturnType<typeof loadHrEvaluationPeriodOverview>>
type View = { state: 'loading' } | { state: 'error'; message: string; status: number } | { state: 'ready'; data: Overview }
const PERIOD_STATUS: Record<string, string> = { DRAFT: '準備中', OPEN: '進行中', IN_REVIEW: 'レビュー中', CLOSED: '完了' }
const EVALUATION_STATUS: Record<string, string> = {
  DRAFT: '未着手', SELF: '自己評価中', SELF_REVIEW: '自己評価中', SELF_EVALUATION: '自己評価中',
  IN_REVIEW: '上司評価中', MANAGER_REVIEW: '上司評価中', REVIEWED: '確認済み', SUBMITTED: '提出済み', FINALIZED: '確定',
}
const buttonClass = 'px-4 py-2 rounded-full border border-slate-300 text-sm font-bold disabled:opacity-50'
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
const fmtDate = (date: string) => new Date(date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })

export default function EvaluationPeriodDetailPage() {
  const params = useParams(), id = typeof params?.id === 'string' ? params.id : ''
  return <HrAuthenticatedScope callbackUrl={'/hr/evaluations/period/' + encodeURIComponent(id)} resourceLabel="評価期間">
    {actor => <EvaluationPeriodContent key={id} id={id} actor={actor} />}
  </HrAuthenticatedScope>
}

function EvaluationPeriodContent({ id, actor }: { id: string; actor: string }) {
  const organizationScope = useHrOrganizationRequest()
  const [view, setView] = useState<View>({ state: 'loading' }), [attempt, setAttempt] = useState(0)
  const organization = useRef<string>(), patchBusy = useRef(false), confirmedVersion = useRef<string>()
  const [updating, setUpdating] = useState(false)
  const [evaluatorId, setEvaluatorId] = useState('')
  const [scopeInitialized, setScopeInitialized] = useState(false), [scopeIssue, setScopeIssue] = useState('')
  const [notice, setNotice] = useState<{ message: string; verifyAttempt: number | null; verified: boolean; operationId?: string; minimumVersion?: string; completedVersion?: string; intendedStatus?: 'OPEN' | 'CLOSED' } | null>(null)
  const lifetime = useHrPageLifetime()
  const data = view.state === 'ready' ? view.data : null
  const periodOperation = useHrEvaluationPeriodOperation(scopeInitialized && !scopeIssue ? 'authenticated' : 'loading', actor, organization.current ?? '', id)
  const creation = useHrEvaluationCreation(scopeInitialized && !scopeIssue ? 'authenticated' : 'loading', actor, organization.current ?? '', id)
  useEffect(() => {
    try {
      const periodOrganization = findHrEvaluationPeriodOperationOrganization(actor, id)
      const creationOrganization = findHrEvaluationCreationOrganization(actor, id)
      if (periodOrganization && creationOrganization && periodOrganization !== creationOrganization) throw Error('操作時の組織が一致しません。')
      organization.current = periodOrganization ?? creationOrganization
      if (organizationScope.organizationId && organization.current && organization.current !== organizationScope.organizationId) {
        setScopeIssue('前回の操作は別の組織で行われました。操作記録は保持しています。画面上部の「表示する組織」で操作時の組織を選び直し、評価期間を開いて結果を確認してください。')
      }
    }
    catch { setScopeIssue('前回の変更操作の組織を安全に確認できません。操作記録は保持しています。ブラウザの保存設定と評価一覧を確認してください。') }
    setScopeInitialized(true)
  }, [actor, id, organizationScope.organizationId])
  useEffect(() => {
    if (!scopeInitialized) return
    if (scopeIssue) { setView({ state: 'error', status: 0, message: scopeIssue }); return }
    const controller = new AbortController(); let active = true
    setView({ state: 'loading' })
    void loadHrEvaluationPeriodOverview(id, controller.signal, organization.current || organizationScope.organizationId, organizationScope.request).then(snapshot => {
      if (!active || controller.signal.aborted) return
      if (confirmedVersion.current && new Date(snapshot.period.updatedAt).getTime() < new Date(confirmedVersion.current).getTime()) throw Error('評価期間の応答が確認済みの変更より古いため、再取得してください。')
      organization.current = snapshot.organizationId
      setView({ state: 'ready', data: snapshot })
      setNotice(old => {
        if (old?.verifyAttempt !== attempt) return old
        const version = new Date(snapshot.period.updatedAt).getTime()
        const invalid = old.minimumVersion && version < new Date(old.minimumVersion).getTime() || old.completedVersion === snapshot.period.updatedAt && snapshot.period.status !== old.intendedStatus
        return invalid ? { ...old, verified: false, message: '評価期間の応答が操作記録と一致しません。内容を変更せず、再確認してください。' } : { ...old, verified: true }
      })
    }).catch((error: unknown) => {
      if (!active || controller.signal.aborted) return
      setView({ state: 'error', status: error instanceof HrEvaluationOverviewClientError ? error.status : 0,
        message: error instanceof HrEvaluationOverviewClientError ? error.message : '評価期間の応答を確認できませんでした。再取得してください。' })
    })
    return () => { active = false; controller.abort() }
  }, [id, attempt, scopeInitialized, scopeIssue])

  const reload = () => setAttempt(old => old + 1)
  const verifyStatus = async () => {
    if (patchBusy.current || updating || creation.busy || periodOperation.busy || !lifetime.live()) return
    patchBusy.current = true; setUpdating(true)
    try {
      const intent = periodOperation.intent
      const result = intent ? await periodOperation.recover() : null
      if (!lifetime.live() || !periodOperation.isCurrent()) return
      if (intent && (!result || result.state === 'not_received')) {
        setNotice({ message: '変更結果が未確認です。未受付の操作は「この変更操作を終了する」で終了してから、保存結果を確認してください。', verifyAttempt: null, verified: false }); return
      }
      const nextAttempt = attempt + 1
      setNotice({ message: '現在の評価期間を確認し、最新状態を確認してから続けてください。', verifyAttempt: nextAttempt, verified: false,
        ...(intent ? { operationId: intent.operationId, intendedStatus: intent.input.status, minimumVersion: result?.state === 'completed' ? result.updatedAt : intent.input.expectedUpdatedAt } : {}),
        ...(result?.state === 'completed' ? { completedVersion: result.updatedAt } : {}),
      })
      setAttempt(nextAttempt)
    } finally { patchBusy.current = false; if (lifetime.live()) setUpdating(false) }
  }
  const finishStatus = async () => {
    if (!notice?.verified || patchBusy.current || periodOperation.busy || creation.busy || !periodOperation.ready || !lifetime.live()) return
    if (periodOperation.intent && (notice.operationId !== periodOperation.intent.operationId || !periodOperation.result || periodOperation.result.state === 'not_received' || !await periodOperation.acknowledge(notice.operationId))) return
    if (lifetime.live() && periodOperation.isCurrent()) { if (data) confirmedVersion.current = data.period.updatedAt; setNotice(null) }
  }
  const finishDeletedStatus = async () => {
    const result = periodOperation.result
    if (result?.state !== 'deleted' || patchBusy.current || periodOperation.busy || creation.busy || !lifetime.live()) return
    patchBusy.current = true; setUpdating(true)
    try {
      if (await periodOperation.acknowledge(result.operationId) && lifetime.live() && periodOperation.isCurrent()) lifetime.router.push('/hr/evaluations')
    } finally { patchBusy.current = false; if (lifetime.live()) setUpdating(false) }
  }
  const handleStatus = async (status: 'OPEN' | 'CLOSED') => {
    if (!data?.period.canManageEvaluations || patchBusy.current || notice || creation.intent || creation.busy || !creation.ready || !periodOperation.ready || periodOperation.intent || periodOperation.busy) return
    patchBusy.current = true; setUpdating(true)
    const period = data.period
    try {
      const response = await periodOperation.create({ periodId: id, expectedUpdatedAt: period.updatedAt, status })
      if (!lifetime.live() || !periodOperation.isCurrent()) return
      const body = response?.acknowledgment
      if (!response || response.result.state !== 'completed') {
        setNotice({ message: '更新結果を確認できませんでした。新しく変更せず、同じ変更操作の結果を確認してください。', verifyAttempt: null, verified: false }); return
      }
      if (!object(body) || body.success !== true || !object(body.period) || body.period.id !== id || body.period.organizationId !== data.organizationId ||
        body.period.status !== status || !iso(body.period.updatedAt) || body.period.updatedAt !== response.result.updatedAt || new Date(body.period.updatedAt).getTime() <= new Date(period.updatedAt).getTime() ||
        !await periodOperation.acknowledge(response.result.operationId, body.period.updatedAt)) {
        setNotice({ message: '保存の応答を確認できませんでした。保存結果を確認してから続けてください。', verifyAttempt: null, verified: false }); return
      }
      if (!lifetime.live() || !periodOperation.isCurrent()) return
      confirmedVersion.current = body.period.updatedAt
      lifetime.toast.success(status === 'OPEN' ? '評価期間を開始しました' : '評価期間を締めました')
      reload()
    } catch {
      if (lifetime.live()) setNotice({ message: '更新結果を確認できませんでした。保存結果を確認してから続けてください。', verifyAttempt: null, verified: false })
    } finally { if (lifetime.live()) { patchBusy.current = false; setUpdating(false) } }
  }
  const createEvaluation = async (employeeId: string) => {
    if (!data?.period.canManageEvaluations || patchBusy.current || notice || creation.intent || creation.busy || !creation.ready || periodOperation.intent || periodOperation.busy || !periodOperation.ready || !lifetime.live()) return
    patchBusy.current = true
    try {
      if (evaluatorId && (evaluatorId === employeeId || !data?.employees.some(employee => employee.id === evaluatorId))) {
        lifetime.toast.error('対象者以外の上司担当者を選択してください。'); return
      }
      await creation.create({ periodId: id, employeeId, evaluatorId: evaluatorId || null })
    }
    finally { patchBusy.current = false }
  }
  const finishCreation = async (open: boolean) => {
    const result = creation.result
    if (!result || result.state === 'not_received') return
    const acknowledged = await creation.acknowledge()
    if (!acknowledged || !creation.isCurrent() || !lifetime.live()) return
    if (open && result.state === 'created') lifetime.router.push('/hr/evaluations/' + encodeURIComponent(result.evaluation.id))
    else if (view.state === 'error') lifetime.router.push('/hr/evaluations')
    else reload()
  }

  const periodRecovery = (notice || periodOperation.intent || periodOperation.message) ? <section role="alert" className="bg-amber-50 rounded-2xl p-4 mb-4">
      <h2 className="font-bold">評価期間の変更結果を確認してください</h2>
      <p className="mt-2">{notice?.message || periodOperation.message || '前回の変更結果が未確認です。新しく変更せず、同じ操作の結果を確認してください。'}</p>
      {notice && periodOperation.message && notice.message !== periodOperation.message && <p className="mt-2">{periodOperation.message}</p>}
      {periodOperation.loginRequired && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/period/' + id)}>ログインする</Link>}
      <div className="flex flex-wrap gap-3 mt-3">
        {periodOperation.intent && <button type="button" className={buttonClass} disabled={updating || periodOperation.busy || creation.busy} onClick={() => void periodOperation.recover()}>変更操作の結果を確認する</button>}
        {periodOperation.intent && (!periodOperation.result || periodOperation.result.state === 'not_received') && <button type="button" className={buttonClass} disabled={updating || periodOperation.busy || creation.busy || periodOperation.accessDenied || periodOperation.loginRequired || view.state === 'error'} onClick={() => void periodOperation.recover(true)}>この変更操作を終了する</button>}
        {view.state === 'ready' && periodOperation.result?.state !== 'deleted' && <button type="button" className={buttonClass} disabled={updating || periodOperation.busy || creation.busy} onClick={() => void verifyStatus()}>保存結果を確認する</button>}
        {periodOperation.result?.state === 'deleted' && <button type="button" className={buttonClass} disabled={updating || periodOperation.busy || creation.busy} onClick={() => void finishDeletedStatus()}>削除済みの結果を確認して評価一覧に戻る</button>}
        {notice?.verified && view.state === 'ready' && periodOperation.result?.state !== 'deleted' && <button type="button" className={buttonClass} disabled={updating || periodOperation.busy || creation.busy || !periodOperation.ready} onClick={() => void finishStatus()}>最新状態を確認して続ける</button>}
      </div>
    </section> : null

  const creationRecovery = (creation.intent || creation.message) ? <section role="status" className="bg-blue-50 rounded-2xl p-4 mb-4">
      <p>{creation.message || '前回の評価作成がまだ確認できていません。結果を確認してから続けてください。'}</p>
      <div className="flex flex-wrap gap-3 mt-3">
        {creation.loginRequired && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/period/' + id)}>ログインする</Link>}
        {creation.intent && <button type="button" className={buttonClass} disabled={creation.busy} onClick={() => void creation.recover()}>作成結果を確認する</button>}
        {creation.result?.state === 'not_received' && <>
          <button type="button" className={buttonClass} disabled={view.state !== 'ready' || !data?.period.canManageEvaluations || creation.accessDenied || creation.loginRequired || creation.busy || updating || Boolean(notice) || periodOperation.busy || Boolean(periodOperation.intent) || !periodOperation.ready} onClick={() => void creation.retry()}>同じ内容で作成を再開する</button>
          <button type="button" className={buttonClass} disabled={creation.busy || creation.accessDenied || creation.loginRequired} onClick={() => void creation.recover(true)}>未受付の操作を終了する</button>
        </>}
        {creation.result?.state === 'created' && <button type="button" className={buttonClass} disabled={creation.busy} onClick={() => void finishCreation(true)}>保存済みの評価を開く</button>}
        {creation.result && creation.result.state !== 'not_received' && <button type="button" className={buttonClass} disabled={creation.busy} onClick={() => void finishCreation(false)}>{view.state === 'error' ? '結果を確認して評価一覧に戻る' : '結果を確認して一覧を更新する'}</button>}
      </div>
    </section> : null

  if (view.state === 'loading') return <div className="p-6 lg:p-10 max-w-4xl mx-auto" role="status">評価期間と対象者を確認しています。</div>
  if (view.state === 'error') return <div className="p-6 lg:p-10 max-w-4xl mx-auto">
    {periodRecovery}
    {creationRecovery}
    <div className="bg-white rounded-3xl shadow-md p-8" role="alert">
      <h1 className="text-lg font-bold">{view.status === 404 ? '評価期間が見つかりません' : '評価期間を表示できません'}</h1>
      <p className="mt-3">{view.message}</p>
      <div className="flex flex-wrap gap-3 mt-4">
        {view.status === 401 && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/period/' + id)}>ログインする</Link>}
        {view.status !== 404 && <button type="button" className={buttonClass} onClick={reload}>再取得する</button>}
        <Link className={buttonClass} href="/hr/evaluations">評価一覧に戻る</Link>
      </div>
    </div>
  </div>
  const { period, employees } = view.data
  const disabled = updating || Boolean(notice) || creation.busy || Boolean(creation.intent) || !creation.ready || periodOperation.busy || Boolean(periodOperation.intent) || !periodOperation.ready
  return <div className="p-6 lg:p-10 max-w-4xl mx-auto">
    <Link href="/hr/evaluations" className="inline-block mb-4 text-blue-600 font-bold">評価一覧に戻る</Link>
    {periodRecovery}
    {creationRecovery}
    <header className="bg-white rounded-3xl shadow-md p-6 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div><h1 className="text-2xl font-black text-slate-900 break-words">{period.name}</h1>
          <p className="mt-2 text-sm font-bold">{Object.prototype.hasOwnProperty.call(PERIOD_STATUS, period.status) ? PERIOD_STATUS[period.status] : '状態未確認'}</p>
          <p className="text-sm text-slate-500 mt-1">{fmtDate(period.startDate)} 〜 {fmtDate(period.endDate)}</p></div>
        <div className="flex items-center gap-2">
          {period.canManageEvaluations && period.status === 'DRAFT' && <button type="button" className={buttonClass} disabled={disabled} onClick={() => void handleStatus('OPEN')}>評価を開始する</button>}
          {period.canManageEvaluations && ['OPEN', 'IN_REVIEW'].includes(period.status) && <button type="button" className={buttonClass} disabled={disabled} onClick={() => void handleStatus('CLOSED')}>評価を締める</button>}
        </div>
      </div>
      {period.canManageEvaluations && period.status === 'DRAFT' && <p className="mt-3 text-xs text-amber-800 bg-amber-50 rounded-xl px-3 py-2">「準備中」の評価期間はダッシュボードの「進行中の評価」に集計されません。各メンバーの評価を作成し、「評価を開始する」を押すと進行中になります。</p>}
    </header>
    <section className="bg-white rounded-3xl shadow-md p-6">
      <h2 className="text-lg font-bold text-slate-900 mb-4">メンバーの評価 <span className="text-sm text-slate-600">{period.evaluationCount} / {employees.length} 名作成済み</span></h2>
      {period.canManageEvaluations && employees.length > 0 && <div className="mb-4 space-y-2">
        <label className="block text-sm font-bold" htmlFor="evaluation-creation-evaluator">次に作成する評価の上司担当者</label>
        <select id="evaluation-creation-evaluator" className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2" value={evaluatorId} disabled={disabled} onChange={event => setEvaluatorId(event.target.value)}>
          <option value="">指定なし（管理者がレビューを行います）</option>
          {employees.map(employee => <option key={employee.id} value={employee.id}>{`${employee.lastName} ${employee.firstName}`.trim() || '名称未設定'}</option>)}
        </select>
        <p className="text-xs text-slate-600">選択した担当者は、組織メンバーと従業員の紐付けが有効な場合、本人の提出後に上司評価を行えます。対象者と同じ従業員は指定できません。</p>
        <Link className="text-xs font-bold text-blue-600 underline" href="/hr/settings">組織設定でメンバーと従業員の紐付けを確認する</Link>
      </div>}
      {employees.length === 0 ? <div className="text-center py-8 text-slate-600">
        <p>{period.canManageEvaluations ? '先に従業員を登録してください' : '表示できる対象者はいません'}</p>
        {period.canManageEvaluations && <Link href="/hr/employees/new" className="mt-2 inline-block text-blue-600 font-bold">従業員を追加する</Link>}
      </div> : <ul className="space-y-2">{employees.map(employee => <li key={employee.id} className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200">
        <div className="min-w-0"><p className="font-bold text-slate-900 break-words">{`${employee.lastName} ${employee.firstName}`.trim() || '名称未設定'}</p>{employee.department && <p className="text-xs text-slate-600 break-words">{employee.department.name}</p>}</div>
        <div className="flex flex-wrap items-center gap-2">
          {employee.evaluation ? <><span className="text-xs font-bold">{Object.prototype.hasOwnProperty.call(EVALUATION_STATUS, employee.evaluation.status) ? EVALUATION_STATUS[employee.evaluation.status] : '状態未確認'}</span><Link className={buttonClass} href={'/hr/evaluations/' + encodeURIComponent(employee.evaluation.id)}>評価を開く</Link></> :
            employee.evaluationUnavailable ? <span className="text-sm text-amber-800">評価情報の確認が必要です。管理者にお問い合わせください。</span> :
              period.canManageEvaluations ? <button type="button" className={buttonClass} disabled={disabled} onClick={() => void createEvaluation(employee.id)}>評価を作成</button> : <span className="text-xs text-slate-600">表示できる評価はありません</span>}
        </div>
      </li>)}</ul>}
    </section>
  </div>
}
