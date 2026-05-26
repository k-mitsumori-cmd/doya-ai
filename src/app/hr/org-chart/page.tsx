'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import OrgChartView from '@/components/hr/OrgChartView'

export default function OrgChartPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOrgChart() {
      try {
        const res = await fetch('/api/hr/org-chart')
        if (!res.ok) throw new Error('組織図データの取得に失敗しました')
        const data = await res.json()
        setDepartments(data.departments ?? [])
        setOrgName(data.orgName ?? '')
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchOrgChart()
  }, [])

  return (
    <div className="p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-slate-900">組織図</h1>
          <p className="text-sm text-slate-500 mt-1">部署構成と所属メンバーをビジュアルで確認</p>
        </div>

        {/* Help Banner */}
        <div className="mb-6 bg-blue-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-600">touch_app</span>
          </div>
          <div>
            <p className="text-sm font-bold text-blue-800">ドラッグで組織図を確認できます</p>
            <p className="text-xs text-blue-600 mt-0.5">各カードをクリックすると詳細を表示します。部署の追加は設定画面から行えます。</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-2xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">組織図を読み込み中...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md p-6 min-h-[400px]">
            <OrgChartView departments={departments} orgName={orgName} />
          </div>
        )}
      </motion.div>
    </div>
  )
}
