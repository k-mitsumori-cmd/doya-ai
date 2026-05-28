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
      <div className="min-h-screen flex items-center justify-center bg-[#0a1530]">
        <div className="flex flex-col items-center gap-4">
          <div className="text-5xl animate-bounce">🐻</div>
          <p className="text-sm font-bold text-cyan-300">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1530] via-[#13234d] to-[#0a1530] p-4 lg:p-8 text-white">
      <Toaster
        position="top-center"
        toastOptions={{
          style: { background: '#13234d', color: '#fff', border: '1px solid rgba(56, 189, 248, 0.3)' },
        }}
      />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="text-center pt-4 pb-2">
          <div className="text-5xl mb-2">📚</div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-300 to-lime-300 bg-clip-text text-transparent">
            リスト履歴
          </h1>
          <p className="text-sm font-bold text-cyan-300/80 mt-1">過去に生成したリストをいつでもダウンロード</p>
        </div>

        {lists.length === 0 ? (
          <div className="bg-[#13234d]/40 backdrop-blur rounded-3xl border-2 border-dashed border-cyan-400/30 p-12 text-center space-y-4">
            <div className="text-6xl">💤</div>
            <p className="text-lg font-black text-cyan-200">まだリストがありません</p>
            <Link
              href="/doyalist"
              className="inline-block px-8 py-3 bg-gradient-to-r from-cyan-400 to-lime-300 text-[#0a1530] font-black rounded-2xl shadow-lg hover:shadow-cyan-400/50 hover:shadow-2xl transition-all"
            >
              ⚡ リストを作成する
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {lists.map((l) => (
              <div key={l.id} className="bg-[#13234d]/80 backdrop-blur rounded-2xl shadow-md shadow-cyan-500/10 border-2 border-cyan-400/30 p-5 hover:shadow-xl hover:shadow-cyan-400/20 transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-lime-300 flex items-center justify-center text-2xl flex-shrink-0 shadow-md">
                      📋
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-black text-white mb-1">{l.name}</h2>
                      <div className="flex flex-wrap gap-2 text-xs font-bold mb-1">
                        {l.industry && <span className="px-2 py-0.5 bg-cyan-400/20 text-cyan-300 border border-cyan-400/30 rounded-full">🏢 {l.industry}</span>}
                        {l.region && <span className="px-2 py-0.5 bg-lime-400/20 text-lime-300 border border-lime-400/30 rounded-full">📍 {l.region}</span>}
                        <span className="px-2 py-0.5 bg-white/10 text-cyan-200 rounded-full">📊 {l.companyCount}社</span>
                      </div>
                      <p className="text-xs text-cyan-300/60">
                        最終更新: {new Date(l.updatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/api/doyalist/export?projectId=${l.id}&format=csv`}
                      className="px-3 py-2 bg-lime-400 text-[#0a1530] text-xs font-black rounded-xl shadow hover:bg-lime-300 transition-colors"
                    >
                      📥 CSV
                    </a>
                    <a
                      href={`/api/doyalist/export?projectId=${l.id}&format=excel`}
                      className="px-3 py-2 bg-cyan-400 text-[#0a1530] text-xs font-black rounded-xl shadow hover:bg-cyan-300 transition-colors"
                    >
                      📊 Excel
                    </a>
                    <button
                      onClick={() => handleDelete(l.id, l.name)}
                      className="px-3 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-black rounded-xl hover:bg-rose-500/30 transition-colors"
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
