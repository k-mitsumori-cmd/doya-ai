'use client'

import { useHrPageLifetime } from '@/lib/hr/use-page-lifetime'
import { knownEvaluationDetailStatus, getHrEvaluationStatusPresentation, canEditHrEvaluation, getHrEvaluationClientPhase, getHrEvaluationWorkflowAction, type HrEvaluationWorkflowAction } from '@/lib/hr/evaluation-detail-client'

import { useState, useRef } from 'react'
import type { EvaluationRatingField } from '@/lib/hr/evaluation-access'
import { motion, AnimatePresence } from 'framer-motion'
import AiInsightPanel from './AiInsightPanel'

interface Goal {
  id: string
  title: string
  description: string
  weight: number
  result: string
  score: number
}

interface EvaluationFormProps {
  evaluationId?: string
  employeeId?: string
  employeeName?: string
  periodName?: string
  initialGoals?: Goal[]
  initialSelfComment?: string
  initialManagerComment?: string
  initialOverallScore?: number
  initialEvaluatorId?: string | null
  evaluatorOptions?: { id: string; label: string }[]
  evaluatorOptionsMessage?: string
  onReloadEvaluators?: () => void
  status?: string
  isManager?: boolean
  ratingField?: EvaluationRatingField
  onSave?: (data: any) => void | Promise<void>
  onWorkflowAction?: (action: HrEvaluationWorkflowAction) => Promise<void>
  onGenerateComment?: () => Promise<string>
  disabled?: boolean
}

function StarInput({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star}点`}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => !disabled && onChange(star)}
          className={`text-2xl font-black transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <span
            className={`material-symbols-outlined ${
              star <= (hover || value) ? 'text-amber-400' : 'text-slate-300'
            }`}
            style={{ fontVariationSettings: star <= (hover || value) ? "'FILL' 1" : "'FILL' 0" }}
          >
            star
          </span>
        </button>
      ))}
    </div>
  )
}

