'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Play, Pause, Download, Edit2, Trash2, Star, ArrowLeft, Loader2 } from 'lucide-react'

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
  createdAt: string
  updatedAt: string
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

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/voice/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) setProject(data.project)
      })
      .finally(() => setLoading(false))
  }, [projectId])

  // アンマウント時に音声を停止
  useEffect(() => {
    return () => { audioEl?.pause() }
  }, [audioEl])

  const togglePlay = () => {
    if (project?.status !== 'completed') return
    if (playing) {
      audioEl?.pause()
      setPlaying(false)
      return
    }
    const audio = new Audio(`/api/voice/projects/${projectId}/download`)
    audio.play()
    audio.onended = () => setPlaying(false)
    setAudioEl(audio)
    setPlaying(true)
  }

  const toggleFavorite = async () => {
    if (!project) return
    await fetch(`/api/voice/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isFavorite: !project.isFavorite }),
    })
    setProject(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : prev)
  }

  const deleteProject = async () => {
    if (!confirm('このプロジェクトを削除しますか？')) return
    setDeleting(true)
    try {
      await fetch(`/api/voice/projects/${projectId}`, { method: 'DELETE' })
      router.push('/voice')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">プロジェクトが見つかりません</p>
        <Link href="/voice" className="mt-4 inline-block text-violet-600 font-bold hover:underline">
          ← ダッシュボードへ
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ヘッダー */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/voice" className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-900">{project.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {new Date(project.createdAt).toLocaleString('ja-JP')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-lg transition-colors ${project.isFavorite ? 'text-amber-400 bg-amber-50' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-50'}`}
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
            onClick={deleteProject}
            disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
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
                  {formatDuration(project.durationMs)} • {project.outputFormat.toUpperCase()} • {formatFileSize(project.fileSize)}
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
        ) : (
          <div className="text-center py-4 text-violet-300">
            音声がまだ生成されていません
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
          </div>
        )}
      </div>

      {/* テキスト */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-black text-slate-700 mb-3">ナレーションテキスト</h2>
        <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{project.inputText}</p>
      </div>

      {/* 音声設定 */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-black text-slate-700 mb-4">音声設定</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'キャラクター', value: project.speakerId },
            { label: '話速', value: `${project.speed}x` },
            { label: 'ピッチ', value: `${project.pitch > 0 ? '+' : ''}${project.pitch}st` },
            { label: '音量', value: `${project.volume}%` },
            { label: '感情トーン', value: project.emotionTone },
            { label: '出力形式', value: project.outputFormat.toUpperCase() },
          ].map(item => (
            <div key={item.label} className="bg-slate-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-sm font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
