'use client'

import { useState } from 'react'
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
  status?: 'DRAFT' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'FINALIZED'
  isManager?: boolean
  onSave?: (data: any) => void
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
  status = 'DRAFT',
  isManager = false,
  onSave,
}: EvaluationFormProps) {
  const [goals, setGoals] = useState<Goal[]>(
    initialGoals.length > 0
      ? initialGoals
      : [{ id: crypto.randomUUID(), title: '', description: '', weight: 100, result: '', score: 0 }]
  )
  const [selfComment, setSelfComment] = useState(initialSelfComment)
  const [managerComment, setManagerComment] = useState(initialManagerComment)
  const [overallScore, setOverallScore] = useState(initialOverallScore)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReadOnly = status === 'FINALIZED'

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
    setAiLoading(true)
    setAiResult(null)
    try {
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
      if (!res.ok) throw new Error('AI生成に失敗しました')
      const data = await res.json()
      setAiResult(data.comment || data.result || '')
    } catch (e: any) {
      setAiResult(`エラー: ${e.message}`)
    } finally {
      setAiLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        evaluationId,
        employeeId,
        goals,
        selfComment,
        managerComment,
        overallScore,
      }
      if (onSave) {
        await onSave(payload)
      } else {
        const url = evaluationId ? `/api/hr/evaluations/${evaluationId}` : '/api/hr/evaluations'
        const method = evaluationId ? 'PUT' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('保存に失敗しました')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
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
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                status === 'DRAFT' ? 'bg-slate-100 text-slate-600' :
                status === 'SELF_REVIEW' ? 'bg-amber-100 text-amber-700' :
                status === 'MANAGER_REVIEW' ? 'bg-blue-100 text-blue-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {status === 'DRAFT' ? '下書き' :
                 status === 'SELF_REVIEW' ? '自己評価中' :
                 status === 'MANAGER_REVIEW' ? '上司評価中' :
                 '確定済み'}
              </span>
            </div>
          </div>
        </div>
      )}

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
                      disabled={isReadOnly}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-base font-medium focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500"
                      placeholder="目標タイトルを入力"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">説明</label>
                    <textarea
                      value={goal.description}
                      onChange={(e) => updateGoal(goal.id, 'description', e.target.value)}
                      disabled={isReadOnly}
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
                      disabled={isReadOnly}
                      className="w-full px-3 py-3 bg-white border border-slate-300 rounded-lg text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-400 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">スコア (1-5)</label>
                    <StarInput
                      value={goal.score}
                      onChange={(v) => updateGoal(goal.id, 'score', v)}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">達成結果</label>
                    <textarea
                      value={goal.result}
                      onChange={(e) => updateGoal(goal.id, 'result', e.target.value)}
                      disabled={isReadOnly}
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
            disabled={isReadOnly}
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
              disabled={isReadOnly}
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
          総合評価
        </h3>
        <StarInput value={overallScore} onChange={setOverallScore} disabled={isReadOnly} />
      </div>

      {/* AI Comment Generation */}
      {!isReadOnly && (
        <div className="bg-white rounded-3xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-purple-500">auto_awesome</span>
              AI評価コメント生成
            </h3>
            <button
              type="button"
              onClick={handleAiComment}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full text-base font-bold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">auto_awesome</span>
              )}
              {aiLoading ? '生成中...' : 'AIコメント生成'}
            </button>
          </div>
          {(aiLoading || aiResult) && (
            <AiInsightPanel loading={aiLoading} content={aiResult || ''} />
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
          {error}
        </div>
      )}

      {/* Actions */}
      {!isReadOnly && (
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
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