export default function EvaluationForm({
  evaluationId,
  employeeId,
  employeeName = '',
  periodName = '',
  initialGoals = [],
  initialSelfComment = '',
  initialManagerComment = '',
  initialOverallScore = 0,
  initialEvaluatorId = null,
  evaluatorOptions,
  evaluatorOptionsMessage = '',
  onReloadEvaluators,
  status = 'DRAFT',
  isManager = false,
  ratingField = 'selfRating',
  onSave,
  onGenerateComment,
  onWorkflowAction,
  disabled = false,
}: EvaluationFormProps) {
  const { fetch, toast, live } = useHrPageLifetime()
  const [goals, setGoals] = useState<Goal[]>(
    (initialGoals?.length ?? 0) > 0
      ? initialGoals
      : [{ id: crypto.randomUUID(), title: '', description: '', weight: 100, result: '', score: 0 }]
  )
  const [selfComment, setSelfComment] = useState(initialSelfComment)
  const [managerComment, setManagerComment] = useState(initialManagerComment)
  const [overallScore, setOverallScore] = useState(initialOverallScore)
  const [evaluatorId, setEvaluatorId] = useState(initialEvaluatorId ?? '')
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const aiLoadingRef = useRef(false)

  const statusPresentation = getHrEvaluationStatusPresentation(status)
  const [confirmWorkflow, setConfirmWorkflow] = useState(false), [workflowLoading, setWorkflowLoading] = useState(false)
  const workflowRef = useRef(false)
  const phase = getHrEvaluationClientPhase(status), workflow = getHrEvaluationWorkflowAction(status, ratingField)
  const isReadOnly = !canEditHrEvaluation(status, ratingField)
  const editingDisabled = disabled || isReadOnly || saving || aiLoading || workflowLoading

  const goalEditingDisabled = editingDisabled || phase === 2
  const addGoal = () => {
    setGoals([
      ...goals,
      { id: crypto.randomUUID(), title: '', description: '', weight: 0, result: '', score: 0 },
    ])
  }

  const removeGoal = (id: string) => {
    if (goals.length <= 1) return
    setGoals(goals.filter((g) => g.id !== id))
  }

  const updateGoal = (id: string, field: keyof Goal, value: string | number) => {
    setGoals(goals.map((g) => (g.id === id ? { ...g, [field]: value } : g)))
  }

  const handleAiComment = async () => {
    if (savingRef.current || aiLoadingRef.current || saving || aiLoading || isReadOnly || disabled || !live()) return
    aiLoadingRef.current = true
    setAiLoading(true)
    setAiResult(null)
    try {
      if (evaluationId && !(await handleSave())) {
        if (live()) setAiResult('エラー: 評価を保存できなかったため、AI生成は実行していません。入力内容を確認して保存をやり直してください。')
        return
      }
      if (!live()) return
      if (onGenerateComment) { const result = await onGenerateComment(); if (live()) setAiResult(result); return }
      const url = evaluationId
        ? `/api/hr/evaluations/${evaluationId}/ai-comment`
        : '/api/hr/evaluations/ai-comment'
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evaluationId,
          employeeId,
          goals,
          selfComment,
          managerComment,
          overallScore,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'AI生成に失敗しました')
      if (live()) setAiResult(data.aiComment || data.comment || data.result || '')
    } catch (e: any) {
      if (live()) setAiResult(`エラー: ${e.message}`)
    } finally {
      aiLoadingRef.current = false
      if (live()) setAiLoading(false)
    }
  }

  const handleSave = async () => {
    if (savingRef.current || saving || isReadOnly || disabled || !live()) return false
    savingRef.current = true
    setSaving(true)
    try {
      const evaluatorChanged = (evaluatorId || null) !== initialEvaluatorId
      if (evaluatorChanged && (ratingField !== 'finalRating' || phase === 2 || !evaluatorOptions || evaluatorId && (evaluatorId === employeeId || !evaluatorOptions.some(option => option.id === evaluatorId)))) throw Error('上司担当者を確認してから保存してください。')
      const payload = {
        evaluationId,
        employeeId,
        ...(phase !== 2 ? { goals } : {}),
        ...(phase === 0 && ratingField !== 'managerRating' ? { selfComment } : {}),
        ...(phase !== 2 && ratingField !== 'selfRating' ? { managerComment } : {}),
        overallScore,
        ...(evaluatorChanged ? { evaluatorId: evaluatorId || null } : {}),
      }
      if (onSave) {
        await onSave(payload)
      } else {
        const url = evaluationId ? `/api/hr/evaluations/${evaluationId}` : '/api/hr/evaluations'
        const method = evaluationId ? 'PATCH' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('保存に失敗しました')
      }
      return live()
    } catch (e: any) {
      if (live()) toast.error(e.message)
      return false
    } finally {
      savingRef.current = false
      if (live()) setSaving(false)
    }
  }

  const handleManualSave = async () => {
    if (aiLoadingRef.current) return false
    return handleSave()
  }

  const handleWorkflow = async () => {
    if (!workflow || !onWorkflowAction || workflowRef.current || disabled || savingRef.current || aiLoadingRef.current || !live()) return
    workflowRef.current = true; setWorkflowLoading(true)
    try {
      if (!(await handleSave()) || !live()) return
      await onWorkflowAction(workflow.action)
      if (live()) setConfirmWorkflow(false)
    } catch (error: any) { if (live()) toast.error(error.message) }
    finally { workflowRef.current = false; if (live()) setWorkflowLoading(false) }
  }

  const totalWeight = goals.reduce((sum, g) => sum + (g.weight || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header Info */}
      {(employeeName || periodName) && (
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex flex-wrap gap-6">
            {employeeName && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">対象者</p>
                <p className="text-sm font-semibold text-slate-900">{employeeName}</p>
              </div>
            )}
            {periodName && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">評価期間</p>
                <p className="text-sm font-semibold text-slate-900">{periodName}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">ステータス</p>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusPresentation.color}`}>
                {statusPresentation.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {ratingField === 'finalRating' && phase !== null && phase < 2 && <section className="bg-white rounded-3xl shadow-md p-6 space-y-2">
        <label className="block text-sm font-bold" htmlFor="evaluation-evaluator">上司評価の担当者</label>
        <select id="evaluation-evaluator" className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2" value={evaluatorId} disabled={editingDisabled || !evaluatorOptions} onChange={event => setEvaluatorId(event.target.value)}>
          <option value="">指定なし（管理者がレビューを行います）</option>
          {evaluatorId && !evaluatorOptions?.some(option => option.id === evaluatorId) && <option value={evaluatorId}>指定済みの担当者（一覧を確認してください）</option>}
          {evaluatorOptions?.filter(option => option.id !== employeeId).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <p className="text-xs text-slate-600">担当者の変更は、コメントなどの入力と一緒に「保存する」で反映されます。レビュー完了後は変更できません。</p>
        <p className="text-xs text-slate-600">担当者が操作するには、有効な組織メンバーへの従業員情報の紐付けが必要です。<a className="font-bold text-blue-600 underline" href="/hr/settings">組織設定でメンバーと従業員の紐付けを確認する</a></p>
        {evaluatorOptionsMessage && <p role="status" className="text-sm text-amber-800">{evaluatorOptionsMessage}</p>}
        {!evaluatorOptions && onReloadEvaluators && <button type="button" className="rounded-full border px-4 py-2 text-sm font-bold" disabled={editingDisabled} onClick={onReloadEvaluators}>担当者一覧を再取得する</button>}
      </section>}

      {/* Goals */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-500">flag</span>
            目標一覧
          </h3>
          <div className="flex items-center gap-3">
            {totalWeight !== 100 ? (
              <motion.span
                animate={{ x: [0, -4, 4, -4, 4, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
                className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full"
              >
                <span className="material-symbols-outlined text-sm">warning</span>
                ウェイト合計: {totalWeight}%（100%にしてください）
              </motion.span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                ウェイト合計: 100%
              </span>
            )}
            {!isReadOnly && (
              <button
                type="button"
                onClick={addGoal}
                disabled={goalEditingDisabled}
                className="flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 rounded-lg text-base font-bold hover:bg-sky-100 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                追加
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {goals.map((goal, index) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 last:mb-0"
            >
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-500">目標 {index + 1}</span>
                  {!isReadOnly && goals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      disabled={goalEditingDisabled}
                      aria-label="目標を削除"
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">タイトル</label>
                    <input
                      type="text"
                      value={goal.title}
                      onChange={(e) => updateGoal(goal.id, 'title', e.target.value)}
                      disabled={goalEditingDisabled}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="目標タイトルを入力"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">説明</label>
                    <textarea
                      value={goal.description}
                      onChange={(e) => updateGoal(goal.id, 'description', e.target.value)}
                      disabled={goalEditingDisabled}
                      rows={2}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
                      placeholder="目標の詳細を入力"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">ウェイト (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={goal.weight}
                      onChange={(e) => updateGoal(goal.id, 'weight', parseInt(e.target.value) || 0)}
                      disabled={goalEditingDisabled}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">スコア (1-5)</label>
                    <StarInput
                      value={goal.score}
                      onChange={(v) => updateGoal(goal.id, 'score', v)}
                      disabled={goalEditingDisabled}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">達成結果</label>
                    <textarea
                      value={goal.result}
                      onChange={(e) => updateGoal(goal.id, 'result', e.target.value)}
                      disabled={goalEditingDisabled}
                      rows={2}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
                      placeholder="達成結果を記入"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-3xl shadow-md p-6 space-y-4">
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-500">comment</span>
          コメント
        </h3>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">自己評価コメント</label>
          <textarea
            value={selfComment}
            onChange={(e) => setSelfComment(e.target.value)}
            disabled={editingDisabled || ratingField === 'managerRating' || phase !== 0}
            rows={4}
            className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
            placeholder="この評価期間の振り返りを記入してください..."
          />
        </div>
        {isManager && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">上司コメント</label>
            <textarea
              value={managerComment}
              onChange={(e) => setManagerComment(e.target.value)}
              disabled={editingDisabled || phase === 2}
              rows={4}
              className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500 resize-none"
              placeholder="部下への評価コメントを記入してください..."
            />
          </div>
        )}
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <h3 className="text-lg font-black text-slate-900 mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-sky-500">stars</span>
          {ratingField === 'selfRating' ? '自己評価の総合点' : ratingField === 'managerRating' ? '上司評価の総合点' : '最終評価の総合点'}
        </h3>
        <StarInput value={overallScore} onChange={setOverallScore} disabled={editingDisabled} />
      </div>

      {/* AI Comment Generation */}
      {!isReadOnly && (
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-400">auto_awesome</span>
              AI評価コメント生成
            </h3>
            <button
              type="button"
              onClick={handleAiComment}
              disabled={editingDisabled}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-400 to-indigo-600 text-white rounded-full text-base font-bold hover:shadow-lg hover:shadow-brand-400/20 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
              )}
              {aiLoading ? '生成中...' : 'AIコメント生成'}
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-500">現在の入力内容を保存してから、AIコメントを生成します。</p>
          {(aiLoading || aiResult) && (
            <AiInsightPanel loading={aiLoading} content={aiResult || ''} />
          )}
        </div>
      )}

      {isReadOnly && status !== 'FINALIZED' && knownEvaluationDetailStatus(status) && <p className="text-sm text-slate-600">この段階では編集できません。担当者によるレビュー・確定をお待ちください。</p>}
      {workflow && onWorkflowAction && confirmWorkflow && <section role="alert" className="bg-white border border-slate-300 rounded-2xl p-5 space-y-3">
        <p className="font-bold">{workflow.label}</p>
        <p className="text-sm">現在の入力を保存してから、この操作を記録します。{workflow.action === 'finalize' ? '確定後は編集できません。' : '提出・レビュー後は、この段階の入力を変更できません。'}{ratingField === 'finalRating' && workflow.action !== 'finalize' ? '組織管理者として対象者・評価者に代わって記録します。' : ''}</p>
        <button type="button" className="px-4 py-2 rounded-full border font-bold disabled:opacity-50" disabled={editingDisabled} onClick={() => void handleWorkflow()}>{workflowLoading ? '処理中...' : '保存して操作を確定する'}</button>
        <button type="button" className="ml-3 px-4 py-2 rounded-full border disabled:opacity-50" disabled={workflowLoading} onClick={() => setConfirmWorkflow(false)}>キャンセル</button>
      </section>}
      {/* Actions */}
      {!isReadOnly && (
        <div className="flex flex-wrap justify-end gap-3">
          {workflow && onWorkflowAction && <button type="button" className="px-5 py-3 rounded-full border border-blue-600 font-bold disabled:opacity-50" disabled={editingDisabled || confirmWorkflow} onClick={() => setConfirmWorkflow(true)}>{workflow.label}</button>}
          <button
            type="button"
            onClick={handleManualSave}
            disabled={editingDisabled}
            className="flex items-center gap-2 px-6 py-3.5 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">save</span>
            {saving ? '保存中...' : '保存する'}
          </button>
        </div>
      )}
    </div>
  )
}
