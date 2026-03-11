'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Play, Pause, Download, Edit2, Trash2, Star, ArrowLeft, Loader2,
  AlertCircle, Clock, FileAudio, Volume2, Zap, Mic2, LogIn,
  FileText, Settings,
} from 'lucide-react'
import { getSpeakerById, type VoiceSpeaker } from '@/lib/voice/speakers'

interface RecordingDetail {
  id: string
  label: string | null
  originalUrl: string
  trimmedUrl: string | null
  durationMs: number | null
  fileSize: number | null
  format: string | null
  order: number
  createdAt: string
}

interface ProjectDetail {
  id: string
  name: string
  status: string
  speakerId: string
  speed: number
  pitch: number
  volume: number
  pauseLength: string
  emotionTone: string
  inputText: string
  outputFormat: string
  outputUrl: string | null
  durationMs: number | null
  fileSize: number | null
  isFavorite: boolean
  metadata: any
  createdAt: string
  updatedAt: string
  recordings: RecordingDetail[]
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  draft:      { label: '下書き',     color: 'bg-slate-100 text-slate-600' },
  generating: { label: '生成中...',  color: 'bg-violet-100 text-violet-600' },
  completed:  { label: '完成',       color: 'bg-emerald-100 text-emerald-800' },
  failed:     { label: 'エラー',     color: 'bg-red-100 text-red-800' },
}

const EMOTION_LABELS: Record<string, string> = {
  neutral: 'ニュートラル',
  bright:  '明るい',
  calm:    '落ち着き',
  serious: '真剣',
  gentle:  'やさしい',
}

const PAUSE_LABELS: Record<string, string> = {
  short:    '短い',
  standard: '標準',
  long:     '長い',
  custom:   'カスタム',
}

