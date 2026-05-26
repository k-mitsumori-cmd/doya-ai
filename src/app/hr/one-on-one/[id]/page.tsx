'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import OneOnOneForm from '@/components/hr/OneOnOneForm'

interface OneOnOneData {
  id: string
  employeeId: string
  employeeName: string
  date: string
  duration: number
  agenda: any[]
  managerNote: string
  sharedNote: string
  actionItems: any[]
  status: string
}

export default function OneOnOneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [record, setRecord] = useState<OneOnOneData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    async function fetchRecord() {
      try {
        const res = await fetch(`/api/hr/one-on-one/${id}`)
        if (!res.ok) throw new Error('1on1データの取得に失敗しました')
        const data = await res.json()
        setRecord(data.record ?? data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRecord()
  }, [id])

  const handleSave = async (payload: any) => {
    const res = await fetch(`/api/hr/one-on-one/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error('保存に失敗しました')
    const data = await res.json()
    setRecord(data.record ?? data)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 bg-slate-200 rounded" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="h-48 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !record) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto">
        <div className="text-center py-20 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3 block">error</span>
          <p className="text-lg font-medium">{error || '1on1データが見つかりません'}</p>
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

        <h1 className="text-2xl font-black text-slate-900 mb-6">1on1詳細</h1>

        <OneOnOneForm
          recordId={record.id}
          employeeId={record.employeeId}
          employeeName={record.employeeName}
          initialDate={record.date ? record.date.slice(0, 16) : undefined}
          initialDuration={record.duration}
          initialAgenda={record.agenda}
          initialManagerNote={record.managerNote}
          initialSharedNote={record.sharedNote}
          initialActionItems={record.actionItems}
          readOnly={record.status === 'COMPLETED'}
          onSave={handleSave}
        />
      </motion.div>
    </div>
  )
}
