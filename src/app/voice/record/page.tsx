'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Mic, Square, Play, Pause, Trash2, Upload, Download, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface RecordingItem {
  id: string
  blob: Blob
  url: string
  durationMs: number
  label: string
}

export default function RecordPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = ['PRO', 'ENTERPRISE', 'BUSINESS', 'STARTER', 'BUNDLE'].includes(
    String(user?.voicePlan || user?.plan || '').toUpperCase()
  )

  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const recordingsRef = useRef<RecordingItem[]>([])

  useEffect(() => { recordingsRef.current = recordings }, [recordings])

  // アンマウント時クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      audioElRef.current?.pause()
      recordingsRef.current.forEach(r => URL.revokeObjectURL(r.url))
    }
  }, [])

  // 波形描画
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    ctx.fillStyle = '#1e1b4b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineWidth = 2
    ctx.strokeStyle = '#a78bfa'
    ctx.beginPath()

    const sliceWidth = canvas.width / bufferLength
    let x = 0
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * canvas.height) / 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      x += sliceWidth
    }
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()
    animFrameRef.current = requestAnimationFrame(drawWaveform)
  }, [])

  const startRecording = async () => {
    if (!isPro) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        const durationMs = Date.now() - startTimeRef.current
        setRecordings(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          blob,
          url,
          durationMs,
          label: `録音 ${prev.length + 1}`,
        }])
        stream.getTracks().forEach(t => t.stop())
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      }

      mediaRecorder.start()
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 100)
      drawWaveform()
    } catch {
      setError('マイクへのアクセスが許可されていません')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const togglePlay = (rec: RecordingItem) => {
    if (playingId === rec.id) {
      audioElRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioElRef.current?.pause()
    const audio = new Audio(rec.url)
    audio.play()
    audio.onended = () => setPlayingId(null)
    audioElRef.current = audio
    setPlayingId(rec.id)
  }

  const deleteRecording = (id: string) => {
    if (playingId === id) {
      audioElRef.current?.pause()
      setPlayingId(null)
    }
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id)
      if (rec) URL.revokeObjectURL(rec.url)
      return prev.filter(r => r.id !== id)
    })
  }

  const uploadRecording = async (rec: RecordingItem) => {
    setUploading(rec.id)
    try {
      const formData = new FormData()
      formData.append('file', rec.blob, `${rec.label}.webm`)
      formData.append('label', rec.label)
      formData.append('durationMs', String(rec.durationMs))
      const res = await fetch('/api/voice/record/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!data.success) setError(data.error || 'アップロードに失敗しました')
      else alert('アップロード完了しました！')
    } catch {
      setError('アップロードに失敗しました')
    } finally {
      setUploading(null)
    }
  }

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    const tenth = Math.floor((ms % 1000) / 100)
    return `${m}:${sec.toString().padStart(2, '0')}.${tenth}`
  }

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-4">
        <div className="text-6xl">🎙️</div>
        <h1 className="text-2xl font-black text-slate-900">クラウド録音スタジオ</h1>
        <p className="text-slate-600">クラウド録音スタジオはProプランの機能です。<br />ブラウザで直接録音し、AI音声と合成できます。</p>
        <Link
          href="/voice/pricing"
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-black hover:bg-violet-700 transition-colors"
        >
          Proプランにアップグレード →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">クラウド録音スタジオ</h1>
        <p className="text-sm text-slate-500 mt-1">ブラウザで録音してAI音声と合成できます</p>
      </div>

      {/* 録音コントロール */}
      <div className="bg-[#1e1b4b] rounded-2xl p-6 space-y-4">
        <canvas ref={canvasRef} width={800} height={100} className="w-full rounded-xl" />

        <div className="flex items-center justify-between">
          <div className="text-violet-300 font-mono text-xl font-bold">
            {formatTime(elapsed)}
          </div>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-base transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-violet-500 hover:bg-violet-600 text-white'
            }`}
          >
            {isRecording ? (
              <><Square className="w-5 h-5" /> 停止</>
            ) : (
              <><Mic className="w-5 h-5" /> 録音開始</>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* 録音済みリスト */}
      {recordings.length > 0 && (
        <div>
          <h2 className="text-base font-black text-slate-900 mb-3">録音済み ({recordings.length}件)</h2>
          <div className="space-y-2">
            {recordings.map(rec => (
              <div key={rec.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200">
                <button
                  onClick={() => togglePlay(rec)}
                  className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 hover:bg-violet-200 transition-colors"
                >
                  {playingId === rec.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">{rec.label}</p>
                  <p className="text-xs text-slate-400">{formatTime(rec.durationMs)}</p>
                </div>
                <button
                  onClick={() => uploadRecording(rec)}
                  disabled={uploading === rec.id}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  {uploading === rec.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  保存
                </button>
                <a href={rec.url} download={`${rec.label}.webm`}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Download className="w-3 h-3" />
                  DL
                </a>
                <button onClick={() => deleteRecording(rec.id)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