function formatDuration(ms: number | null): string {
  if (!ms) return '--'
  const secs = Math.floor(ms / 1000)
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}分${s}秒`
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const isLoggedIn = !!session?.user
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [playingRecId, setPlayingRecId] = useState<string | null>(null)
  const [recAudioEl, setRecAudioEl] = useState<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!isLoggedIn) {
      setLoading(false)
      return
    }
    fetch(`/api/voice/projects/${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) {
          setProject(data.project)
        } else {
          setFetchError(data.error || 'プロジェクトが見つかりません')
        }
      })
      .catch(() => {
        setFetchError('プロジェクトの読み込みに失敗しました。通信環境を確認してください。')
      })
      .finally(() => setLoading(false))
  }, [projectId, isLoggedIn, sessionStatus])

  // アンマウント時に音声を停止
  useEffect(() => {
    return () => {
      audioEl?.pause()
      recAudioEl?.pause()
    }
  }, [audioEl, recAudioEl])

  const togglePlay = () => {
    if (project?.status !== 'completed') return
    if (playing) {
      audioEl?.pause()
      setPlaying(false)
      return
    }
    const audio = new Audio(`/api/voice/projects/${projectId}/download`)
    audio.play().catch(() => {})
    audio.onended = () => setPlaying(false)
    audio.onerror = () => setPlaying(false)
    setAudioEl(audio)
    setPlaying(true)
  }

  const toggleRecordingPlay = (rec: RecordingDetail) => {
    const url = rec.trimmedUrl || rec.originalUrl
    if (playingRecId === rec.id) {
      recAudioEl?.pause()
      setPlayingRecId(null)
      return
    }
    recAudioEl?.pause()
    const audio = new Audio(url)
    audio.play().catch(() => {})
    audio.onended = () => setPlayingRecId(null)
    audio.onerror = () => setPlayingRecId(null)
    setRecAudioEl(audio)
    setPlayingRecId(rec.id)
  }

  const toggleFavorite = async () => {
    if (!project) return
    const res = await fetch(`/api/voice/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !project.isFavorite }),
    })
    const data = await res.json()
    if (data.success) {
      setProject(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : prev)
    }
  }

  const deleteProject = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/voice/projects/${projectId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        router.push('/voice')
      } else {
        toast.error(data.error || '削除に失敗しました')
      }
    } catch {
      toast.error('通信エラーが発生しました')
    } finally {
      setDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  // スピーカー情報を取得
  const speaker: VoiceSpeaker | undefined = project ? getSpeakerById(project.speakerId) : undefined

  if (!isLoggedIn && !loading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <LogIn className="w-10 h-10 text-slate-300 mx-auto" />
        <h3 className="text-lg font-black text-slate-700">ログインが必要です</h3>
        <p className="text-slate-500 text-sm">プロジェクトの詳細を確認するにはログインしてください</p>
        <button
          onClick={() => signIn('google', { callbackUrl: `/voice/${projectId}` })}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl font-black text-sm hover:bg-violet-700 transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Googleでログイン
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (fetchError || !project) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20 space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-2">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-slate-700 font-bold">{fetchError || 'プロジェクトが見つかりません'}</p>
        <Link href="/voice" className="mt-4 inline-block text-violet-600 font-bold hover:underline">
          ダッシュボードへ戻る
        </Link>
      </div>
    )
  }

  const statusInfo = STATUS_LABEL[project.status] || { label: project.status, color: 'bg-slate-100 text-slate-500' }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
      {/* ヘッダー */}
      <header className="flex items-center justify-between py-8">
        <div className="flex items-center gap-4">
          <Link href="/voice" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-slate-900">{project.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleFavorite}
            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
            title={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
          >
            <Star className={`w-5 h-5 ${project.isFavorite ? 'text-amber-400 fill-current' : 'text-slate-400'}`} />
          </button>
          <Link
            href={`/voice/${projectId}/edit`}
            className="p-2.5 bg-violet-100 text-violet-600 rounded-xl hover:bg-violet-200 transition-colors shadow-sm"
            title="編集"
          >
            <Edit2 className="w-5 h-5" />
          </Link>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
            title="削除"
          >
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* 音声プレイヤー Hero */}
      <section className="mb-8 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-950 rounded-2xl p-8 text-white shadow-xl shadow-violet-600/20">
        {project.status === 'completed' ? (
          <div className="flex flex-col items-center text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-1">{project.name}</h2>
              <p className="text-white/60 text-sm">
                {formatDuration(project.durationMs)} ・ {project.outputFormat.toUpperCase()} ・ {formatFileSize(project.fileSize)}
              </p>
            </div>

            {/* Duration bar */}
            <div className="w-full flex items-center gap-4">
              <div className="relative flex-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                {playing && (
                  <div className="absolute top-0 left-0 h-full bg-violet-400 rounded-full animate-pulse w-full" />
                )}
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center">
              <button
                onClick={togglePlay}
                className="w-20 h-20 bg-violet-600 hover:bg-violet-500 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                {playing ? <Pause className="w-10 h-10" /> : <Play className="w-10 h-10 ml-1" />}
              </button>
            </div>

            {/* Bottom action buttons */}
            <div className="flex gap-3 w-full pt-4">
              <a
                href={`/api/voice/projects/${projectId}/download`}
                className="flex-1 bg-white text-slate-900 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors"
              >
                <Download className="w-5 h-5" />
                ダウンロード
              </a>
              <Link
                href={`/voice/${projectId}/edit`}
                className="flex-1 bg-white/10 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-colors border border-white/20"
              >
                <Edit2 className="w-5 h-5" />
                編集・再生成
              </Link>
            </div>
          </div>
        ) : project.status === 'failed' ? (
          <div className="flex flex-col items-center text-center space-y-4 py-4">
            <AlertCircle className="w-10 h-10 text-red-300" />
            <p className="text-red-200 font-bold text-lg">音声生成に失敗しました</p>
            <Link
              href={`/voice/${projectId}/edit`}
              className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 className="w-5 h-5" />
              設定を修正して再生成
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center space-y-4 py-6 text-white/60">
            {project.status === 'generating' ? (
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-white/80" />
                <span className="text-lg font-bold text-white/80">音声を生成中...</span>
              </div>
            ) : (
              <p className="text-lg">音声がまだ生成されていません</p>
            )}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6">
        {/* ナレーションテキストカード */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <FileText className="w-5 h-5 text-violet-600" />
              ナレーションテキスト
            </h3>
            <span className="text-slate-400 text-sm">{project.inputText.length}文字</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 text-slate-700 leading-relaxed whitespace-pre-wrap">
            {project.inputText}
          </div>
        </div>

        {/* 音声設定カード */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
            <Settings className="w-5 h-5 text-violet-600" />
            音声設定
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* キャラクター */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">キャラクター</p>
              <div className="flex items-center gap-3">
                {speaker && (
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                    speaker.gender === 'male' ? 'bg-blue-500' : speaker.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
                  }`}>
                    {speaker.name[0]}
                  </div>
                )}
                <span className="font-bold text-slate-900">
                  {speaker?.name || project.speakerId}
                </span>
              </div>
            </div>

            {/* 話速 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">話速</p>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">{project.speed.toFixed(1)}x</span>
              </div>
            </div>

            {/* ピッチ */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">ピッチ</p>
              <div className="flex items-center gap-2">
                <Mic2 className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">{project.pitch > 0 ? '+' : ''}{project.pitch}st</span>
              </div>
            </div>

            {/* 音量 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">音量</p>
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">{project.volume}%</span>
              </div>
            </div>

            {/* 感情トーン */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">感情トーン</p>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">
                  {EMOTION_LABELS[project.emotionTone] || project.emotionTone}
                </span>
              </div>
            </div>

            {/* 句読点の間 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">句読点の間</p>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">
                  {PAUSE_LABELS[project.pauseLength] || project.pauseLength}
                </span>
              </div>
            </div>

            {/* 出力形式 */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-400 mb-2">出力形式</p>
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-slate-900">{project.outputFormat.toUpperCase()}</span>
              </div>
            </div>

            {/* 再生時間 */}
            {project.durationMs && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-2">再生時間</p>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span className="font-bold text-slate-900">{formatDuration(project.durationMs)}</span>
                </div>
              </div>
            )}

            {/* ファイルサイズ */}
            {project.fileSize && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-2">ファイルサイズ</p>
                <div className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-slate-400" />
                  <span className="font-bold text-slate-900">{formatFileSize(project.fileSize)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 素材・録音履歴 */}
        {project.recordings && project.recordings.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
              <Mic2 className="w-5 h-5 text-violet-600" />
              素材・録音履歴
            </h3>
            <div className="space-y-3">
              {project.recordings.map(rec => (
                <div key={rec.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => toggleRecordingPlay(rec)}
                      className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-violet-600 hover:bg-violet-50 transition-colors flex-shrink-0"
                    >
                      {playingRecId === rec.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {rec.label || `録音 ${rec.order + 1}`}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(rec.createdAt).toLocaleDateString('ja-JP')} ・ {formatDuration(rec.durationMs)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {rec.trimmedUrl && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wider">トリミング済</span>
                    )}
                    {rec.fileSize && (
                      <span className="text-xs text-slate-400">{formatFileSize(rec.fileSize)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* メタデータ（合成情報がある場合） */}
        {project.metadata && (project.metadata as any).mergeMode && (
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
              <Settings className="w-5 h-5 text-violet-600" />
              合成情報
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs text-slate-400 mb-2">合成モード</p>
                <span className="font-bold text-slate-900">
                  {(project.metadata as any).mergeMode === 'concat' ? '連結' : 'オーバーレイ'}
                </span>
              </div>
              {(project.metadata as any).mergedAt && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">合成日時</p>
                  <span className="font-bold text-slate-900">
                    {formatDate((project.metadata as any).mergedAt)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 削除確認モーダル */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setDeleteConfirmOpen(false)} onKeyDown={e => { if (e.key === 'Escape') setDeleteConfirmOpen(false) }}>
          <div className="bg-white rounded-2xl p-8 max-w-md mx-4 shadow-2xl" role="dialog" aria-modal="true" aria-label="プロジェクトの削除" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">プロジェクトの削除</h3>
              <p className="text-sm text-slate-600">このプロジェクトを削除しますか？この操作は取り消せません。</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {deleting ? '削除中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
