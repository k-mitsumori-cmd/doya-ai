'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'
import { EmptyState as DsEmptyState, ErrorNotice } from '@/components/ds'
import { doyalistErrorCopy } from '@/components/doyalist/errorCopy'
import { confirmDialog } from '@/components/ds/dialog'

/** 日本語の文だけを画面に出す（「Failed to fetch」などの英語は決まった文にする） */
const jaError = (e: unknown, fallback: string) => (e instanceof Error && /[ぁ-んァ-ヶ一-龠]/.test(e.message) ? e.message : fallback)
import ShellLoading from '@/components/shell/ShellLoading'
import { UiIcon, type UiIconName } from '@/components/icons'
import { appendApproachPage, parseApproachPage, type ApproachSummaryCounts } from '@/lib/doyalist/approach-pages'
import { appendProjectPage, parseProjectPage, type ProjectSummaryCounts } from '@/lib/doyalist/project-pages'
import { getApproachTypeLabel } from '@/lib/doyalist/labels'

interface ListSummary {
  id: string
  name: string
  industry: string | null
  region: string | null
  companyCount: number
  updatedAt: string
  createdAt: string
}

interface ApproachSummary {
  id: string
  type: string
  subject: string | null
  body: string
  status: string
  createdAt: string
}


const TABS: { v: 'all' | 'list' | 'form' | 'email' | 'phone'; l: string; icon: string }[] = [
  { v: 'all', l: 'すべて', icon: 'book' as UiIconName },
  { v: 'list', l: 'リスト', icon: 'list' as UiIconName },
  { v: 'form', l: 'フォーム文面', icon: 'note' as UiIconName },
  { v: 'email', l: 'メール文面', icon: 'mail' as UiIconName },
  { v: 'phone', l: 'スクリプト', icon: 'phone' as UiIconName },
]

const TYPE_LABEL: Record<string, { l: string; color: string; icon: string }> = {
  form: { l: 'フォーム', color: 'bg-emerald-100 text-emerald-700', icon: 'note' as UiIconName },
  email: { l: 'メール', color: 'bg-brand-50 text-brand-600', icon: 'mail' as UiIconName },
  phone: { l: '電話', color: 'bg-amber-100 text-amber-700', icon: 'phone' as UiIconName },
}

