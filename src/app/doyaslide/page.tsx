'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface SlideThumb {
  id: string
  index: number
  imageUrl: string | null
}
interface Project {
  id: string
  title: string
  docType: string
  status: string
  aspectRatio: string
  updatedAt: string
  slides: SlideThumb[]
}

const STATUS_LABEL: Record<string, string> = {
  draft: '下書き',
  structuring: '構成中',
  generating: '生成中',
  completed: '完成',
  error: 'エラー',
}

export default function DoyaSlideDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<any>(null)

  const load = () => {
    fetch('/api/doyaslide/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {})
      .finally(() => setLoading(false))
    fetch('/api/doyaslide/usage')
      .then((r) => r.json())
      .then(setUsage)
      .catch(() => {})
  }
  useEffect(load, [])

  const remove = async (id: string) => {
    if (!confirm('このプロジェクトを削除しますか？')) return
    const res = await fetch(`/api/doyaslide/projects/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('削除しました')
      setProjects((p) => p.filter((x) => x.id !== id))
    } else {
      toast.error('削除に失敗しました')
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/character/present.png" alt="" className="w-14 h-14 object-contain hidden sm:block" />
          <div>
            <h1 className="text-3xl font-black text-slate-900">ドヤスライド</h1>
            <p className="text-slate-500 font-bold mt-1">全スライドをAI画像でド派手に生成</p>
          </div>
        </div>
        <Link
          href="/doyaslide/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-black shadow-lg hover:shadow-xl transition-all"
        >
          <span className="material-symbols-outlined">add</span>
          新規作成
        </Link>
      </div>

      {usage?.limits && (
        <div className="mb-6 inline-flex items-center gap-3 text-xs font-bold text-slate-500 bg-white rounded-full px-4 py-2 shadow-sm">
          <span>プラン: {usage.plan}</span>
          <span className="text-slate-300">|</span>
          <span>
            プロジェクト {usage.usage?.projects ?? 0}
            {usage.limits.maxProjects === -1 ? '' : ` / ${usage.limits.maxProjects}`}
          </span>
          <span className="text-slate-300">|</span>
          <span>
            今月の生成 {usage.usage?.slidesThisMonth ?? 0}
            {usage.limits.maxSlidesPerMonth === -1 ? '' : ` / ${usage.limits.maxSlidesPerMonth}枚`}
          </span>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-3xl shadow-sm p-16 text-center">
          <img src="/character/hello.png" alt="" className="w-24 h-24 object-contain mx-auto mb-4" />
          <p className="text-lg font-black text-slate-700 mb-1">一緒に最初のスライドを作ろう！</p>
          <p className="text-sm text-slate-400 font-bold mb-6">テーマを入れるだけで、AIが全スライドを画像で作ります</p>
          <Link
            href="/doyaslide/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-black shadow-lg"
          >
            <span className="material-symbols-outlined">add</span>
            最初のスライドを作る
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((p) => {
            const cover = p.slides.find((s) => s.imageUrl)?.imageUrl
            return (
              <div key={p.id} className="group bg-white rounded-3xl shadow-sm hover:shadow-lg transition-all overflow-hidden">
                <Link href={`/doyaslide/${p.id}`}>
                  <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                    {cover ? (
                      <img src={cover} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl opacity-30">🖼️</span>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/doyaslide/${p.id}`} className="font-black text-slate-800 truncate hover:underline">
                      {p.title}
                    </Link>
                    <button
                      onClick={() => remove(p.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors"
                      title="削除"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-xs font-bold text-slate-400">
                    <span className="px-2 py-0.5 rounded-full bg-fuchsia-50 text-fuchsia-600">
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                    <span>{p.slides.filter((s) => s.imageUrl).length}枚</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
