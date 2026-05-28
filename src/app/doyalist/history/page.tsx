'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast, { Toaster } from 'react-hot-toast'

const CHARS = {
  hello: '/kintai/characters/hello_挨拶.png',
  thinking: '/kintai/characters/thinking_考え中.png',
  sleep: '/kintai/characters/sleep_居眠り.png',
  present: '/kintai/characters/present_プレゼン.png',
  thumbsup: '/kintai/characters/thumbsup_いいね.png',
  love: '/kintai/characters/love_大好き.png',
}

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="flex flex-col items-center gap-4">
          <img src={CHARS.thinking} alt="" className="w-32 h-32 animate-bounce" />
          <p className="text-sm font-bold text-slate-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-violet-50 p-4 lg:p-8">
      <Toaster position="top-center" />

      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        <div className="text-center pt-4 pb-2">
          <img src={CHARS.present} alt="" className="w-24 h-24 mx-auto" />
          <h1 className="text-3xl font-black bg-gradient-to-r from-[#7f19e6] to-pink-500 bg-clip-text text-transparent mt-2">
            リスト履歴
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">過去に生成したリストをいつでもダウンロード</p>
        </div>

        {lists.length === 0 ? (
          <div className="bg-white/70 backdrop-blur rounded-3xl border-2 border-dashed border-purple-200 p-12 text-center space-y-4">
            <img src={CHARS.sleep} alt="" className="w-32 h-32 mx-auto opacity-80" />
            <p className="text-lg font-black text-slate-500">まだリストがありません</p>
            <Link
              href="/doyalist"
              className="inline-block px-8 py-3 bg-gradient-to-r from-[#7f19e6] to-pink-500 text-white font-black rounded-2xl shadow-lg hover:shadow-xl transition-shadow"
            >
              ✨ リストを作成する
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {lists.map((l) => (
              <div key={l.id} className="bg-white rounded-2xl shadow-md shadow-purple-100/50 border-2 border-purple-100 p-5 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <img src={CHARS.thumbsup} alt="" className="w-12 h-12 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-black text-slate-800 mb-1">{l.name}</h2>
                      <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-500 mb-1">
                        {l.industry && <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">🏢 {l.industry}</span>}
                        {l.region && <span className="px-2 py-0.5 bg-pink-50 text-pink-700 rounded-full">📍 {l.region}</span>}
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">📊 {l.companyCount}社</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        最終更新: {new Date(l.updatedAt).toLocaleDateString('ja-JP')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <a
                      href={`/api/doyalist/export?projectId=${l.id}&format=csv`}
                      className="px-3 py-2 bg-emerald-500 text-white text-xs font-black rounded-xl shadow hover:bg-emerald-600 transition-colors"
                    >
                      📥 CSV
                    </a>
                    <a
                      href={`/api/doyalist/export?projectId=${l.id}&format=excel`}
                      className="px-3 py-2 bg-blue-500 text-white text-xs font-black rounded-xl shadow hover:bg-blue-600 transition-colors"
                    >
                      📊 Excel
                    </a>
                    <button
                      onClick={() => handleDelete(l.id, l.name)}
                      className="px-3 py-2 bg-rose-100 text-rose-600 text-xs font-black rounded-xl hover:bg-rose-200 transition-colors"
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
