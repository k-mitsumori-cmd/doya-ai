'use client'
import { PageTitle } from '@/components/hr/ui-next'
import { Button, EmptyState } from '@/components/ds'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import HrLoadError, { HrStatusError, hrErrorStatus } from '@/components/hr/HrLoadError'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import EmployeeGrid from '@/components/hr/EmployeeGrid'
import { Employee } from '@/components/hr/EmployeeCard'
import CsvImportModal from '@/components/hr/CsvImportModal'

interface Department {
  id: string
  name: string
}

type SortKey = 'name' | 'hireDate' | 'department'
const PAGE_SIZE = 20

export default function EmployeesPage() {
  const { request: fetch, isCurrent } = useHrOrganizationRequest()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  // 新しい見た目で、失敗の種類（ログイン・権限・上限）を分けるためのステータス
  const [errorStatus, setErrorStatus] = useState<number | undefined>(undefined)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [showImport, setShowImport] = useState(false)
  const [canManageEmployees, setCanManageEmployees] = useState(false)
  const [hasLinkedEmployee, setHasLinkedEmployee] = useState<boolean | null>(null)
  const requestVersion = useRef(0)
  const exportingRef = useRef(false)
  const exportMounted = useRef(true)
  const exportAbort = useRef<AbortController | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<number | null>(null)
  useEffect(() => {
    exportMounted.current = true
    exportingRef.current = false
    setExporting(false)
    setExportError(null)
    return () => { exportMounted.current = false; exportAbort.current?.abort() }
  }, [isCurrent])

  const handleExport = async () => {
    if (exportingRef.current || !canManageEmployees || !isCurrent()) return
    exportingRef.current = true
    setExporting(true)
    setExportError(null)
    const controller = new AbortController()
    exportAbort.current = controller
    const current = () => exportMounted.current && !controller.signal.aborted && isCurrent()
    try {
      const response = await fetch('/api/hr/employees/export', { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new HrStatusError(response.status)
      if (!response.headers.get('content-type')?.startsWith('text/csv')) throw new Error('Invalid CSV response')
      const blob = await response.blob()
      if (!current()) return
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      try {
        anchor.href = url
        anchor.download = 'doya-hr-employees.csv'
        document.body.appendChild(anchor)
        anchor.click()
      } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
    } catch (error) {
      if (current()) setExportError(hrErrorStatus(error) || 500)
    } finally {
      if (exportAbort.current === controller) {
        exportingRef.current = false
        if (current()) setExporting(false)
        exportAbort.current = null
      }
    }
  }

  const fetchData = useCallback(async () => {
    const version = ++requestVersion.current
    setLoading(true)
    setLoadError(false)
    setEmployees([])
    setTotal(0)
    setTotalPages(0)
    try {
      const readJson = async (url: string) => {
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) throw new HrStatusError(response.status)
        return response.json()
      }
      const [employeeData, deptData, usage] = await Promise.all([
        readJson(`/api/hr/employees?page=${page}&pageSize=${PAGE_SIZE}&sort=${sortKey}`),
        readJson('/api/hr/departments'),
        readJson('/api/hr/usage'),
      ])
      if (employeeData?.success !== true || !Array.isArray(employeeData.items) ||
        !Number.isSafeInteger(employeeData.total) || employeeData.total < 0 ||
        employeeData.page !== page || employeeData.pageSize !== PAGE_SIZE ||
        employeeData.totalPages !== Math.ceil(employeeData.total / PAGE_SIZE) ||
        employeeData.items.length !== Math.max(0, Math.min(PAGE_SIZE, employeeData.total - (page - 1) * PAGE_SIZE)) ||
        deptData?.success !== true || !Array.isArray(deptData.flat) ||
        typeof usage?.canManageEmployees !== 'boolean' || typeof usage?.hasLinkedEmployee !== 'boolean') {
        throw new Error('Invalid HR data response')
      }
      if (version !== requestVersion.current) return
      if (page > Math.max(1, employeeData.totalPages)) {
        setPage(Math.max(1, employeeData.totalPages))
        return
      }
      setEmployees(employeeData.items)
      setTotal(employeeData.total)
      setTotalPages(employeeData.totalPages)
      setDepartments(deptData.flat)
      setCanManageEmployees(usage.canManageEmployees)
      setHasLinkedEmployee(usage.hasLinkedEmployee)
    } catch (error) {
      if (version === requestVersion.current) { setLoadError(true); setErrorStatus(hrErrorStatus(error)) }
    } finally {
      if (version === requestVersion.current) setLoading(false)
    }
  }, [fetch, page, sortKey])

  useEffect(() => {
    void fetchData()
    return () => { requestVersion.current += 1 }
  }, [fetchData, reloadKey])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header（新しい見た目では、375px でボタンを下に回す） */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <PageTitle className="text-3xl font-black text-slate-900">
            <span className="whitespace-nowrap">従業員一覧</span>
            {!loading && !loadError && (
              <span className="ml-3 inline-block whitespace-nowrap text-lg font-bold text-slate-500">全 {total} 名</span>
            )}
          </PageTitle>
          <p className="text-sm text-slate-500 mt-1">{canManageEmployees ? '組織のメンバーを管理' : 'あなたの従業員情報を確認'}</p>
        </div>
        {canManageEmployees ? (
          // 新しい見た目: 主ボタンは「従業員を追加」1つ。CSV は脇役の見た目にする（375px では折り返す）
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" icon="Download" onClick={() => void handleExport()} disabled={exporting || loading || loadError}>{exporting ? 'CSVを書き出し中…' : 'CSVを書き出す'}</Button>
            <Button variant="secondary" icon="FileText" onClick={() => setShowImport(true)}>CSV一括登録</Button>
            <Button href="/hr/employees/new" icon="UserPlus">従業員を追加</Button>
          </div>
        ) : canManageEmployees && <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-full text-base font-bold shadow-sm hover:shadow-md hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            <span className="material-symbols-outlined text-lg">upload_file</span>
            CSV一括登録
          </button>
          <Link
            href="/hr/employees/new"
            className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-full text-base font-bold shadow-md hover:shadow-lg hover:bg-blue-700 transition-all"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            従業員を追加
          </Link>
        </div>}
      </div>

      {canManageEmployees && <p className="text-sm text-slate-600 mb-4">CSVは現在の組織の全従業員が対象です（最大1万名）。</p>}

      {exportError !== null && (
        <div className="mb-6" role="alert">
          {exportError === 413
            ? <p className="text-sm text-slate-700">一度に書き出せる従業員は1万名までです。</p>
            : <HrLoadError subject="従業員のCSV" status={exportError} onRetry={() => void handleExport()} />}
        </div>
      )}

      {loadError && (
        <HrLoadError className="mb-6" subject="従業員の一覧" status={errorStatus} onRetry={() => setReloadKey(key => key + 1)} />
      )}

      {/* Sort Controls */}
      {!loading && !loadError && total > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4" role="group" aria-label="並び替え">
          <span className="text-sm font-bold text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">sort</span>
            並び替え:
          </span>
          {[
            { key: 'name' as SortKey, label: '名前順' },
            { key: 'hireDate' as SortKey, label: '入社日順' },
            { key: 'department' as SortKey, label: '部署別' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              aria-pressed={sortKey === opt.key}
              onClick={() => { setSortKey(opt.key); setPage(1) }}
              className={`min-h-11 whitespace-nowrap px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue,#0066ff)] py-1.5 rounded-full text-sm font-bold transition-all ${sortKey === opt.key
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="bg-white rounded-3xl shadow-md p-6 animate-pulse">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-slate-100 mb-4" />
                <div className="w-24 h-4 bg-slate-100 rounded mb-2" />
                <div className="w-16 h-3 bg-slate-100 rounded mb-2" />
                <div className="w-12 h-5 bg-slate-100 rounded-full mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? null : employees.length === 0 ? (
        <EmptyState
          art="/hr/empty-members.webp"
          title={canManageEmployees ? 'まだ従業員が登録されていません' : '従業員情報を表示できません'}
          description={canManageEmployees
            ? '従業員を登録すると、組織図・評価・1on1 で使えるようになります。CSV で一括登録もできます。'
            : hasLinkedEmployee === false
              ? 'アカウントに従業員情報が紐付いていません。組織の管理者に確認してください。'
              : '従業員情報が見つかりません。組織の管理者に確認してください。'}
          // 次にやることは1つだけ（CSV の一括登録は見出しの横のボタンから）
          action={canManageEmployees
            ? <Button href="/hr/employees/new" icon="UserPlus">最初の従業員を追加する</Button>
            : <Button href="/hr/dashboard" variant="secondary" icon="LayoutDashboard">ダッシュボードに戻る</Button>}
        />
      ) : loadError ? null : employees.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-md p-12 text-center"
        >
          <motion.img
            src="/hr/characters/hello_%E6%8C%A8%E6%8B%B6.png"
            alt="白くまキャラクター"
            className="w-40 mx-auto mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
          />
          <h3 className="text-xl font-black text-slate-900 mb-2">
            {canManageEmployees ? 'チームのメンバーを登録しましょう！' : '従業員情報を表示できません'}
          </h3>
          <p className="text-base text-slate-500 mb-6 max-w-md mx-auto">
            {canManageEmployees
              ? '従業員を追加して、タレントマネジメントを始めましょう。'
              : hasLinkedEmployee === false
                ? 'アカウントに従業員情報が紐付いていません。組織の管理者に確認してください。'
                : '従業員情報が見つかりません。組織の管理者に確認してください。'}
          </p>
          {canManageEmployees ? <div className="flex flex-col items-center gap-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/hr/employees/new"
                className="flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl text-lg font-black hover:shadow-xl hover:shadow-sky-500/30 transition-all shadow-lg shadow-sky-500/20"
              >
                <span className="material-symbols-outlined text-2xl">person_add</span>
                最初の従業員を追加する
              </Link>
            </motion.div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-all"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              CSVで一括登録
            </button>
          </div> : null}
        </motion.div>
      ) : (
        <EmployeeGrid employees={employees} departments={departments} />
      )}

      {!loading && !loadError && totalPages > 1 && (
        <nav aria-label="従業員一覧のページ切り替え" className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-bold text-slate-600">
          <button type="button" disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-full border border-slate-200 px-4 py-2 disabled:opacity-40 min-h-11 whitespace-nowrap">前のページ</button>
          <span className="text-center">{page} / {totalPages} ページ（{(page - 1) * PAGE_SIZE + 1}〜{Math.min(page * PAGE_SIZE, total)}名を表示）</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(current => current + 1)} className="rounded-full border border-slate-200 px-4 py-2 disabled:opacity-40 min-h-11 whitespace-nowrap">次のページ</button>
        </nav>
      )}

      <CsvImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => {
          if (page === 1) setReloadKey(key => key + 1)
          else setPage(1)
        }}
      />
    </div>
  )
}
