'use client'
import { PageTitle } from '@/components/hr/ui-next'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { TrialNote } from '@/components/TrialCallout'
import EvaluationForm from '@/components/hr/EvaluationForm'
import HrAuthenticatedScope from '@/components/hr/HrAuthenticatedScope'
import { readHrEvaluationDetail, readHrEvaluationSaveAcknowledgment, getHrEvaluationStatusPresentation, type EvaluationDetail, type HrEvaluationWorkflowAction } from '@/lib/hr/evaluation-detail-client'
import { readHrEvaluationDetailResponse } from '@/lib/hr/evaluation-detail-http'
import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'
import { useHrEvaluationSaveOperation } from '@/lib/hr/use-evaluation-save-operation'
import { useHrEvaluationAiOperation } from '@/lib/hr/use-evaluation-ai-operation'
import { loadHrEvaluationPeriodOverview } from '@/lib/hr/evaluation-period-client'

type Notice = { message: string; loginRequired: boolean }
const buttonClass = 'px-4 py-2 rounded-full border border-slate-300 text-sm font-bold disabled:opacity-50'
export default function EvaluationDetailPage() {
  const params = useParams(), id = typeof params?.id === 'string' ? params.id : ''
  return <HrAuthenticatedScope callbackUrl={'/hr/evaluations/' + encodeURIComponent(id)} resourceLabel="評価情報">
    {actor => <EvaluationDetailContent key={id} id={id} actor={actor} />}
  </HrAuthenticatedScope>
}

