'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  Play, Pause, Download, Edit2, Trash2, Star, ArrowLeft, Loader2,
  AlertCircle, Clock, FileAudio, Volume2, Zap, Mic2,
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
  generating: { label: '生成中...',  color: 'bg-blue-100 text-blue-700' },
  completed:  { label: '完成',       color: 'bg-green-100 text-green-700' },
  failed:     { label: 'エラー',     color: 'bg-red-100 text-red-700' },
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
  }, [projectId])

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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/voice" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">{project.name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              作成: {formatDate(project.createdAt)}
              {project.updatedAt !== project.createdAt && (
                <span className="ml-2">更新: {formatDate(project.updatedAt)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400 bg-amber-50' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-50'}`}
            title={project.isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
          >
            <Star className={`w-4 h-4 ${project.isFavorite ? 'fill-current' : ''}`} />
          </button>
          <Link
            href={`/voice/${projectId}/edit`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm font-bold hover:bg-violet-200 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            編集
          </Link>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            削除
          </button>
        </div>
      </div>

      {/* 音声プレイヤー */}
      <div className="bg-gradient-to-br from-violet-900 to-purple-900 rounded-2xl p-6 text-white">
        {project.status === 'completed' ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-black text-lg">{project.name}</p>
                <p className="text-violet-300 text-sm">
                  {formatDuration(project.durationMs)} ・ {project.outputFormat.toUpperCase()} ・ {formatFileSize(project.fileSize)}
                </p>
              </div>
              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
              </button>
            </div>
            <div className="w-full h-1.5 bg-white/20 rounded-full">
              <div className="w-0 h-full bg-violet-300 rounded-full" />
            </div>
          </div>
        ) : project.status === 'failed' ? (
          <div className="text-center py-4 space-y-2">
            <AlertCircle className="w-8 h-8 text-red-300 mx-auto" />
            <p className="text-red-200 font-bold">音声生成に失敗しました</p>
            <Link
              href={`/voice/${projectId}/edit`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              設定を修正して再生成
            </Link>
          </div>
        ) : (
          <div className="text-center py-4 text-violet-300">
            {project.status === 'generating' ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>音声を生成中...</span>
              </div>
            ) : (
              <p>音声がまだ生成されていません</p>
            )}
          </div>
        )}

        {project.status === 'completed' && (
          <div className="mt-4 flex gap-2">
            <a
              href={`/api/voice/projects/${projectId}/download`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              ダウンロード
            </a>
            <Link
              href={`/voice/${projectId}/edit`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              編集・再生成
            </Link>
          </div>
        )}
      </div>

      {/* テキスト */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-black text-slate-700 mb-3">ナレーションテキスト</h2>
        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{project.inputText}</p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>{project.inputText.length}文字</span>
        </div>
      </div>

      {/* 音声設定 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-black text-slate-700 mb-4">音声設定</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* キャラクター */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">キャラクター</p>
            <div className="flex items-center gap-2">
              {speaker && (
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                  speaker.gender === 'male' ? 'bg-blue-500' : speaker.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
                }`}>
                  {speaker.name[0]}
                </div>
              )}
              <p className="text-sm font-bold text-slate-900">
                {speaker?.name || project.speakerId}
              </p>
            </div>
            {speaker && (
              <p className="text-[10px] text-slate-500 mt-1">{speaker.description}</p>
            )}
          </div>

          {/* 話速 */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">話速</p>
            <p className="text-sm font-bold text-slate-900">{project.speed.toFixed(1)}x</p>
            <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full">
              <div
                className="h-full bg-violet-400 rounded-full"
                style={{ width: `${((project.speed - 0.5) / 1.5) * 100}%` }}
              />
            </div>
          </div>

          {/* ピッチ */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">ピッチ</p>
            <p className="text-sm font-bold text-slate-900">{project.pitch > 0 ? '+' : ''}{project.pitch}st</p>
            <div className="mt-1.5 w-full h-1.5 bg-slate-200 rounded-full">
              <div
                className="h-full bg-violet-400 rounded-full"
                style={{ width: `${((project.pitch + 10) / 20) * 100}%` }}
              />
            </div>
          </div>

          {/* 音量 */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">音量</p>
            <div className="flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">{project.volume}%</p>
            </div>
          </div>

          {/* 感情トーン */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">感情トーン</p>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">
                {EMOTION_LABELS[project.emotionTone] || project.emotionTone}
              </p>
            </div>
          </div>

          {/* 間（ポーズ） */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">句読点の間</p>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">
                {PAUSE_LABELS[project.pauseLength] || project.pauseLength}
              </p>
            </div>
          </div>

          {/* 出力形式 */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">出力形式</p>
            <div className="flex items-center gap-2">
              <FileAudio className="w-3.5 h-3.5 text-slate-400" />
              <p className="text-sm font-bold text-slate-900">{project.outputFormat.toUpperCase()}</p>
            </div>
          </div>

          {/* 再生時間 */}
          {project.durationMs && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">再生時間</p>
              <p className="text-sm font-bold text-slate-900">{formatDuration(project.durationMs)}</p>
            </div>
          )}

          {/* ファイルサイズ */}
          {project.fileSize && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">ファイルサイズ</p>
              <p className="text-sm font-bold text-slate-900">{formatFileSize(project.fileSize)}</p>
            </div>
          )}
        </div>
      </div>

      {/* 録音データ */}
      {project.recordings && project.recordings.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-violet-500" />
            録音データ ({project.recordings.length}件)
          </h2>
          <div className="space-y-2">
            {project.recordings.map(rec => (
              <div key={rec.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <button
                  onClick={() => toggleRecordingPlay(rec)}
                  className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 hover:bg-violet-200 transition-colors flex-shrink-0"
                >
                  {playingRecId === rec.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {rec.label || `録音 ${rec.order + 1}`}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDuration(rec.durationMs)}
                    {rec.fileSize ? ` ・ ${formatFileSize(rec.fileSize)}` : ''}
                    {rec.format ? ` ・ ${rec.format.toUpperCase()}` : ''}
                    {rec.trimmedUrl && (
                      <span className="ml-1 text-green-600 font-bold">トリミング済</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(rec.createdAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* メタデータ（合成情報がある場合） */}
      {project.metadata && (project.metadata as any).mergeMode && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-black text-slate-700 mb-3">合成情報</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">合成モード</p>
              <p className="text-sm font-bold text-slate-900">
                {(project.metadata as any).mergeMode === 'concat' ? '連結' : 'オーバーレイ'}
              </p>
            </div>
            {(project.metadata as any).mergedAt && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">合成日時</p>
                <p className="text-sm font-bold text-slate-900">
                  {formatDate((project.metadata as any).mergedAt)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deleteConfirmOpen && (
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
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={deleteProject}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-1"
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
