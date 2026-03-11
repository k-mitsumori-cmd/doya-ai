'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Play, Pause, Download, Star, Trash2, Loader2, AlertCircle, Mic, LogIn, Plus, List, CheckCircle, Hourglass } from 'lucide-react'

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
  generating: { label: '生成中',   color: 'bg-violet-100 text-violet-600' },
  completed:  { label: '完成',    color: 'bg-emerald-100 text-emerald-800' },
  failed:     { label: 'エラー',  color: 'bg-red-100 text-red-800' },
}

export default function HistoryPage() {
  const { data: session, status: sessionStatus } = useSession()
  const isLoggedIn = !!session?.user
  const [projects, setProjects] = useState<VoiceProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'favorite'>('all')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    fetch('/api/voice/projects')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) setProjects(data.projects || [])
        else setFetchError(data.error || '履歴の取得に失敗しました')
      })
      .catch(() => {
        setFetchError('履歴の読み込みに失敗しました。通信環境を確認してください。')
      })
      .finally(() => setLoading(false))
  }, [isLoggedIn, sessionStatus])

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
    audio.play().catch(() => setPlayingId(null))
    audio.onended = () => setPlayingId(null)
    audio.onerror = () => setPlayingId(null)
    setAudioEl(audio)
    setPlayingId(p.id)
  }

  const toggleFavorite = async (p: VoiceProject) => {
    try {
      const res = await fetch(`/api/voice/projects/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !p.isFavorite }),
      })
      if (!res.ok) return
      setProjects(prev => prev.map(item => item.id === p.id ? { ...item, isFavorite: !item.isFavorite } : item))
    } catch { /* ignore */ }
  }

  const deleteProject = async (id: string) => {
    setDeletingId(id)
    if (playingId === id) {
      audioEl?.pause()
      setPlayingId(null)
    }
    try {
      const res = await fetch(`/api/voice/projects/${id}`, { method: 'DELETE' })
      if (res.ok) setProjects(prev => prev.filter(p => p.id !== id))
    } catch { /* ignore */ } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 mb-1">生成履歴</h1>
          <p className="text-slate-500">過去に生成したナレーション一覧</p>
        </div>
        <Link
          href="/voice/new"
          className="bg-violet-600 text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-violet-600/20 flex items-center gap-2 transition-all"
        >
          <Plus className="w-5 h-5" />
          新規生成
        </Link>
      </div>

      {/* フィルター */}
      <div className="flex gap-2">
        {([
          { val: 'all' as const, label: 'すべて', Icon: List },
          { val: 'completed' as const, label: '完成のみ', Icon: CheckCircle },
          { val: 'favorite' as const, label: 'お気に入り', Icon: Star },
        ]).map(({ val, label, Icon }) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-5 py-2 rounded-full text-sm flex items-center gap-2 transition-colors ${
              filter === val
                ? 'bg-violet-600 text-white font-bold'
                : 'bg-white text-slate-600 font-medium hover:bg-violet-50 border border-violet-600/10'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
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

      {!isLoggedIn ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="size-24 rounded-full bg-violet-50 text-violet-400/40 flex items-center justify-center mb-6">
            <LogIn className="w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-1">ログインが必要です</h3>
          <p className="text-slate-500 mb-8 max-w-xs">Googleアカウントでログインして生成履歴を確認しましょう</p>
          <button
            onClick={() => signIn('google', { callbackUrl: '/voice/history' })}
            className="bg-violet-600 text-white px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-violet-600/20 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Googleでログイン
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="size-24 rounded-full bg-violet-50 text-violet-400/40 flex items-center justify-center mb-6">
            <Mic className="w-12 h-12" />
          </div>
          <h3 className="text-xl font-bold text-slate-700 mb-1">該当するプロジェクトがありません</h3>
          <p className="text-slate-500 mb-8 max-w-xs">最初のナレーションを生成してみましょう</p>
          <Link
            href="/voice/new"
            className="bg-violet-600 text-white px-8 py-3 rounded-xl font-bold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-violet-600/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            ナレーションを生成
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(project => (
            <div key={project.id}
              className="group bg-white p-4 rounded-2xl border border-violet-600/5 hover:border-violet-600/30 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-4">
                {/* 再生ボタン */}
                <button
                  onClick={() => togglePlay(project)}
                  disabled={project.status !== 'completed'}
                  aria-label={playingId === project.id ? '停止' : '再生'}
                  className={`size-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    project.status === 'completed'
                      ? 'bg-violet-100 text-violet-600 hover:bg-violet-200'
                      : project.status === 'generating'
                        ? 'bg-violet-100 text-violet-600 cursor-wait'
                        : project.status === 'failed'
                          ? 'bg-red-50 text-red-500'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {project.status === 'generating' ? (
                    <Hourglass className="w-5 h-5 animate-pulse" />
                  ) : playingId === project.id ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5 ml-0.5" />
                  )}
                </button>

                {/* プロジェクト情報 */}
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

                {/* ステータス + メタ情報（デスクトップ） */}
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[project.status]?.label ?? project.status}
                  </span>
                  {project.durationMs && (
                    <span className="font-mono text-sm text-slate-500">{formatDuration(project.durationMs)}</span>
                  )}
                  <span className="text-sm text-slate-400">
                    {new Date(project.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </span>
                  {project.status === 'completed' && (
                    <a href={`/api/voice/projects/${project.id}/download`}
                      aria-label="ダウンロード"
                      className="p-2 text-slate-400 hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => toggleFavorite(project)}
                    aria-label={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
                    className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
                  >
                    <Star className={`w-4 h-4 ${project.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => setDeleteConfirmId(project.id)}
                    aria-label="削除"
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* モバイル: ステータスバッジ + アクション */}
                <div className="flex md:hidden items-center gap-1 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[project.status]?.label ?? project.status}
                  </span>
                  <button onClick={() => toggleFavorite(project)}
                    aria-label={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
                    className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-400'}`}
                  >
                    <Star className={`w-4 h-4 ${project.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => setDeleteConfirmId(project.id)}
                    aria-label="削除"
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} onKeyDown={e => { if (e.key === 'Escape') setDeleteConfirmId(null) }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 mx-4" role="dialog" aria-modal="true" aria-label="プロジェクトの削除" onClick={e => e.stopPropagation()}>
            <div className="size-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-center mb-3">プロジェクトの削除</h3>
            <p className="text-slate-500 text-center mb-8">このプロジェクトを削除しますか？<br />この操作は取り消せません。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => deleteProject(deleteConfirmId)}
                disabled={deletingId === deleteConfirmId}
                className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 shadow-lg shadow-red-500/20 transition-colors flex items-center justify-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                {deletingId === deleteConfirmId ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
