'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Play, Pause, Download, Star, Trash2, Loader2 } from 'lucide-react'

interface VoiceProject {
  id: string
  name: string
  status: string
  speakerId: string
  inputText: string
  outputUrl: string | null
  durationMs: number | null
  isFavorite: boolean
  createdAt: string
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--:--'
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:      { label: '下書き',   color: 'bg-slate-100 text-slate-600' },
  generating: { label: '生成中',   color: 'bg-blue-100 text-blue-700' },
  completed:  { label: '完成',    color: 'bg-green-100 text-green-700' },
  failed:     { label: 'エラー',  color: 'bg-red-100 text-red-700' },
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<VoiceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'favorite'>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetch('/api/voice/projects')
      .then(r => r.json())
      .then(data => { if (data.success) setProjects(data.projects || []) })
      .finally(() => setLoading(false))
  }, [])

  // アンマウント時に音声を停止
  useEffect(() => {
    return () => { audioEl?.pause() }
  }, [audioEl])

  const filtered = projects.filter(p => {
    if (filter === 'completed') return p.status === 'completed'
    if (filter === 'favorite') return p.isFavorite
    return true
  })

  const togglePlay = (p: VoiceProject) => {
    if (p.status !== 'completed') return
    if (playingId === p.id) {
      audioEl?.pause()
      setPlayingId(null)
      return
    }
    audioEl?.pause()
    const audio = new Audio(`/api/voice/projects/${p.id}/download`)
    audio.play()
    audio.onended = () => setPlayingId(null)
    setAudioEl(audio)
    setPlayingId(p.id)
  }

  const toggleFavorite = async (p: VoiceProject) => {
    await fetch(`/api/voice/projects/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !p.isFavorite }),
    })
    setProjects(prev => prev.map(item => item.id === p.id ? { ...item, isFavorite: !item.isFavorite } : item))
  }

  const deleteProject = async (id: string) => {
    if (!confirm('削除しますか？')) return
    if (playingId === id) {
      audioEl?.pause()
      setPlayingId(null)
    }
    await fetch(`/api/voice/projects/${id}`, { method: 'DELETE' })
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">生成履歴</h1>
          <p className="text-sm text-slate-500 mt-1">過去に生成したナレーション一覧</p>
        </div>
        <Link href="/voice/new" className="px-4 py-2 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors">
          + 新規生成
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {([['all', 'すべて'], ['completed', '完成のみ'], ['favorite', 'お気に入り']] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              filter === val ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-slate-500">該当するプロジェクトがありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(project => (
            <div key={project.id}
              className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all group"
            >
              <button
                onClick={() => togglePlay(project)}
                disabled={project.status !== 'completed'}
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  project.status === 'completed' ? 'bg-violet-100 hover:bg-violet-200 text-violet-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {playingId === project.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <Link href={`/voice/${project.id}`} className="block">
                  <p className="font-bold text-slate-900 text-sm truncate group-hover:text-violet-700 transition-colors">
                    {project.name}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {project.inputText.slice(0, 60)}{project.inputText.length > 60 ? '...' : ''}
                  </p>
                </Link>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                  {STATUS_LABEL[project.status]?.label ?? project.status}
                </span>
                {project.durationMs && (
                  <span className="text-xs text-slate-400 font-mono">{formatDuration(project.durationMs)}</span>
                )}
                <span className="text-xs text-slate-400">
                  {new Date(project.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </span>
                {project.status === 'completed' && (
                  <a href={`/api/voice/projects/${project.id}/download`}
                    className="p-1.5 text-slate-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => toggleFavorite(project)}
                  className={`p-1.5 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                >
                  <Star className={`w-3.5 h-3.5 ${project.isFavorite ? 'fill-current' : ''}`} />
                </button>
                <button onClick={() => deleteProject(project.id)}
                  className="p-1.5 text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
