'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface EmployeeDetail {
  id: string
  firstName: string
  lastName: string
  firstNameKana?: string | null
  lastNameKana?: string | null
  employeeNumber?: string | null
  email?: string | null
  phone?: string | null
  photoUrl?: string | null
  department?: { id: string; name: string } | null
  position?: string | null
  grade?: string | null
  employmentType?: string | null
  status: string
  hireDate?: string | null
  createdAt?: string
}

interface EvaluationRecord {
  id: string
  periodName: string
  overallScore: number
  status: string
  createdAt: string
}

interface OneOnOneRecord {
  id: string
  date: string
  duration: number
  status: string
}

interface TransferRecord {
  id: string
  fromDepartment: string
  toDepartment: string
  fromPosition: string
  toPosition: string
  effectiveDate: string
}

const TABS = [
  { key: 'profile', label: 'プロフィール', icon: 'person' },
  { key: 'evaluations', label: '評価履歴', icon: 'assessment' },
  { key: 'one-on-one', label: '1on1履歴', icon: 'forum' },
  { key: 'transfers', label: '異動履歴', icon: 'swap_horiz' },
]

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '在籍', color: 'bg-emerald-100 text-emerald-700' },
  ON_LEAVE: { label: '休職中', color: 'bg-amber-100 text-amber-700' },
  RESIGNED: { label: '退職', color: 'bg-slate-100 text-slate-500' },
}

const EMPLOYMENT_TYPE_MAP: Record<string, string> = {
  FULL_TIME: '正社員',
  PART_TIME: 'パート・アルバイト',
  CONTRACT: '契約社員',
  INTERN: 'インターン',
  OTHER: 'その他',
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [oneOnOnes, setOneOnOnes] = useState<OneOnOneRecord[]>([])
  const [transfers, setTransfers] = useState<TransferRecord[]>([])
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function fetchEmployee() {
      try {
        const res = await fetch(`/api/hr/employees/${id}`)
        if (!res.ok) throw new Error('従業員データの取得に失敗しました')
        const data = await res.json()
        setEmployee(data.employee ?? data)
        setEvaluations(data.evaluations ?? [])
        setOneOnOnes(data.oneOnOnes ?? [])
        setTransfers(data.transfers ?? [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchEmployee()
  }, [id])

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-slate-200" />
            <div className="space-y-3">
              <div className="w-40 h-6 bg-slate-200 rounded" />
              <div className="w-24 h-4 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="text-center py-20 text-slate-500">
          <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
          <p className="text-lg font-medium">{error || '従業員が見つかりません'}</p>
          <button onClick={() => router.back()} className="mt-4 text-sm font-semibold text-sky-600 hover:text-sky-700">
            戻る
          </button>
        </div>
      </div>
    )
  }

  const status = STATUS_MAP[employee.status] ?? STATUS_MAP.ACTIVE
  const initials = `${employee.lastName?.[0] || ''}${employee.firstName?.[0] || ''}`

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          従業員一覧に戻る
        </button>

        {/* Employee Header */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 relative">
          <img
            src="/hr/characters/focus_集中.png"
            alt="白くまキャラクター"
            className="w-14 absolute top-4 right-4 opacity-80"
          />
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {employee.photoUrl ? (
              <img
                src={employee.photoUrl}
                alt={`${employee.lastName} ${employee.firstName}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-sky-100"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-3xl font-bold border-4 border-sky-100">
                {initials}
              </div>
            )}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-3xl font-black text-slate-900">
                {employee.lastName} {employee.firstName}
              </h1>
              {(employee.lastNameKana || employee.firstNameKana) && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {employee.lastNameKana} {employee.firstNameKana}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${status.color}`}>
                  {status.label}
                </span>
                {employee.department && (
                  <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-sky-50 text-sky-600">
                    {employee.department.name}
                  </span>
                )}
                {employee.position && (
                  <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-slate-100 text-slate-600">
                    {employee.position}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl border border-slate-200 p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-base font-bold transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-sky-50 text-sky-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">基本情報</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: '社員番号', value: employee.employeeNumber },
                { label: 'メールアドレス', value: employee.email },
                { label: '電話番号', value: employee.phone },
                { label: '部署', value: employee.department?.name },
                { label: '役職', value: employee.position },
                { label: '等級', value: employee.grade },
                { label: '雇用形態', value: employee.employmentType ? EMPLOYMENT_TYPE_MAP[employee.employmentType] || employee.employmentType : null },
                { label: '入社日', value: employee.hireDate ? new Date(employee.hireDate).toLocaleDateString('ja-JP') : null },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-sm font-bold text-slate-600 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-base font-bold text-slate-900">{item.value || '-'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'evaluations' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">評価履歴</h2>
            {evaluations.length > 0 ? (
              <div className="space-y-3">
                {evaluations.map((ev) => (
                  <Link
                    key={ev.id}
                    href={`/hr/evaluations/${ev.id}`}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{ev.periodName}</p>
                      <p className="text-xs text-slate-500">{new Date(ev.createdAt).toLocaleDateString('ja-JP')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`material-symbols-outlined text-base ${star <= ev.overallScore ? 'text-amber-400' : 'text-slate-200'}`}
                            style={{ fontVariationSettings: star <= ev.overallScore ? "'FILL' 1" : "'FILL' 0" }}
                          >
                            star
                          </span>
                        ))}
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                        ev.status === 'FINALIZED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ev.status === 'FINALIZED' ? '確定' : '進行中'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <motion.img
                  src="/hr/characters/thinking_考え中.png"
                  alt="白くまキャラクター"
                  className="w-24 mx-auto mb-3"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                />
                <p className="text-lg font-bold">まだ評価がありません</p>
                <p className="text-sm mt-1">評価期間を作成して評価を始めましょう</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'one-on-one' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">1on1履歴</h2>
            {oneOnOnes.length > 0 ? (
              <div className="space-y-3">
                {oneOnOnes.map((oo) => (
                  <Link
                    key={oo.id}
                    href={`/hr/one-on-one/${oo.id}`}
                    className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {new Date(oo.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-slate-500">{oo.duration}分</p>
                    </div>
                    <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                      oo.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {oo.status === 'COMPLETED' ? '完了' : '予定'}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <motion.img
                  src="/hr/characters/ramen_休憩.png"
                  alt="白くまキャラクター"
                  className="w-24 mx-auto mb-3"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                />
                <p className="text-lg font-bold">まだ1on1の記録がありません</p>
                <p className="text-sm mt-1">1on1を実施して記録を残しましょう</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'transfers' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">異動履歴</h2>
            {transfers.length > 0 ? (
              <div className="space-y-3">
                {transfers.map((tr) => (
                  <div key={tr.id} className="p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-2">
                      {new Date(tr.effectiveDate).toLocaleDateString('ja-JP')}
                    </p>
                    <div className="flex items-center gap-3 text-sm">
                      <div>
                        <p className="font-semibold text-slate-600">{tr.fromDepartment}</p>
                        <p className="text-xs text-slate-400">{tr.fromPosition}</p>
                      </div>
                      <span className="material-symbols-outlined text-sky-500">arrow_forward</span>
                      <div>
                        <p className="font-semibold text-slate-900">{tr.toDepartment}</p>
                        <p className="text-xs text-slate-400">{tr.toPosition}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <span className="material-symbols-outlined text-3xl mb-2 block">swap_horiz</span>
                <p className="text-lg font-bold">異動履歴がありません</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
