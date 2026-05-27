'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import EvaluationForm from '@/components/hr/EvaluationForm'

interface EvaluationData {
  id: string
  employeeId: string
  employeeName: string
  periodName: string
  goals: any[]
  selfComment: string
  managerComment: string
  overallScore: number
  status: 'DRAFT' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'FINALIZED'
  isManager: boolean
}

export default function EvaluationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function fetchEvaluation() {
      try {
        const res = await fetch(`/api/hr/evaluations/${id}`)
        if (!res.ok) throw new Error('評価データの取得に失敗しました')
        const data = await res.json()
        setEvaluation(data.evaluation ?? data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEvaluation()
  }, [id])

  const handleSave = async (payload: any) => {
    const res = await fetch(`/api/hr/evaluations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('保存に失敗しました')
    // Refresh data
    const data = await res.json()
    setEvaluation(data.evaluation ?? data)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded" />
          <div className="h-40 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !evaluation) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
          <p className="text-lg font-medium">{error || '評価データが見つかりません'}</p>
          <button onClick={() => router.back()} className="mt-4 text-sm font-semibold text-sky-600 hover:text-sky-700">
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          戻る
        </button>

        <h1 className="text-3xl font-black text-slate-900 mb-6">評価詳細</h1>

        <EvaluationForm
          evaluationId={evaluation.id}
          employeeId={evaluation.employeeId}
          employeeName={evaluation.employeeName}
          periodName={evaluation.periodName}
          initialGoals={evaluation.goals}
          initialSelfComment={evaluation.selfComment}
          initialManagerComment={evaluation.managerComment}
          initialOverallScore={evaluation.overallScore}
          status={evaluation.status}
          isManager={evaluation.isManager}
          onSave={handleSave}
        />
      </motion.div>
    </div>
  )
}
