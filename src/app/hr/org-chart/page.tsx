'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
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
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">組織図</h1>
          <p className="text-sm text-slate-500 mt-1">部署と従業員の構成を視覚的に確認</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <span className="material-symbols-outlined text-lg align-middle mr-1">error</span>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-sky-200 border-t-sky-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">組織図を読み込み中...</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 min-h-[400px]">
            <OrgChartView departments={departments} orgName={orgName} />
          </div>
        )}
      </motion.div>
    </div>
  )
}
