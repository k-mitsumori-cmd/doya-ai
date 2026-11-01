'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readHrOrgChart, HrOrgChartReadError, type HrOrgChartData } from '@/lib/hr/org-chart-paged-client'
import { motion } from 'framer-motion'
import OrgChartView from '@/components/hr/OrgChartView'

/** APIレスポンスの orgChart 配列を OrgChartView が期待する形式に変換 */
function mapOrgChartNodes(nodes: any[]): any[] {
  const result: any[] = []
  const pending = nodes.slice().reverse().map(node => ({ node, target: result }))
  while (pending.length) {
    const { node, target } = pending.pop()!
    const managerId = node.department.managerId
    const head = managerId ? node.employees.find((employee: any) => employee.id === managerId) || null : null
    const mapped = { id: node.department.id, name: node.department.name, headId: managerId || null, head,
      members: node.employees.filter((employee: any) => employee.id !== managerId), children: [] as any[] }
    target.push(mapped)
    for (let i = node.children.length - 1; i >= 0; i--) pending.push({ node: node.children[i], target: mapped.children })
  }
  return result
}

export default function OrgChartPage() {
  const { data: session, status } = useSession()
  const actor = status === 'unauthenticated' ? '' : session?.user?.id || ''
  const allowed = status === 'authenticated' && Boolean(actor)
  const epoch = useRef({ actor, version: 0 })
  if (epoch.current.actor !== actor) epoch.current = { actor, version: epoch.current.version + 1 }
  const scopeKey = JSON.stringify([actor, epoch.current.version])
  const currentScope = useRef({ key: scopeKey, allowed })
  currentScope.current = { key: scopeKey, allowed }
  const [view, setView] = useState<{ scope: string; data: HrOrgChartData | null; error: boolean; unauthorized: boolean; changed?: boolean; loading: boolean }>({ scope: '', data: null, error: false, unauthorized: false, loading: true })
  const [progress, setProgress] = useState<{ scope: string; loaded: number; total: number } | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && currentScope.current.allowed && currentScope.current.key === scopeKey
    setView({ scope: scopeKey, data: null, error: false, unauthorized: false, loading: true })
    setProgress({ scope: scopeKey, loaded: 0, total: 0 })
    void readHrOrgChart(controller.signal, (loaded, total) => { if (current()) setProgress({ scope: scopeKey, loaded, total }) }).then(data => {
      if (current()) setView({ scope: scopeKey, data, error: false, unauthorized: false, loading: false })
    }).catch(error => {
      if (current()) setView({ scope: scopeKey, data: null, error: true, unauthorized: error instanceof HrOrgChartReadError && error.unauthorized, changed: error instanceof HrOrgChartReadError && error.changed, loading: false })
    })
    return () => controller.abort()
  }, [allowed, scopeKey, retryKey])

  const knownScope = view.scope === scopeKey
  const loading = !knownScope || view.loading
  const loadError = knownScope && view.error
  const chart = knownScope ? view.data : null
  const departments = chart ? mapOrgChartNodes(chart.orgChart) : []
  const retry = () => {
    if (currentScope.current.allowed && currentScope.current.key === scopeKey) setRetryKey(value => value + 1)
  }

  if (!allowed) return <div role="status" className="p-6 text-center">{status === 'loading' ? '認証情報を確認しています。' : <a href="/auth/signin?callbackUrl=/hr/org-chart" className="underline">ログインして組織図を確認する</a>}</div>

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
            <p className="text-sm font-bold text-blue-800">横にスクロールして組織図を確認できます</p>
            <p className="text-xs text-blue-600 mt-0.5">部署カードをクリックすると所属メンバーと下位部署を開閉できます。部署の追加は設定画面から行えます。</p>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">組織図を読み込み中...</p>
              {progress?.scope === scopeKey && progress.total > 0 && <p role="status" className="mt-2 text-sm text-slate-500">部署・従業員 {progress.loaded.toLocaleString()} / {progress.total.toLocaleString()} 件を取得しています。</p>}
            </div>
          </div>
        ) : loadError ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <p className="font-bold text-rose-800">組織図データの取得に失敗しました。</p>
            <p className="mt-2 text-sm text-slate-700">{view.changed ? '取得中に組織図が更新されました。異なる時点の情報を混在させないため、再取得してください。' : '部署や従業員が存在しないという意味ではありません。時間をおいて再取得してください。'}</p>
            <div className="mt-4">{view.unauthorized ? <a href="/auth/signin?callbackUrl=/hr/org-chart" className="font-bold text-sky-700 underline">ログイン状態を確認して再ログインする</a> : <button type="button" onClick={retry} className="rounded-xl bg-sky-600 px-5 py-3 font-bold text-white">再取得する</button>}</div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-md p-6 min-h-[400px]">
            {chart?.hierarchyWarning && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">部署の親子関係に循環があるため、一部の部署を最上位に表示しています。管理者に親部署の確認をご依頼ください。</p>}
            <OrgChartView departments={departments} orgName={chart?.orgName} unassignedEmployees={chart?.unassignedEmployees || []} />
          </div>
        )}
      </motion.div>
    </div>
  )
}
