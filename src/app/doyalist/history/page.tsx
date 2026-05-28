'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

interface ListSummary {
  id: string
  name: string
  industry: string | null
  region: string | null
  companyCount: number
  updatedAt: string
}

export default function HistoryPage() {
  const [lists, setLists] = useState<ListSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/doyalist/projects')
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d) ? d : (d?.projects || [])
        setLists(items)
      })
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🐻</div>
          <p className="text-sm font-medium text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="text-center pt-4 pb-2">
          <div className="text-4xl mb-2">📚</div>
          <h1 className="text-2xl lg:text-3xl font-black text-[#0a1530]">リスト履歴</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">過去に生成したリストをいつでもダウンロード</p>
        </div>

        {lists.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-lg shadow-slate-200/30 p-12 text-center space-y-4">
            <div className="text-6xl">💤</div>
            <p className="text-lg font-bold text-slate-500">まだリストがありません</p>
            <Link
              href="/doyalist"
              className="inline-block px-8 py-3 bg-[#0a1530] text-white font-bold rounded-xl shadow hover:bg-[#13234d] hover:shadow-xl transition-all"
            >
              ⚡ リストを作成する
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {lists.map((l) => (
              <div key={l.id} className="bg-white rounded-2xl shadow-md shadow-slate-200/50 border border-slate-200 p-5 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#0a1530] flex items-center justify-center text-white text-xl flex-shrink-0 shadow">📋</div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-[#0a1530] mb-1">{l.name}</h2>
                      <div className="flex flex-wrap gap-2 text-xs font-medium mb-1">
                        {l.industry && <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full">🏢 {l.industry}</span>}
                        {l.region && <span className="px-2 py-0.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-full">📍 {l.region}</span>}
                        <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-full">📊 {l.companyCount}社</span>
                      </div>
                      <p className="text-xs text-slate-400">最終更新: {new Date(l.updatedAt).toLocaleDateString('ja-JP')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a href={`/api/doyalist/export?projectId=${l.id}&format=csv`} className="px-3 py-2 bg-[#0a1530] text-white text-xs font-bold rounded-lg shadow hover:bg-[#13234d] transition-colors">
                      📥 CSV
                    </a>
                    <a href={`/api/doyalist/export?projectId=${l.id}&format=excel`} className="px-3 py-2 bg-cyan-500 text-white text-xs font-bold rounded-lg shadow hover:bg-cyan-600 transition-colors">
                      📊 Excel
                    </a>
                    <button
                      onClick={() => handleDelete(l.id, l.name)}
                      className="px-3 py-2 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors"
                      aria-label={`${l.name}を削除`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
