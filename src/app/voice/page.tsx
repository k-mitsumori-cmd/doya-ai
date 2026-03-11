'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Mic, Plus, Volume2, Clock, Star, Trash2, Play, Pause, AlertCircle, LogIn, ArrowRight } from 'lucide-react'

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
  generating: { label: '生成中...',  color: 'bg-violet-100 text-violet-600' },
  completed:  { label: '完成',     color: 'bg-emerald-100 text-emerald-800' },
  failed:     { label: 'エラー',   color: 'bg-red-100 text-red-800' },
}

export default function VoiceDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const isLoggedIn = !!session?.user
  const [projects, setProjects] = useState<VoiceProject[]>([])
  const [loading, setLoading] = useState(true)
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
        else setFetchError(data.error || 'プロジェクト一覧の取得に失敗しました')
      })
      .catch(() => {
        setFetchError('プロジェクト一覧の読み込みに失敗しました。通信環境を確認してください。')
      })
      .finally(() => setLoading(false))
  }, [isLoggedIn, sessionStatus])

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
      const res = await fetch(`/api/voice/projects/${id}`, { method: 'DELETE' })
      if (res.ok) setProjects(prev => prev.filter(p => p.id !== id))
    } catch { /* ignore */ } finally {
      setDeletingId(null)
      setDeleteConfirmId(null)
    }
  }

  const toggleFavorite = async (project: VoiceProject) => {
    try {
      const res = await fetch(`/api/voice/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !project.isFavorite }),
      })
      if (!res.ok) return
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, isFavorite: !p.isFavorite } : p))
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-8">
      {/* ヒーローバナー */}
      <section className="relative bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-8 overflow-hidden text-white min-h-[220px] flex items-center">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-64 h-64 bg-violet-600/20 rounded-full blur-2xl" />
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-4xl font-black mb-4 tracking-tight">声を、AIでつくる。</h1>
          <p className="text-white/90 text-lg mb-6 leading-relaxed">
            テキストを入力するだけで自然な日本語ナレーション音声を生成。12種のキャラクターから最適な声を選べます。
          </p>
          <div className="flex flex-wrap gap-4">
            {isLoggedIn ? (
              <>
                <Link
                  href="/voice/new"
                  className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  ナレーションを生成
                </Link>
                <Link
                  href="/voice/speakers"
                  className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors border border-white/10"
                >
                  <Volume2 className="w-4 h-4" />
                  ボイス一覧
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/voice' })}
                  className="inline-flex items-center gap-2 bg-white text-violet-700 font-bold px-6 py-3 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  ログインして始める
                </button>
                <Link
                  href="/voice/speakers"
                  className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md text-white font-bold px-6 py-3 rounded-xl hover:bg-white/30 transition-colors border border-white/10"
                >
                  <Volume2 className="w-4 h-4" />
                  ボイス一覧を見る
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* クイックアクション */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { href: '/voice/new', icon: Mic, label: '新規生成', desc: 'テキストから音声を生成', bgColor: 'bg-violet-50', borderColor: 'border-violet-100', iconBg: 'bg-violet-600' },
          { href: '/voice/record', icon: Volume2, label: '録音スタジオ', desc: '独自の音声を録音・加工', bgColor: 'bg-blue-50', borderColor: 'border-blue-100', iconBg: 'bg-blue-600' },
          { href: '/voice/speakers', icon: Star, label: 'ボイス一覧', desc: 'AIボイスモデルを探す', bgColor: 'bg-amber-50', borderColor: 'border-amber-100', iconBg: 'bg-amber-600' },
          { href: '/voice/history', icon: Clock, label: '生成履歴', desc: '過去のプロジェクトを確認', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-100', iconBg: 'bg-emerald-600' },
        ].map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`${item.bgColor} p-5 rounded-xl border ${item.borderColor} group cursor-pointer hover:shadow-md transition-shadow`}
          >
            <div className={`w-12 h-12 ${item.iconBg} text-white rounded-lg flex items-center justify-center mb-4`}>
              <item.icon className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900">{item.label}</h3>
            <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
          </Link>
        ))}
      </section>

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
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-slate-900">最近のプロジェクト</h2>
          {isLoggedIn && (
            <Link href="/voice/history" className="inline-flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800 font-bold">
              すべて見る
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>

        {!isLoggedIn ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="size-16 rounded-full bg-violet-50 text-violet-400 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-slate-700 mb-1">ログインが必要です</h3>
            <p className="text-slate-500 text-sm mb-4">Googleアカウントでログインして、ナレーション音声を生成しましょう</p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/voice' })}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Googleでログイン
            </button>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-50 animate-pulse border-b border-slate-100 last:border-b-0" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="size-16 rounded-full bg-violet-50 text-violet-400 flex items-center justify-center mx-auto mb-4">
              <Mic className="w-8 h-8" />
            </div>
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
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Table header - desktop only */}
            <div className="hidden md:grid md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <div className="w-10">プレビュー</div>
              <div>プロジェクト名</div>
              <div>ステータス</div>
              <div>再生時間</div>
              <div>日付</div>
              <div className="w-20 text-right">アクション</div>
            </div>

            {/* Table rows */}
            {projects.slice(0, 10).map(project => (
              <div
                key={project.id}
                className="group hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-b-0"
              >
                {/* Desktop table row */}
                <div className="hidden md:grid md:grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 items-center px-5 py-3">
                  {/* 再生ボタン */}
                  <button
                    onClick={() => togglePlay(project)}
                    disabled={project.status !== 'completed'}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                      project.status === 'completed'
                        ? 'bg-violet-600 text-white hover:scale-110'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {playingId === project.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

                  {/* プロジェクト名 */}
                  <Link href={`/voice/${project.id}`} className="min-w-0">
                    <p className="font-bold text-slate-900 text-sm truncate group-hover:text-violet-700 transition-colors">
                      {project.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {project.inputText.slice(0, 50)}
                      {project.inputText.length > 50 ? '...' : ''}
                    </p>
                  </Link>

                  {/* ステータス */}
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                    {STATUS_LABEL[project.status]?.label ?? project.status}
                  </span>

                  {/* 再生時間 */}
                  <span className="text-xs text-slate-400 font-mono">{formatDuration(project.durationMs)}</span>

                  {/* 日付 */}
                  <span className="text-xs text-slate-400">{formatDate(project.createdAt)}</span>

                  {/* アクション */}
                  <div className="flex items-center gap-1 justify-end w-20">
                    <button
                      onClick={() => toggleFavorite(project)}
                      aria-label={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
                      className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${project.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      aria-label="削除"
                      className="p-2 rounded-lg text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile card row */}
                <div className="flex md:hidden items-center gap-4 p-4">
                  <button
                    onClick={() => togglePlay(project)}
                    disabled={project.status !== 'completed'}
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform ${
                      project.status === 'completed'
                        ? 'bg-violet-600 text-white hover:scale-110'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {playingId === project.id ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>

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

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_LABEL[project.status]?.color ?? 'bg-slate-100 text-slate-500'}`}>
                      {STATUS_LABEL[project.status]?.label ?? project.status}
                    </span>
                    <button
                      onClick={() => toggleFavorite(project)}
                      aria-label={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
                      className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
                    >
                      <Star className={`w-3.5 h-3.5 ${project.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(project.id)}
                      aria-label="削除"
                      className="p-2 rounded-lg text-slate-300 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 削除確認モーダル */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)} onKeyDown={e => { if (e.key === 'Escape') setDeleteConfirmId(null) }}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-white/20 p-8 mx-4" role="dialog" aria-modal="true" aria-label="プロジェクトの削除" onClick={e => e.stopPropagation()}>
            <div className="size-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-center mb-3">プロジェクトの削除</h3>
            <p className="text-slate-500 text-center mb-8">このプロジェクトを削除しますか？この操作は取り消せません。</p>
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
                className="flex-1 py-3 rounded-xl font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-2"
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
