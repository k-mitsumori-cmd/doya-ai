'use client'

import toast from 'react-hot-toast'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import OrgChartView from '@/components/hr/OrgChartView'

/** APIレスポンスの orgChart 配列を OrgChartView が期待する形式に変換 */
function mapOrgChartNodes(nodes: any[]): any[] {
  return nodes.map((node: any) => {
    // API形式: { department: {id, name, managerId, ...}, employees: [...], children: [...] }
    if (node.department) {
      const managerId = node.department.managerId
      const employees = node.employees || []
      const head = managerId
        ? employees.find((e: any) => e.id === managerId) || null
        : null
      const members = employees.filter((e: any) => e.id !== managerId)
      return {
        id: node.department.id,
        name: node.department.name,
        headId: managerId || null,
        head,
        members,
        children: mapOrgChartNodes(node.children || []),
      }
    }
    // 既にフラット形式の場合はそのまま返す
    return {
      ...node,
      children: mapOrgChartNodes(node.children || []),
    }
  })
}

export default function OrgChartPage() {
  const [departments, setDepartments] = useState<any[]>([])
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchOrgChart() {
      try {
        const res = await fetch('/api/hr/org-chart')
        if (!res.ok) throw new Error('組織図データの取得に失敗しました')
        const data = await res.json()
        const rawDepts = data.orgChart ?? data.departments ?? []
        setDepartments(mapOrgChartNodes(rawDepts))
        setOrgName(data.orgName ?? '')
      } catch (e: any) {
        toast.error(e.message)
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
