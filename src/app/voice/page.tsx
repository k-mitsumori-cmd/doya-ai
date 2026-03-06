'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Mic, Plus, Volume2, Clock, Star, Trash2, Play, Pause, AlertCircle } from 'lucide-react'

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
  updatedAt: string
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--:--'
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:      { label: '下書き',   color: 'bg-slate-100 text-slate-600' },
  generating: { label: '生成中...',  color: 'bg-blue-100 text-blue-700' },
  completed:  { label: '完成',     color: 'bg-green-100 text-green-700' },
  failed:     { label: 'エラー',   color: 'bg-red-100 text-red-700' },
}

export default function VoiceDashboard() {
  const { data: session } = useSession()
  const [projects, setProjects] = useState<VoiceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/voice/projects')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) setProjects(data.projects || [])
        else setFetchError(data.error || 'プロジェクト一覧の取得に失敗しました')
      })
      .catch(() => {
        setFetchError('プロジェクト一覧の読み込みに失敗しました。通信環境を確認してください。')
      })
      .finally(() => setLoading(false))
  }, [])

  // アンマウント時に音声を停止
  useEffect(() => {
    return () => { audioEl?.pause() }
  }, [audioEl])

  const togglePlay = (project: VoiceProject) => {
    if (project.status !== 'completed') return
    if (playingId === project.id) {
      audioEl?.pause()
      setPlayingId(null)
      return
    }
    audioEl?.pause()
    const audio = new Audio(`/api/voice/projects/${project.id}/download`)
    audio.play().catch(() => {
      setPlayingId(null)
    })
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    setAudioEl(audio)
    setPlayingId(project.id)
  }

  const deleteProject = async (id: string) => {
    setDeletingId(id)
    if (playingId === id) {
      audioEl?.pause()
      setPlayingId(null)
    }
    try {
      await fetch(`/api/voice/projects/${id}`, { method: 'DELETE' })
      setProjects(prev => prev.filter(p => p.id !== id))
    } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  const toggleFavorite = async (project: VoiceProject) => {
    await fetch(`/api/voice/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !project.isFavorite }),
    })
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, isFavorite: !p.isFavorite } : p))
  }

  return (
    <div className="space-y-6">
      {/* ヒーローバナー */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 p-6 text-white">
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black mb-1">声を、AIでつくる。</h1>
              <p className="text-violet-200 text-sm max-w-lg">
                テキストを入力するだけで自然な日本語ナレーション音声を生成。12種のキャラクターから最適な声を選べます。
              </p>
            </div>
            <div className="hidden md:block text-6xl opacity-20">🎙️</div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link
              href="/voice/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-violet-700 rounded-xl font-bold text-sm hover:bg-violet-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              ナレーションを生成
            </Link>
            <Link
              href="/voice/speakers"
              className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500/40 text-white rounded-xl font-bold text-sm hover:bg-violet-500/60 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
              ボイス一覧
            </Link>
          </div>
        </div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-white/20" />
          <div className="absolute -left-5 -bottom-5 w-40 h-40 rounded-full bg-white/10" />
        </div>
      </div>

      {/* クイックアクション */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/voice/new', icon: Mic, label: '新規生成', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
          { href: '/voice/record', icon: Volume2, label: '録音スタジオ', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
          { href: '/voice/speakers', icon: Star, label: 'ボイス一覧', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          { href: '/voice/history', icon: Clock, label: '生成履歴', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl font-bold text-sm transition-colors ${item.color}`}
          >
            <item.icon className="w-6 h-6" />
            {item.label}
          </Link>
        ))}
      </div>

      {/* エラー表示 */}
      {fetchError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-bold">{fetchError}</p>
            <button
              onClick={() => { setFetchError(null); setLoading(true); window.location.reload() }}
              className="text-xs text-red-500 hover:text-red-700 mt-1 font-bold"
            >
              再読み込み
            </button>
          </div>
        </div>
      )}

      {/* プロジェクト一覧 */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-slate-900">最近のプロジェクト</h2>
          <Link href="/voice/history" className="text-sm text-violet-600 hover:text-violet-800 font-bold">
            すべて見る →
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="text-5xl mb-3">🎙️</div>
            <h3 className="text-lg font-black text-slate-700 mb-1">まだプロジェクトがありません</h3>
            <p className="text-slate-500 text-sm mb-4">最初のナレーションを生成してみましょう</p>
            <Link
              href="/voice/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              ナレーションを生成
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.slice(0, 10).map(project => (
              <div
                key={project.id}
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-sm transition-all group"
              >
                {/* 再生ボタン */}
                <button
                  onClick={() => togglePlay(project)}
                  disabled={project.status !== 'completed'}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    project.status === 'completed'
                      ? 'bg-violet-100 hover:bg-violet-200 text-violet-700'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {playingId === project.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                {/* プロジェクト情報 */}
                <div className="flex-1 min-w-0">
                  <Link href={`/voice/${project.id}`} className="block">
                    <p className="font-bold text-slate-900 text-sm truncate group-hover:text-violet-700 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {project.inputText.slice(0, 50)}
                      {project.inputText.length > 50 ? '...' : ''}
                    </p>
                  </Link>
                </div>

                {/* メタ情報 */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[project.status]?.label ?? project.status}
                  </span>
                  {project.durationMs && (
                    <span className="text-xs text-slate-400 font-mono">{formatDuration(project.durationMs)}</span>
                  )}
                  <span className="text-xs text-slate-400">{formatDate(project.createdAt)}</span>
                  <button
                    onClick={() => toggleFavorite(project)}
                    className={`p-1.5 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                  >
                    <Star className={`w-3.5 h-3.5 ${project.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(project.id)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="font-bold text-slate-900">プロジェクトの削除</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6">このプロジェクトを削除しますか？この操作は取り消せません。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteProject(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deletingId === deleteConfirmId ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
