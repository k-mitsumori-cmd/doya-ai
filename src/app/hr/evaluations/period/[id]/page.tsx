'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

interface Period {
  id: string
  name: string
  startDate: string
  endDate: string
  status: string
}

interface EvaluationRow {
  id: string
  employeeId: string
  status: string
}

interface Employee {
  id: string
  firstName?: string
  lastName?: string
  department?: { name?: string } | null
}

const PERIOD_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '準備中', color: 'bg-slate-100 text-slate-600' },
  OPEN: { label: '進行中', color: 'bg-emerald-100 text-emerald-700' },
  IN_REVIEW: { label: 'レビュー中', color: 'bg-amber-100 text-amber-700' },
  CLOSED: { label: '完了', color: 'bg-blue-100 text-blue-700' },
}

const EVAL_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '未着手', color: 'bg-slate-100 text-slate-500' },
  SELF: { label: '自己評価中', color: 'bg-amber-100 text-amber-700' },
  IN_REVIEW: { label: '上司評価中', color: 'bg-indigo-100 text-indigo-700' },
  SUBMITTED: { label: '提出済み', color: 'bg-sky-100 text-sky-700' },
  FINALIZED: { label: '確定', color: 'bg-emerald-100 text-emerald-700' },
}

function fmtDate(s?: string) {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return s
  }
}

export default function EvaluationPeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [period, setPeriod] = useState<Period | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationRow[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [creatingFor, setCreatingFor] = useState<string | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const load = useCallback(async () => {
    try {
      const [periodRes, evalRes, empRes] = await Promise.all([
        fetch(`/api/hr/evaluations/periods/${id}`),
        fetch(`/api/hr/evaluations?periodId=${id}`),
        fetch('/api/hr/employees'),
      ])
      if (!periodRes.ok) {
        setNotFound(true)
        return
      }
      const periodData = await periodRes.json()
      setPeriod(periodData.period)
      if (evalRes.ok) {
        const ev = await evalRes.json()
        setEvaluations(ev.items ?? ev.evaluations ?? [])
      }
      if (empRes.ok) {
        const emp = await empRes.json()
        setEmployees(emp.items ?? emp.employees ?? [])
      }
    } catch (e: any) {
      toast.error('評価期間の取得に失敗しました')
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) load()
  }, [id, load])

  const evalByEmployee = new Map(evaluations.map((e) => [e.employeeId, e]))

  const handleCreate = async (employeeId: string) => {
    setCreatingFor(employeeId)
    try {
      const res = await fetch('/api/hr/evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodId: id, employeeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.evaluation?.id) {
        toast.error(data.error || '評価の作成に失敗しました')
        return
      }
      toast.success('評価を作成しました')
      router.push(`/hr/evaluations/${data.evaluation.id}`)
    } catch {
      toast.error('評価の作成に失敗しました')
    } finally {
      setCreatingFor(null)
    }
  }

  const handleStatus = async (status: string) => {
    setUpdatingStatus(true)
    try {
      const res = await fetch(`/api/hr/evaluations/periods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'ステータスの更新に失敗しました')
        return
      }
      toast.success(status === 'OPEN' ? '評価期間を開始しました' : '評価期間を締めました')
      setPeriod((p) => (p ? { ...p, status } : p))
    } catch {
      toast.error('ステータスの更新に失敗しました')
    } finally {
      setUpdatingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/3" />
          <div className="h-64 bg-slate-100 rounded-3xl" />
        </div>
      </div>
    )
  }

  if (notFound || !period) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-md p-12 text-center text-slate-500">
          <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
          <p className="text-lg font-medium">評価期間が見つかりません</p>
          <Link href="/hr/evaluations" className="mt-4 inline-block text-blue-600 font-bold">
            評価一覧に戻る
          </Link>
        </div>
      </div>
    )
  }

  const periodBadge = PERIOD_STATUS[period.status] ?? PERIOD_STATUS.DRAFT

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/hr/evaluations"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-700 mb-4"
      >
        <span className="material-symbols-outlined text-lg">arrow_back</span>
        評価一覧
      </Link>

      {/* Header */}
      <div className="bg-white rounded-3xl shadow-md p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{period.name}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${periodBadge.color}`}>
                {periodBadge.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {fmtDate(period.startDate)} 〜 {fmtDate(period.endDate)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {period.status === 'DRAFT' && (
              <button
                onClick={() => handleStatus('OPEN')}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-bold shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">play_arrow</span>
                評価を開始する
              </button>
            )}
            {(period.status === 'OPEN' || period.status === 'IN_REVIEW') && (
              <button
                onClick={() => handleStatus('CLOSED')}
                disabled={updatingStatus}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">flag</span>
                評価を締める
              </button>
            )}
          </div>
        </div>
        {period.status === 'DRAFT' && (
          <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
            「準備中」の評価期間はダッシュボードの「進行中の評価」に集計されません。各メンバーの評価を作成し、「評価を開始する」を押すと進行中になります。
          </p>
        )}
      </div>

      {/* Employee list */}
      <div className="bg-white rounded-3xl shadow-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600">groups</span>
          メンバーの評価
          <span className="text-sm font-bold text-slate-400">
            {evaluations.length} / {employees.length} 名作成済み
          </span>
        </h2>

        {employees.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm font-bold">先に従業員を登録してください</p>
            <Link href="/hr/employees/new" className="mt-2 inline-block text-blue-600 font-bold text-sm">
              従業員を追加する
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {employees.map((emp) => {
              const ev = evalByEmployee.get(emp.id)
              const name = `${emp.lastName ?? ''} ${emp.firstName ?? ''}`.trim() || '名称未設定'
              const evalBadge = ev ? EVAL_STATUS[ev.status] ?? EVAL_STATUS.DRAFT : null
              return (
                <motion.div
                  key={emp.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-base font-bold text-slate-900 truncate">{name}</p>
                    {emp.department?.name && (
                      <p className="text-xs text-slate-400">{emp.department.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {evalBadge && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${evalBadge.color}`}>
                        {evalBadge.label}
                      </span>
                    )}
                    {ev ? (
                      <Link
                        href={`/hr/evaluations/${ev.id}`}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-bold hover:bg-blue-700 transition-all"
                      >
                        <span className="material-symbols-outlined text-base">edit_note</span>
                        評価を開く
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleCreate(emp.id)}
                        disabled={creatingFor === emp.id}
                        className="flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-full text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-base">add</span>
                        {creatingFor === emp.id ? '作成中...' : '評価を作成'}
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
