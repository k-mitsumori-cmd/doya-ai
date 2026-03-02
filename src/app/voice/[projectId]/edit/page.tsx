'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mic, Loader2, Save } from 'lucide-react'

export default function EditProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [speakerId, setSpeakerId] = useState('akira')
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [volume, setVolume] = useState(100)
  const [emotionTone, setEmotionTone] = useState('neutral')
  const [pauseLength, setPauseLength] = useState('standard')
  const [outputFormat, setOutputFormat] = useState('mp3')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/voice/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.project) {
          const p = data.project
          setName(p.name)
          setText(p.inputText)
          setSpeakerId(p.speakerId)
          setSpeed(p.speed)
          setPitch(p.pitch)
          setVolume(p.volume)
          setEmotionTone(p.emotionTone)
          if (p.pauseLength) setPauseLength(p.pauseLength)
          if (p.outputFormat) setOutputFormat(p.outputFormat)
        }
      })
      .finally(() => setLoading(false))
  }, [projectId])

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`/api/voice/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, inputText: text, speakerId, speed, pitch, volume, emotionTone, pauseLength, outputFormat }),
      })
    } finally {
      setSaving(false)
    }
  }

  const regenerate = async () => {
    setRegenerating(true)
    setError(null)
    try {
      await save()
      const res = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, text, speakerId, speed, pitch, volume, emotionTone, pauseLength, outputFormat }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || '再生成に失敗しました')
      } else {
        router.push(`/voice/${projectId}`)
      }
    } catch {
      setError('通信エラーが発生しました。再度お試しください。')
    } finally {
      setRegenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/voice/${projectId}`} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </Link>
        <h1 className="text-xl font-black text-slate-900">プロジェクトを編集</h1>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">プロジェクト名</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-bold text-slate-700">テキスト</label>
          <span className="text-xs text-slate-400 font-mono">{text.length}文字</span>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={10}
          className="w-full px-3 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none resize-none"
        />
      </div>

      {/* 話速・ピッチ */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-bold text-slate-700">話速</label>
            <span className="text-sm font-mono text-violet-600">{speed.toFixed(1)}x</span>
          </div>
          <input type="range" min={0.5} max={2.0} step={0.1} value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-sm font-bold text-slate-700">ピッチ</label>
            <span className="text-sm font-mono text-violet-600">{pitch > 0 ? `+${pitch}` : pitch}st</span>
          </div>
          <input type="range" min={-10} max={10} step={1} value={pitch}
            onChange={e => setPitch(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存
        </button>
        <button
          onClick={regenerate}
          disabled={regenerating || !text.trim()}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 text-white rounded-xl font-black text-sm transition-colors"
        >
          {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
          {regenerating ? '再生成中...' : '音声を再生成'}
        </button>
      </div>
    </div>
  )
}