export default function HistoryPage() {
  // 新しい見た目（チェックリスト §5.1）では、ページの見出しは枠の h1 に任せて h2 にする（S-57）
  const Heading = 'h2'
  const [lists, setLists] = useState<ListSummary[]>([])
  const [approaches, setApproaches] = useState<ApproachSummary[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [loadingApproaches, setLoadingApproaches] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadingMoreProjects, setLoadingMoreProjects] = useState(false)
  const [projectsError, setProjectsError] = useState('')
  const [approachesError, setApproachesError] = useState('')
  // 新しい見た目で、失敗の理由（401・403・429 など）を文に置き換えるための status。0 は通信・応答の形の失敗
  const [projectsErrorStatus, setProjectsErrorStatus] = useState(0)
  const [approachesErrorStatus, setApproachesErrorStatus] = useState(0)
  const [approachSummary, setApproachSummary] = useState<ApproachSummaryCounts | null>(null)
  const [projectSummary, setProjectSummary] = useState<ProjectSummaryCounts | null>(null)
  const [projectTotal, setProjectTotal] = useState(0)
  const [projectNextCursor, setProjectNextCursor] = useState<string | null>(null)
  const [approachTotal, setApproachTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const requestVersion = useRef(0)
  const projectRequestVersion = useRef(0)
  const [tab, setTab] = useState<typeof TABS[number]['v']>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // reportStatus: 失敗の status を知らせる先（新しい見た目の文の出し分け用）。呼ぶ側が setXxxErrorStatus を渡す
  const loadProjects = useCallback(async (reportStatus: (status: number) => void = () => {}) => {
    const version = ++projectRequestVersion.current
    setProjectsError('')
    reportStatus(0)
    setLoadingProjects(true)
    setLoadingMoreProjects(false)
    setLists([])
    setProjectTotal(0)
    setProjectNextCursor(null)
    setProjectSummary(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search.trim()) params.set('search', search.trim())
      const response = await fetch(`/api/doyalist/projects?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok && version === projectRequestVersion.current) reportStatus(response.status)
      if (!response.ok) throw new Error(response.status === 401 ? '履歴の確認にはログインが必要です' : 'リスト履歴を取得できませんでした')
      const page = parseProjectPage<ListSummary>(data)
      if (version !== projectRequestVersion.current) return
      setLists(page.projects)
      setProjectTotal(page.total)
      setProjectNextCursor(page.nextCursor)
      setProjectSummary(page.summary)
    } catch (error) {
      if (version === projectRequestVersion.current) setProjectsError(jaError(error, 'リスト履歴を取得できませんでした'))
    } finally {
      if (version === projectRequestVersion.current) setLoadingProjects(false)
    }
  }, [search])

  const loadApproaches = useCallback(async (reportStatus: (status: number) => void = () => {}) => {
    const version = ++requestVersion.current
    setApproachesError('')
    reportStatus(0)
    setLoadingApproaches(true)
    setLoadingMore(false)
    setApproaches([])
    setNextCursor(null)
    try {
      const params = new URLSearchParams()
      if (tab !== 'all' && tab !== 'list') params.set('type', tab)
      if (search.trim()) params.set('search', search.trim())
      const response = await fetch(`/api/doyalist/approaches?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok && version === requestVersion.current) reportStatus(response.status)
      if (!response.ok) throw new Error(data?.error || '営業文履歴を取得できませんでした')
      const page = parseApproachPage<ApproachSummary>(data)
      if (version !== requestVersion.current) return
      setApproaches(page.approaches)
      setApproachTotal(page.total)
      setNextCursor(page.nextCursor)
      setApproachSummary(page.summary)
    } catch (error) {
      if (version === requestVersion.current) setApproachesError(jaError(error, '営業文履歴を取得できませんでした'))
    } finally {
      if (version === requestVersion.current) setLoadingApproaches(false)
    }
  }, [search, tab])

  useEffect(() => {
    const timer = setTimeout(() => void loadProjects(setProjectsErrorStatus), search.trim() ? 250 : 0)
    const versionRef = projectRequestVersion
    return () => { clearTimeout(timer); versionRef.current++ }
  }, [loadProjects, search])
  useEffect(() => {
    const timer = setTimeout(() => void loadApproaches(setApproachesErrorStatus), search.trim() ? 250 : 0)
    const versionRef = requestVersion
    return () => { clearTimeout(timer); versionRef.current++ }
  }, [loadApproaches, search])

  async function loadMore(reportStatus: (status: number) => void = () => {}) {
    if (!nextCursor || loadingMore) return
    const version = requestVersion.current
    setLoadingMore(true)
    setApproachesError('')
    reportStatus(0)
    try {
      const params = new URLSearchParams({ cursor: nextCursor })
      if (tab !== 'all' && tab !== 'list') params.set('type', tab)
      if (search.trim()) params.set('search', search.trim())
      const response = await fetch(`/api/doyalist/approaches?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok && version === requestVersion.current) reportStatus(response.status)
      if (!response.ok) throw new Error(data?.error || '営業文履歴の続きを取得できませんでした')
      const page = parseApproachPage<ApproachSummary>(data)
      if (version !== requestVersion.current) return
      setApproaches(appendApproachPage(approaches, page, approachTotal))
      setNextCursor(page.nextCursor)
      setApproachSummary(page.summary)
    } catch (error) {
      if (version === requestVersion.current) setApproachesError(jaError(error, '営業文履歴の続きを取得できませんでした'))
    } finally {
      if (version === requestVersion.current) setLoadingMore(false)
    }
  }

  async function loadMoreProjects(reportStatus: (status: number) => void = () => {}) {
    if (!projectNextCursor || loadingMoreProjects) return
    const version = projectRequestVersion.current
    setLoadingMoreProjects(true)
    setProjectsError('')
    reportStatus(0)
    try {
      const params = new URLSearchParams({ limit: '50', cursor: projectNextCursor })
      if (search.trim()) params.set('search', search.trim())
      const response = await fetch(`/api/doyalist/projects?${params}`, { cache: 'no-store' })
      const data = await response.json().catch(() => null)
      if (!response.ok && version === projectRequestVersion.current) reportStatus(response.status)
      if (!response.ok) throw new Error(data?.error || 'リスト履歴の続きを取得できませんでした')
      const page = parseProjectPage<ListSummary>(data)
      if (version !== projectRequestVersion.current) return
      setLists(appendProjectPage(lists, page, projectTotal))
      setProjectNextCursor(page.nextCursor)
      setProjectSummary(page.summary)
    } catch (error) {
      if (version === projectRequestVersion.current) setProjectsError(jaError(error, 'リスト履歴の続きを取得できませんでした'))
    } finally {
      if (version === projectRequestVersion.current) setLoadingMoreProjects(false)
    }
  }

  const handleDeleteList = async (id: string, name: string) => {
    if (!(await confirmDialog({ title: `「${name}」を削除しますか？`, message: '元に戻せません。', confirmLabel: '削除する', tone: 'danger' }))) return
    try {
      const res = await fetch(`/api/doyalist/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      setLists((prev) => prev.filter((l) => l.id !== id))
      setApproachSummary(null)
      setExpandedId(null)
      void loadProjects(setProjectsErrorStatus)
      void loadApproaches(setApproachesErrorStatus)
    } catch (e: any) {
      toast.error('削除できませんでした。通信を確かめて、もう一度お試しください。')
    }
  }

  const handleDeleteApproach = async (id: string) => {
    if (!(await confirmDialog({ title: 'この営業文を削除しますか？', message: '元に戻せません。', confirmLabel: '削除する', tone: 'danger' }))) return
    try {
      const res = await fetch(`/api/doyalist/approaches?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      setApproaches((prev) => prev.filter((a) => a.id !== id))
      setApproachSummary(null)
      setExpandedId(null)
      void loadApproaches(setApproachesErrorStatus)
    } catch (e: any) {
      toast.error('削除できませんでした。通信を確かめて、もう一度お試しください。')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('コピーしました')).catch(() => toast.error('コピーできませんでした'))
  }

  const stats = useMemo(() => {
    const total = (projectSummary?.allTotal || 0) + (approachSummary?.allTotal || 0)
    const listThisMonth = projectSummary?.thisMonth || 0
    const apprThisMonth = approachSummary?.thisMonth || 0
    const totalCompanies = projectSummary?.totalCompanies || 0
    return { total, thisMonth: listThisMonth + apprThisMonth, totalCompanies }
  }, [projectSummary, approachSummary])

  const filteredLists = useMemo(() => {
    if (tab !== 'all' && tab !== 'list') return []
    return lists
  }, [lists, tab])

  const filteredApproaches = tab === 'list' ? [] : approaches

  const isEmpty = filteredLists.length === 0 && filteredApproaches.length === 0

  // 新しい見た目: 失敗の知らせ（ErrorNotice）。サーバーの文字列は出さず、status から文を選ぶ（UI 品質 S-20）
  const errorNotice = (status: number, subject: string, retry: () => void) => {
    const copy = doyalistErrorCopy(status, subject, '/doyalist/history')
    const next = copy.next
    return <ErrorNotice what={copy.what} how={copy.how} onRetry={next ? () => { window.location.href = next.href } : retry} retryLabel={next?.label ?? 'もう一度読み込む'} />
  }
  // 新しい見た目: 空のときの次の操作（タブに合わせて1つだけ）
  const emptyAction = tab === 'form' || tab === 'email' || tab === 'phone'
    ? { href: `/doyalist/tools/${tab}`, label: tab === 'form' ? 'フォーム営業文を作る' : tab === 'email' ? 'メール文面を作る' : '電話スクリプトを作る' }
    : { href: '/doyalist', label: 'リストを作る' }
  // 新しい見た目: 押せる場所の大きさ（44px）とキーボードの枠
  const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066ff] focus-visible:ring-offset-1'
  const iconBtn = `inline-flex h-11 w-11 items-center justify-center ${focusRing}`

  // 新しい見た目では古いステッカーを出さず、共通の骨組みにする
  if (loadingProjects) return <ShellLoading />

  return (
    <div className="p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 text-[#0066ff] flex items-center justify-center"><UiIcon name="book" size={24} /></div>
          <div className="min-w-0">
            <Heading className="text-xl lg:text-2xl font-black text-[#0a1530]">生成履歴</Heading>
            <p className="text-sm font-medium text-slate-500 mt-0.5 [text-wrap:balance]">これまでに作成したリスト・営業文・メール・スクリプトをまとめて管理できます</p>
          </div>
        </div>


        {!projectsError && projectSummary && approachSummary && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon="chart" label="合計件数" value={stats.total} color="cyan" />
          <StatCard icon="calendar" label="今月の生成" value={stats.thisMonth} color="emerald" />
          <StatCard icon="building" label="累計企業数" value={stats.totalCompanies} color="violet" />
        </div>}

        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 flex-wrap" role="group" aria-label="履歴の種類">
              {TABS.map((t) => {
                const count = t.v === 'all' ? (projectSummary?.allTotal || 0) + (approachSummary?.allTotal || 0)
                  : t.v === 'list' ? (projectSummary?.allTotal || 0)
                  : approachSummary?.countsByType[t.v] || 0
                return (
                  <button
                    key={t.v}
                    onClick={() => { if (t.v !== tab) { requestVersion.current++; setLoadingApproaches(true); setTab(t.v) } }}
                    aria-pressed={tab === t.v}
                    className={`min-h-11 whitespace-nowrap ${focusRing} px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${tab === t.v ? 'bg-[#0a1530] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {/* ⚠️ 今の見た目では、アイコンの名前（book・list など）がそのまま文字で出ている。新しい見た目では絵にする */}
                    <UiIcon name={t.icon as UiIconName} size={14} />
                    <span>{t.l}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.v ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>{approachSummary ? count : '—'}</span>
                  </button>
                )
              })}
            </div>
            {/* 新しい見た目: 375px で空の行ができないよう、すき間は sm 以上だけ。検索欄は幅いっぱい */}
            <div className="hidden sm:block flex-1" />
            <input
              type="search"
              value={search}
              maxLength={200}
              onChange={(e) => { requestVersion.current++; setLoadingApproaches(true); setSearch(e.target.value) }}
              placeholder="検索"
              aria-label="履歴を検索"
              className="min-h-11 w-full min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0066ff] focus:ring-2 focus:ring-blue-100 sm:w-64"
            />
          </div>

          {/* 新しい見た目: 読み込みの失敗は、表の上にまとめて出す（理由に合わせた文と、次の操作を1つ） */}
          {(projectsError || approachesError) && (
            <div className="space-y-2 px-5 pt-4">
              {projectsError && errorNotice(projectsErrorStatus, 'リスト履歴', () => void loadProjects(setProjectsErrorStatus))}
              {approachesError && tab !== 'list' && errorNotice(approachesErrorStatus, '営業文の履歴', () => void loadApproaches(setApproachesErrorStatus))}
            </div>
          )}

          {loadingApproaches && tab !== 'list' ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-slate-500">営業文履歴を読み込んでいます…</p>
          ) : isEmpty && (projectsError || (approachesError && tab !== 'list')) ? (
            // 新しい見た目: 失敗の知らせは上に出しているので、ここは空のまま（同じ知らせを二度出さない）
            <div className="pb-4" />
          ) : approachesError && tab !== 'list' && filteredLists.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-rose-700">履歴を取得できませんでした。再読み込みしてください。</p>
          ) : projectsError && filteredLists.length === 0 && filteredApproaches.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-semibold text-rose-700">リスト履歴を取得できませんでした。再読み込みしてください。</p>
          ) : isEmpty && search.trim() ? (
            // 新しい見た目: 検索で0件。絵は出さず、検索を消す操作を1つ（UI 品質 S-17）
            <DsEmptyState
              kind="no-results"
              title="検索に一致する履歴はありません"
              description="言葉を短くするか、検索を消してすべての履歴を見てください。"
              action={<button type="button" onClick={() => { requestVersion.current++; setLoadingApproaches(true); setSearch('') }} className={`inline-flex min-h-11 items-center rounded-xl border border-[#0066ff]/40 px-5 text-sm font-bold text-[#0066ff] hover:bg-blue-50 ${focusRing}`}>検索をクリア</button>}
            />
          ) : isEmpty ? (
            // 新しい見た目: ツールの空状態の画像と、次にやることを1つ（UI 品質 S-17）
            <DsEmptyState
              title={tab === 'all' || tab === 'list' ? 'まだ履歴がありません' : `まだ${TABS.find((t) => t.v === tab)?.l ?? ''}の履歴がありません`}
              description={tab === 'all' || tab === 'list' ? 'リストを作ると、ここに履歴が並びます。CSV・Excel でいつでも書き出せます。' : '文面を作ると、ここに履歴が並びます。あとからコピーして使えます。'}
              art="/doyalist/empty-lists.webp"
              action={<Link href={emptyAction.href} className={`inline-flex min-h-11 items-center rounded-xl bg-[#0066ff] px-6 text-sm font-bold text-white transition-all hover:bg-[#0052cc] ${focusRing}`}>{emptyAction.label}</Link>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px] [&_th]:whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">タイプ</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">タイトル / 内容</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 text-xs">件数</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">作成日時</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 text-xs">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* リスト */}
                  {filteredLists.map((l) => (
                    <tr key={`list-${l.id}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 text-[10px] font-bold rounded-md"><UiIcon name="list" size={11} />リスト</span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-[#0a1530] text-sm">{l.name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {l.industry && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"><UiIcon name="building" size={11} className="inline align-[-1px] mr-0.5" />{l.industry}</span>}
                          {l.region && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded"><UiIcon name="target" size={11} className="inline align-[-1px] mr-0.5" />{l.region}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-bold text-[#0a1530]">{l.companyCount.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 ml-0.5">社</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(l.updatedAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <a href={`/api/doyalist/export?projectId=${l.id}&format=csv`} title="CSVダウンロード" aria-label={`${l.name}をCSVでダウンロード`} className={`${iconBtn} bg-slate-100 hover:bg-slate-200 rounded-lg`}><UiIcon name="download" size={16} /></a>
                          <a href={`/api/doyalist/export?projectId=${l.id}&format=excel`} title="Excelダウンロード" aria-label={`${l.name}をExcelでダウンロード`} className={`${iconBtn} bg-slate-100 hover:bg-slate-200 rounded-lg`}><UiIcon name="chart" size={16} /></a>
                          <button type="button" onClick={() => handleDeleteList(l.id, l.name)} title="削除" aria-label={`${l.name}を削除`} className={`${iconBtn} bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg`}><UiIcon name="trash" size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {/* ツール履歴 */}
                  {filteredApproaches.map((a) => {
                    const meta = TYPE_LABEL[a.type] || { ...TYPE_LABEL.form, l: getApproachTypeLabel(a.type), color: 'bg-slate-100 text-slate-700' }
                    const isExpanded = expandedId === a.id
                    return (
                      <tr key={`appr-${a.id}`} className="hover:bg-slate-50 transition-colors align-top">
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-md ${meta.color}`}>
                            <UiIcon name={meta.icon as UiIconName} size={12} />{meta.l}
                          </span>
                        </td>
                        <td className="px-5 py-3 max-w-[400px]">
                          <p className="font-bold text-[#0a1530] text-sm truncate">{a.subject || '(無題)'}</p>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : a.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`doyalist-approach-${a.id}`}
                            className={`mt-1 inline-flex min-h-11 items-center text-xs text-slate-500 hover:text-[#0066ff] transition-colors ${focusRing}`}
                          >
                            {isExpanded ? '▲ 閉じる' : '▼ 全文を表示'}
                          </button>
                          {isExpanded && (
                            <div id={`doyalist-approach-${a.id}`} className="mt-2 p-3 bg-slate-50 rounded-lg max-h-64 overflow-y-auto">
                              <pre className="whitespace-pre-wrap text-xs text-slate-700 leading-relaxed font-sans">{a.body}</pre>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center text-xs text-slate-400">—</td>
                        <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                          {new Date(a.createdAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => handleCopy(a.body)} title="コピー" aria-label={`「${a.subject || '無題'}」をコピー`} className={`${iconBtn} bg-slate-100 hover:bg-slate-200 rounded-lg`}><UiIcon name="copy" size={16} /></button>
                            <button type="button" onClick={() => handleDeleteApproach(a.id)} title="削除" aria-label={`「${a.subject || '無題'}」を削除`} className={`${iconBtn} bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg`}><UiIcon name="trash" size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {tab !== 'list' && nextCursor && !loadingApproaches && <div className="border-t border-slate-100 px-5 py-4"><button type="button" onClick={() => void loadMore(setApproachesErrorStatus)} disabled={loadingMore} className={`min-h-11 ${focusRing} rounded-lg border border-blue-300 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50`}>{loadingMore ? '読み込み中…' : `営業文履歴をさらに表示（${approaches.length}/${approachTotal}件）`}</button></div>}
          {(tab === 'all' || tab === 'list') && projectNextCursor && !loadingProjects && <div className="border-t border-slate-100 px-5 py-4"><button type="button" onClick={() => void loadMoreProjects(setProjectsErrorStatus)} disabled={loadingMoreProjects} className={`min-h-11 ${focusRing} rounded-lg border border-cyan-300 px-4 py-2 text-sm font-bold text-cyan-700 disabled:opacity-50`}>{loadingMoreProjects ? '読み込み中…' : `リスト履歴をさらに表示（${lists.length}/${projectTotal}件）`}</button></div>}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: UiIconName; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    violet: 'bg-brand-50 text-brand-600 border-brand-100',
  }
  return (
    <div className="bg-white rounded-2xl shadow-md shadow-slate-200/50 border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center ${colorMap[color] || colorMap.cyan}`}>
        <UiIcon name={icon} size={22} />
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="text-2xl font-black text-[#0a1530]">{value.toLocaleString()}<span className="text-sm font-bold text-slate-400 ml-1">件</span></p>
      </div>
    </div>
  )
}