function EvaluationDetailContent({ id, actor }: { id: string; actor: string }) {
  const organizationScope = useHrOrganizationRequest()
  const [evaluation, setEvaluation] = useState<EvaluationDetail | null>(null), [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState<Notice | null>(null), [attempt, setAttempt] = useState(0), [formEpoch, setFormEpoch] = useState(0)
  const [recovered, setRecovered] = useState<EvaluationDetail | null>(null), [checking, setChecking] = useState(false), [busy, setBusy] = useState(false)
  const [evaluatorAttempt, setEvaluatorAttempt] = useState(0)
  const [evaluators, setEvaluators] = useState<{ key: string; options?: { id: string; label: string }[]; message: string }>({ key: '', message: '' })
  const evaluatorScope = evaluation?.ratingField === 'finalRating' ? JSON.stringify([evaluation.organizationId, evaluation.periodId]) : ''
  const current = useRef<EvaluationDetail | null>(null), task = useRef(false), blocked = useRef(false), recovery = useRef(false)
  const { fetch, live, toast } = useHrPageLifetime(readHrEvaluationDetailResponse)
  const ai = useHrEvaluationAiOperation('authenticated', actor, evaluation?.organizationId || '', id)
  const save = useHrEvaluationSaveOperation('authenticated', actor, evaluation?.organizationId || '', id)
  const saveTerminal = Boolean(save.result && save.result.state !== 'not_received')
  const aiTerminal = Boolean(ai.result && !['not_received', 'processing'].includes(ai.result.state))
  useEffect(() => {
    if (!evaluatorScope) return
    const [organizationId, periodId] = JSON.parse(evaluatorScope) as [string, string]
    const controller = new AbortController(); let active = true
    setEvaluators({ key: evaluatorScope, message: '担当者一覧を確認しています。' })
    void loadHrEvaluationPeriodOverview(periodId, controller.signal, organizationId, organizationScope.request).then(snapshot => {
      if (!active || controller.signal.aborted) return
      if (!snapshot.period.canManageEvaluations) throw Error('担当者を変更する権限を確認できません。')
      setEvaluators({ key: evaluatorScope, options: snapshot.employees.map(employee => ({ id: employee.id, label: `${employee.lastName} ${employee.firstName}`.trim() || '名称未設定' })), message: '' })
    }).catch(() => { if (active && !controller.signal.aborted) setEvaluators({ key: evaluatorScope, message: '担当者一覧を取得できませんでした。入力は保持しています。再取得してください。' }) })
    return () => { active = false; controller.abort() }
  }, [evaluatorScope, evaluatorAttempt])
  const uncertainty = (message: string, loginRequired = false) => {
    if (!live()) return
    blocked.current = true; setRecovered(null); setNotice({ message, loginRequired })
  }
  useEffect(() => {
    const controller = new AbortController(); let active = true
    setLoading(true)
    void fetch('/api/hr/evaluations/' + encodeURIComponent(id), { method: 'GET', signal: controller.signal }).then(async response => {
      if (!active || !live()) return
      if (!response.ok) { setNotice({ message: response.status === 404 ? '評価が見つかりません。' : response.status === 401 ? 'ログインし直してから評価を確認してください。' : response.status === 403 ? 'この評価を表示する権限を確認できませんでした。' : '評価を取得できませんでした。時間をおいて再取得してください。', loginRequired: response.status === 401 }); return }
      const value = readHrEvaluationDetail(await response.json(), id)
      if (!active || !live()) return
      current.current = value; setEvaluation(value); setNotice(null); blocked.current = false
    }).catch(() => { if (active && live()) setNotice({ message: '評価データの応答を確認できませんでした。再取得してください。', loginRequired: false }) })
      .finally(() => { if (active && live()) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [id, attempt, fetch])

  const handleSave = async (payload: Record<string, unknown>) => {
    if (!current.current || !ai.ready || ai.intent || ai.busy || !save.ready || save.intent || save.busy || task.current || blocked.current || recovery.current || !live()) throw Error('保存結果を確認してから続けてください。')
    task.current = true; setBusy(true)
    const previous = current.current
    try {
      const response = await save.create({ evaluationId: id, expectedUpdatedAt: previous.updatedAt }, payload)
      if (!live()) throw Error('操作が中断されました。')
      if (!response || response.result.state !== 'completed') {
        uncertainty('保存結果を確認できませんでした。入力を保持したまま、前回の保存操作の結果を確認してください。')
        throw Error('保存結果を確認してください。保存処理は自動で再実行されません。')
      }
      let acknowledgment = response.acknowledgment
      if (!acknowledgment || typeof acknowledgment !== 'object' || !('evaluation' in acknowledgment)) {
        const detail = await fetch('/api/hr/evaluations/' + encodeURIComponent(id), { method: 'GET', headers: { 'X-HR-Organization-Id': previous.organizationId } })
        if (!live()) throw Error('操作が中断されました。')
        if (!detail.ok) { uncertainty('保存した評価を完全に取得できませんでした。入力を保持したまま保存結果を確認してください。', detail.status === 401); throw Error('保存内容を確認してください。') }
        acknowledgment = await detail.json()
      }
      const saved = readHrEvaluationSaveAcknowledgment(acknowledgment, previous, payload)
      if (saved.updatedAt !== response.result.updatedAt || !await save.acknowledge(response.result.operationId, saved.updatedAt)) throw Error('保存操作の確認を完了できませんでした。')
      if (!live()) throw Error('操作が中断されました。')
      current.current = saved; setEvaluation(saved); toast.success(payload.workflowAction === 'submit' ? '評価を提出しました' : payload.workflowAction === 'review' ? 'レビューを完了しました' : payload.workflowAction === 'finalize' ? '評価を確定しました' : '評価を保存しました')
    } catch {
      if (live() && !blocked.current) uncertainty('保存の応答を確認できませんでした。入力を保持したまま、現在の保存内容を確認してください。')
      throw Error(live() ? '評価の保存結果を確認してください。保存処理は自動で再実行されません。' : '操作が中断されました。')
    } finally { task.current = false; if (live()) setBusy(false) }
  }
  const handleWorkflowAction = async (action: HrEvaluationWorkflowAction) => { await handleSave({ workflowAction: action }) }
  const verify = async () => {
    if (!current.current || recovery.current || task.current || ai.busy || save.busy || !live()) return
    recovery.current = true; setChecking(true); setRecovered(null)
    try {
      const savedResult = save.intent ? await save.recover() : null
      if (save.intent && !savedResult) { uncertainty('保存操作の結果を確認できませんでした。入力を保持したまま再確認してください。'); return }
      if (!live()) return
      const response = await fetch('/api/hr/evaluations/' + encodeURIComponent(id), { method: 'GET', headers: { 'X-HR-Organization-Id': current.current.organizationId } })
      if (!live()) return
      if (!response.ok) { uncertainty('保存内容を取得できませんでした。入力は保持しています。時間をおいて再確認してください。', response.status === 401); return }
      const fresh = readHrEvaluationDetail(await response.json(), id, current.current.organizationId)
      if (fresh.employeeId !== current.current.employeeId || fresh.periodId !== current.current.periodId) throw Error('評価の対象が変更されています。')
      const completedVersion = savedResult?.state === 'completed' ? savedResult.updatedAt : ai.result?.state === 'completed' ? ai.result.updatedAt : null
      if (completedVersion && new Date(fresh.updatedAt).getTime() < new Date(completedVersion).getTime()) throw Error('保存内容が完了記録より古いため、再確認してください。')
      if (live()) setRecovered(fresh)
    } catch { uncertainty('保存内容の応答を確認できませんでした。入力は保持しています。再確認してください。') }
    finally { recovery.current = false; if (live()) setChecking(false) }
  }
  const replaceForm = async () => {
    if (!recovered || task.current || recovery.current || ai.busy || !ai.ready || save.busy || !save.ready || !live()) return
    if (save.intent && (!saveTerminal || !await save.acknowledge())) return
    if (ai.intent && (!aiTerminal || !await ai.acknowledge())) return
    if (!live()) return
    current.current = recovered; setEvaluation(recovered); setRecovered(null); setNotice(null); blocked.current = false; setFormEpoch(old => old + 1)
  }
  const generateComment = async (): Promise<string> => {
    const previous = current.current
    if (!previous || !ai.ready || ai.intent || ai.busy || !save.ready || save.intent || save.busy || blocked.current || task.current || recovery.current || !live()) throw Error('保存結果を確認してから生成してください。')
    task.current = true; setBusy(true)
    try {
      const result = await ai.create({ evaluationId: id, expectedUpdatedAt: previous.updatedAt })
      if (!result || result.state !== 'completed') throw Error('AIコメントの保存結果を確認できませんでした。')
      if (!live()) throw Error('操作が中断されました。')
      // AI persistence advances the row version. Keep the draft until a read confirms the current stored row.
      uncertainty('AIコメントの応答を受信しました。入力を保持したまま、現在の保存内容を確認してから続けてください。')
      return result.aiComment
    } catch {
      uncertainty('AIコメントの処理結果を確認できませんでした。再生成する前に、現在の保存内容を確認してください。')
      throw Error(live() ? 'AIコメントの処理結果を確認してください。生成処理は自動で再実行されません。' : '操作が中断されました。')
    } finally { task.current = false; if (live()) setBusy(false) }
  }

  if (loading) return <div role="status" className="p-6 lg:p-10 max-w-4xl mx-auto">評価情報を確認しています。</div>
  return <div className="p-6 lg:p-10 max-w-4xl mx-auto">
    <Link href="/hr/evaluations" className="inline-block mb-4 font-bold text-blue-600">評価一覧に戻る</Link>
    <PageTitle className="text-3xl font-black text-slate-900 mb-6">評価詳細</PageTitle>
    {(save.intent || save.message) && <section role="alert" className="bg-amber-50 rounded-2xl p-4 mb-4">
      <h2 className="font-bold">前回の保存結果を確認してください</h2>
      <p className="mt-2">{save.message || '前回の保存結果が未確認です。新しく保存せず、同じ操作の結果を確認してください。'}</p>
      {(save.loginRequired || notice?.loginRequired) && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/' + id)}>ログインする</Link>}
      {notice?.message.startsWith('保存内容') && <p className="mt-2">{notice.message}</p>}
      {save.intent && <div className="flex flex-wrap gap-3 mt-3">
        <button type="button" className={buttonClass} disabled={busy || checking || save.busy || ai.busy} onClick={() => void save.recover()}>保存操作の結果を確認する</button>
        {!saveTerminal && <button type="button" className={buttonClass} disabled={busy || checking || save.busy || ai.busy} onClick={() => void save.recover(true)}>この保存操作を終了する</button>}
        <button type="button" className={buttonClass} disabled={busy || checking || save.busy || ai.busy} onClick={() => void verify()}>現在の保存内容を確認する</button>
      </div>}
    </section>}
    {(ai.intent || ai.message) && <section role="alert" className="bg-amber-50 rounded-2xl p-4 mb-4">
      <h2 className="font-bold">{ai.limit ? '前回のAIコメント生成は利用上限のため開始されませんでした' : 'AIコメントの操作を確認してください'}</h2>
      <p className="mt-2">{ai.message || '前回の生成結果が未確認です。新しく生成せず、同じ操作の結果を確認してください。'}</p>
      {ai.limit && (ai.limit.canManageBilling ? <div className="mt-3">
        <p>組織のAI利用枠とプランをご確認ください。変更が反映された後、同じ操作で生成を再開できます。</p>
        <Link className={buttonClass + ' inline-block mt-3'} href="/hr/pricing">プランと利用枠を確認する</Link>
        <TrialNote className="mt-2" />
      </div> : <p className="mt-3">組織のオーナーに、AI利用枠とプランについてご相談ください。</p>)}
      {ai.result?.state === 'completed' && <p className="mt-2 whitespace-pre-wrap break-words">{ai.result.aiComment}</p>}
      {(ai.loginRequired || notice?.loginRequired) && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/' + id)}>ログインする</Link>}
      {ai.intent && <div className="flex flex-wrap gap-3 mt-3">
        <button type="button" className={buttonClass} disabled={busy || checking || ai.busy} onClick={() => void ai.recover()}>生成結果を確認する</button>
        {!aiTerminal && <button type="button" className={buttonClass} disabled={busy || checking || ai.busy} onClick={() => void ai.recover(true)}>この生成操作を終了する</button>}
        {ai.result?.state === 'not_received' && <button type="button" className={buttonClass} disabled={busy || checking || ai.busy} onClick={() => void ai.retry()}>同じ操作で生成を再開する</button>}
        <button type="button" className={buttonClass} disabled={busy || checking || ai.busy} onClick={() => void verify()}>現在の保存内容を確認する</button>
      </div>}
    </section>}
    {notice && !(ai.intent || ai.message || save.intent || save.message) && <section role="alert" className="bg-amber-50 rounded-2xl p-4 mb-4">
      <p>{notice.message}</p>
      <div className="flex flex-wrap gap-3 mt-3">
        {notice.loginRequired && <Link className={buttonClass} href={'/auth/signin?callbackUrl=' + encodeURIComponent('/hr/evaluations/' + id)}>ログインする</Link>}
        <button type="button" className={buttonClass} disabled={busy || checking} onClick={() => evaluation ? void verify() : setAttempt(old => old + 1)}>{evaluation ? '現在の保存内容を確認する' : '再取得する'}</button>
      </div>
    </section>}
    {recovered && <section role="status" className="bg-blue-50 rounded-2xl p-4 mb-4">
      <h2 className="font-bold">現在の保存内容</h2>
      <p className="mt-2 break-words">対象者：{recovered.employeeName}／評価期間：{recovered.periodName}</p>
      <p className="mt-2">以下は再取得時点の内容です。画面の入力はまだ置き換えていません。</p>
      <dl className="mt-3 space-y-2"><dt>評価の状態</dt><dd aria-label="保存済みの評価状態">{getHrEvaluationStatusPresentation(recovered.status).label}</dd><dt>上司評価の担当者</dt><dd aria-label="保存済みの上司担当者" className="break-words">{recovered.evaluatorId ? recovered.evaluatorName : '指定なし（管理者がレビューを行います）'}</dd></dl>
      <dl className="mt-3 space-y-2"><dt>自己コメント</dt><dd className="whitespace-pre-wrap break-words">{recovered.selfComment || '未入力'}</dd><dt>上司コメント</dt><dd className="whitespace-pre-wrap break-words">{recovered.managerComment || '未入力'}</dd><dt>総合評価</dt><dd>{recovered.overallScore} / 5</dd></dl>
      <details className="mt-3"><summary>保存済みの目標を確認する</summary><ul>{recovered.goals.map(goal => <li key={goal.id} className="mt-3 whitespace-pre-wrap break-words">{goal.title || 'タイトル未入力'}：{goal.description}／結果：{goal.result}／ウェイト：{goal.weight}%／評価：{goal.score}</li>)}</ul></details>
      <p className="mt-3">続ける場合は、現在の画面の入力を破棄して保存内容で開き直します。</p>
      <button type="button" className={buttonClass + ' mt-3'} disabled={busy || checking || ai.busy || save.busy || !ai.ready || !save.ready || Boolean(ai.intent && !aiTerminal) || Boolean(save.intent && !saveTerminal)} onClick={() => void replaceForm()}>入力を破棄し、保存内容で開き直す</button>
    </section>}
    {evaluation && <EvaluationForm key={JSON.stringify([actor, evaluation.organizationId, id, formEpoch])}
      evaluationId={evaluation.id} employeeId={evaluation.employeeId} employeeName={evaluation.employeeName} periodName={evaluation.periodName}
      initialGoals={evaluation.goals} initialSelfComment={evaluation.selfComment} initialManagerComment={evaluation.managerComment}
      initialOverallScore={evaluation.overallScore} status={evaluation.status} isManager={evaluation.isManager} ratingField={evaluation.ratingField}
      initialEvaluatorId={evaluation.evaluatorId} evaluatorOptions={evaluators.key === evaluatorScope ? evaluators.options : undefined} evaluatorOptionsMessage={evaluators.key === evaluatorScope ? evaluators.message : '担当者一覧を確認しています。'} onReloadEvaluators={() => setEvaluatorAttempt(old => old + 1)}
      disabled={Boolean(notice) || checking || !ai.ready || Boolean(ai.intent) || ai.busy || !save.ready || Boolean(save.intent) || save.busy} onSave={handleSave} onWorkflowAction={handleWorkflowAction} onGenerateComment={generateComment} />}
  </div>
}
