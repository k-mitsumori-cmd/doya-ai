'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

interface ListSummary {
  id: string
  name: string
  industry: string | null
  region: string | null
  companyCount: number
  updatedAt: string
  createdAt?: string
}

const CHARS = {
  thinking: '/kintai/characters/thinking_考え中.png',
  sleep: '/kintai/characters/sleep_居眠り.png',
}

const TABS = [
  { v: 'all', l: 'すべて' },
  { v: 'list', l: 'リスト' },
  { v: 'form', l: 'フォーム文面' },
  { v: 'email', l: 'メール文面' },
  { v: 'script', l: 'スクリプト' },
]

export default function HistoryPage() {
  const [lists, setLists] = useState<ListSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/doyalist/projects')
      .then((r) => r.json())
      .then((d) => setLists(Array.isArray(d) ? d : (d?.projects || [])))
      .catch((e) => console.error('[history]', e))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    try {
      const res = await fetch(`/api/doyalist/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('削除に失敗しました')
      toast.success('削除しました')
      setLists((prev) => prev.filter((l) => l.id !== id))
    } catch (e: any) {
      toast.error(e?.message || '削除に失敗しました')
    }
  }

  const stats = useMemo(() => {
    const total = lists.length
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const thisMonth = lists.filter((l) => new Date(l.updatedAt || l.createdAt || 0).getTime() >= monthStart).length
    const totalCompanies = lists.reduce((sum, l) => sum + (l.companyCount || 0), 0)
    return { total, thisMonth, totalCompanies }
  }, [lists])

  const filtered = useMemo(() => {
    let f = lists
    if (search.trim()) {
      const q = search.toLowerCase()
      f = f.filter((l) => l.name.toLowerCase().includes(q) || l.industry?.toLowerCase().includes(q) || l.region?.toLowerCase().includes(q))
    }
    return f
  }, [lists, search])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <img src={CHARS.thinking} alt="" className="w-28 h-28 animate-bounce" />
          <p className="text-sm font-medium text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-7xl mx-auto pb-20">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-500 flex items-center justify-center shadow-md text-2xl">📚</div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">生成履歴</h1>
            <p className="text-sm font-medium text-slate-500 mt-0.5">これまでに作成したリスト・営業文・メール・スクリプトをまとめて管理できます</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard icon="📊" label="リスト総数" value={stats.total} color="cyan" />
          <StatCard icon="📅" label="今月の生成" value={stats.thisMonth} color="emerald" />
          <StatCard icon="🏢" label="累計企業数" value={stats.totalCompanies} color="violet" />
        </div>

        {/* Tabs + Search */}
        <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
            <div className="flex gap-1 flex-wrap">
              {TABS.map((t) => (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    tab === t.v ? 'bg-[#0a1530] text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.l}
                </button>
              ))}
            </div>
            <div className="flex-1 min-w-[200px]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 名前・業種・地域で検索"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0a1530] focus:ring-2 focus:ring-cyan-100 min-w-[200px]"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <img src={CHARS.sleep} alt="" className="w-24 h-24 mx-auto opacity-80" />
              <p className="text-lg font-bold text-slate-500">まだリストがありません</p>
              <Link href="/doyalist" className="inline-block px-8 py-3 bg-[#0a1530] text-white font-bold rounded-xl shadow hover:bg-[#13234d] hover:shadow-xl transition-all">
                ⚡ リストを作成する
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">タイプ</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">タイトル</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 text-xs">件数</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 text-xs">作成日時</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 text-xs">ステータス</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 text-xs">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-cyan-700 text-[10px] font-bold rounded-md">
                          📋 リスト
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-bold text-[#0a1530] text-sm">{l.name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {l.industry && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">🏢 {l.industry}</span>}
                          {l.region && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">📍 {l.region}</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="font-bold text-[#0a1530]">{l.companyCount.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 ml-0.5">社</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(l.updatedAt).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-md">完了</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <a href={`/api/doyalist/export?projectId=${l.id}&format=csv`} title="CSVダウンロード" className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📥</a>
                          <a href={`/api/doyalist/export?projectId=${l.id}&format=excel`} title="Excelダウンロード" className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs">📊</a>
                          <button onClick={() => handleDelete(l.id, l.name)} title="削除" aria-label={`${l.name}を削除`} className="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg text-xs">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  }
  return (
    <div className="bg-white rounded-2xl shadow-md shadow-slate-200/50 border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl ${colorMap[color] || colorMap.cyan}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500">{label}</p>
        <p className="text-2xl font-black text-[#0a1530]">{value.toLocaleString()}<span className="text-sm font-bold text-slate-400 ml-1">件</span></p>
      </div>
    </div>
  )
}
