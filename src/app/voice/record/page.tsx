'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { Mic, Square, Play, Pause, Trash2, Upload, Download, Loader2, Scissors, X, Check, AlertCircle, LogIn, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { isVoiceProFromUser } from '@/lib/voice/plans'

interface RecordingItem {
  id: string
  blob: Blob
  url: string
  durationMs: number
  label: string
  // トリミング済みの場合
  trimmedBlob?: Blob
  trimmedUrl?: string
  trimmedDurationMs?: number
  // サーバーに保存済みの場合
  serverId?: string
}

export default function RecordPage() {
  const { data: session } = useSession()
  const user = session?.user as any
  const isPro = isVoiceProFromUser(user)

  const [isRecording, setIsRecording] = useState(false)
  const [recordings, setRecordings] = useState<RecordingItem[]>([])
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [uploadSuccessId, setUploadSuccessId] = useState<string | null>(null)

  // トリミング状態
  const [trimmingId, setTrimmingId] = useState<string | null>(null)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(100)
  const [trimming, setTrimming] = useState(false)
  const [trimPreviewUrl, setTrimPreviewUrl] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const audioElRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const recordingsRef = useRef<RecordingItem[]>([])
  const trimPreviewUrlRef = useRef<string | null>(null)

  useEffect(() => { recordingsRef.current = recordings }, [recordings])
  useEffect(() => { trimPreviewUrlRef.current = trimPreviewUrl }, [trimPreviewUrl])

  // アンマウント時クリーンアップ
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
      audioElRef.current?.pause()
      recordingsRef.current.forEach(r => {
        URL.revokeObjectURL(r.url)
        if (r.trimmedUrl) URL.revokeObjectURL(r.trimmedUrl)
      })
      if (trimPreviewUrlRef.current) URL.revokeObjectURL(trimPreviewUrlRef.current)
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
      setError('マイクへのアクセスが許可されていません。ブラウザの設定からマイク権限を許可してください。')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  const togglePlay = (rec: RecordingItem) => {
    const playUrl = rec.trimmedUrl || rec.url
    if (playingId === rec.id) {
      audioElRef.current?.pause()
      setPlayingId(null)
      return
    }
    audioElRef.current?.pause()
    const audio = new Audio(playUrl)
    audio.play().catch(() => {
      setError('音声の再生に失敗しました')
    })
    audio.onended = () => setPlayingId(null)
    audioElRef.current = audio
    setPlayingId(rec.id)
  }

  const deleteRecording = (id: string) => {
    if (playingId === id) {
      audioElRef.current?.pause()
      setPlayingId(null)
    }
    if (trimmingId === id) {
      cancelTrim()
    }
    setRecordings(prev => {
      const rec = prev.find(r => r.id === id)
      if (rec) {
        URL.revokeObjectURL(rec.url)
        if (rec.trimmedUrl) URL.revokeObjectURL(rec.trimmedUrl)
      }
      return prev.filter(r => r.id !== id)
    })
  }

  const uploadRecording = async (rec: RecordingItem) => {
    setUploading(rec.id)
    setError(null)
    try {
      const uploadBlob = rec.trimmedBlob || rec.blob
      const uploadDuration = rec.trimmedDurationMs || rec.durationMs
      const formData = new FormData()
      formData.append('file', uploadBlob, `${rec.label}.webm`)
      formData.append('label', rec.label)
      formData.append('durationMs', String(uploadDuration))
      const res = await fetch('/api/voice/record/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'アップロードに失敗しました')
      } else {
        // サーバーIDを記録
        setRecordings(prev => prev.map(r =>
          r.id === rec.id ? { ...r, serverId: data.recordingId } : r
        ))
        setError(null)
        // 成功メッセージを一時的に表示
        setUploadSuccessId(rec.id)
        setTimeout(() => setUploadSuccessId(prev => prev === rec.id ? null : prev), 3000)
      }
    } catch {
      setError('アップロードに失敗しました。通信環境を確認してください。')
    } finally {
      setUploading(null)
    }
  }

  // --- トリミング機能 ---
  const openTrimmer = (rec: RecordingItem) => {
    // 再生中なら停止
    if (playingId) {
      audioElRef.current?.pause()
      setPlayingId(null)
    }
    setTrimmingId(rec.id)
    setTrimStart(0)
    setTrimEnd(100)
    if (trimPreviewUrl) {
      URL.revokeObjectURL(trimPreviewUrl)
      setTrimPreviewUrl(null)
    }
  }

  const cancelTrim = () => {
    setTrimmingId(null)
    setTrimStart(0)
    setTrimEnd(100)
    if (trimPreviewUrl) {
      URL.revokeObjectURL(trimPreviewUrl)
      setTrimPreviewUrl(null)
    }
  }

  const applyTrim = async () => {
    const rec = recordings.find(r => r.id === trimmingId)
    if (!rec) return

    setTrimming(true)
    setError(null)

    try {
      // AudioBuffer を使ってクライアントサイドでトリミング
      const audioCtx = new AudioContext()
      const arrayBuffer = await rec.blob.arrayBuffer()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      const startSec = (trimStart / 100) * audioBuffer.duration
      const endSec = (trimEnd / 100) * audioBuffer.duration
      const trimmedDuration = endSec - startSec

      if (trimmedDuration <= 0.1) {
        setError('トリミング範囲が短すぎます。範囲を広げてください。')
        setTrimming(false)
        return
      }

      const startSample = Math.floor(startSec * audioBuffer.sampleRate)
      const endSample = Math.floor(endSec * audioBuffer.sampleRate)
      const trimmedLength = endSample - startSample

      // トリミング済みAudioBufferを作成
      const trimmedBuffer = audioCtx.createBuffer(
        audioBuffer.numberOfChannels,
        trimmedLength,
        audioBuffer.sampleRate
      )

      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        const origData = audioBuffer.getChannelData(ch)
        const trimmedData = trimmedBuffer.getChannelData(ch)
        for (let i = 0; i < trimmedLength; i++) {
          trimmedData[i] = origData[startSample + i]
        }
      }

      // WAV形式にエンコード
      const wavBlob = audioBufferToWavBlob(trimmedBuffer)
      const trimmedUrl = URL.createObjectURL(wavBlob)
      const trimmedDurationMs = Math.round(trimmedDuration * 1000)

      // 前のtrimmedUrlを解放
      if (rec.trimmedUrl) URL.revokeObjectURL(rec.trimmedUrl)

      setRecordings(prev => prev.map(r =>
        r.id === rec.id
          ? { ...r, trimmedBlob: wavBlob, trimmedUrl, trimmedDurationMs }
          : r
      ))

      // サーバーに保存済みの場合はtrim APIを呼ぶ
      if (rec.serverId) {
        const formData = new FormData()
        formData.append('file', wavBlob, `${rec.label}_trimmed.wav`)
        formData.append('recordingId', rec.serverId)
        formData.append('durationMs', String(trimmedDurationMs))

        const res = await fetch('/api/voice/record/trim', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok || !data.success) {
          // サーバー保存は失敗してもローカルトリミングは成功扱い
          // Server trim failed silently — local trimming still succeeds
        }
      }

      await audioCtx.close()
      setTrimmingId(null)
      setTrimStart(0)
      setTrimEnd(100)
    } catch (err) {
      // Trim error handled by UI error state below
      setError('トリミングに失敗しました。音声データの形式を確認してください。')
    } finally {
      setTrimming(false)
    }
  }

  const playTrimPreview = async () => {
    const rec = recordings.find(r => r.id === trimmingId)
    if (!rec) return

    audioElRef.current?.pause()
    setPlayingId(null)

    try {
      const audioCtx = new AudioContext()
      const arrayBuffer = await rec.blob.arrayBuffer()
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

      const startSec = (trimStart / 100) * audioBuffer.duration
      const endSec = (trimEnd / 100) * audioBuffer.duration

      const source = audioCtx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtx.destination)
      source.start(0, startSec, endSec - startSec)

      source.onended = () => {
        audioCtx.close()
      }
    } catch {
      setError('プレビュー再生に失敗しました')
    }
  }

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    const tenth = Math.floor((ms % 1000) / 100)
    return `${m}:${sec.toString().padStart(2, '0')}.${tenth}`
  }

  const formatTimeSec = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    const ms = Math.round((sec % 1) * 10)
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`
  }

  if (!session?.user) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20 space-y-6">
        <div className="size-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
          <Mic className="w-10 h-10 text-violet-500" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-slate-900">クラウド録音スタジオ</h1>
          <p className="text-slate-500 mt-1">ログインして録音スタジオをご利用ください。</p>
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/voice/record' })}
          className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-600/20"
        >
          <LogIn className="w-4 h-4" />
          Googleでログイン
        </button>
      </div>
    )
  }

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto py-20 space-y-8">
        <div className="text-center space-y-2">
          <div className="size-20 rounded-full bg-violet-100 flex items-center justify-center mx-auto">
            <Mic className="w-10 h-10 text-violet-500" />
          </div>
          <h1 className="text-3xl font-black text-slate-900">クラウド録音スタジオ</h1>
          <p className="text-slate-500 mt-1">ブラウザで録音してAI音声と合成できます</p>
        </div>

        {/* Pro upgrade banner */}
        <div className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 p-6 text-white shadow-xl shadow-violet-600/20 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 size-48 bg-white/10 rounded-full blur-3xl" />
          <div className="relative flex items-center gap-5">
            <div className="size-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg">Proプランにアップグレード</p>
              <p className="text-white/80 text-sm">クラウド録音スタジオはProプランの機能です。ブラウザで直接録音し、AI音声と合成できます。</p>
            </div>
            <Link
              href="/voice/pricing"
              className="bg-white text-violet-600 px-6 py-2 rounded-lg font-black text-sm flex-shrink-0 hover:bg-violet-50 transition-colors"
            >
              アップグレード
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-slate-900">クラウド録音スタジオ</h1>
            {isPro && (
              <span className="bg-violet-100 text-violet-600 px-3 py-1 rounded-full text-xs font-bold border border-violet-200">
                PRO
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">ブラウザで録音してAI音声と合成できます</p>
        </div>
      </div>

      {/* 録音コントロール */}
      <div className="bg-[#1e1b4b] rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Waveform visualizer */}
        <div className="flex items-center justify-center">
          <canvas ref={canvasRef} width={800} height={120} className="w-full rounded-xl" />
        </div>

        {/* Timer + Status */}
        <div className="flex flex-col items-center justify-center mt-6 mb-6">
          <div className="font-mono text-5xl font-light text-violet-300 tracking-wider">
            {formatTime(elapsed)}
          </div>
          <p className="text-violet-400/60 text-sm mt-2 font-medium">
            {isRecording ? '録音中...' : recordings.length > 0 ? '録音完了' : '待機中'}
          </p>
        </div>

        {/* Record/Stop Button */}
        <div className="flex items-center justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/20'
            }`}
          >
            {isRecording ? (
              <><Square className="w-5 h-5" /> 録音を停止</>
            ) : (
              <><Mic className="w-5 h-5" /> 録音開始</>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-700 font-bold">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-500 hover:text-red-700 mt-1 font-bold">
              閉じる
            </button>
          </div>
        </div>
      )}

      {/* 録音済みリスト */}
      {recordings.length > 0 && (
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Mic className="w-5 h-5 text-violet-500" />
            録音済み ({recordings.length}件)
          </h2>
          <div className="space-y-3">
            {recordings.map(rec => (
              <div key={rec.id}>
                <div className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between hover:shadow-sm transition-shadow">
                  {/* Play button */}
                  <button
                    onClick={() => togglePlay(rec)}
                    className="size-10 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all flex-shrink-0"
                  >
                    {playingId === rec.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  {/* Recording info */}
                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-800">
                        {rec.label}
                      </p>
                      {rec.trimmedDurationMs != null && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                          トリミング済
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                      {rec.trimmedDurationMs != null
                        ? `${formatTime(rec.trimmedDurationMs)} (元: ${formatTime(rec.durationMs)})`
                        : formatTime(rec.durationMs)
                      }
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openTrimmer(rec)}
                      disabled={trimmingId === rec.id}
                      title="トリミング"
                      className="p-2 text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      <Scissors className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => uploadRecording(rec)}
                      disabled={uploading === rec.id}
                      title="クラウド保存"
                      className="p-2 text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      {uploading === rec.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    </button>
                    <a
                      href={rec.trimmedUrl || rec.url}
                      download={`${rec.label}.${rec.trimmedUrl ? 'wav' : 'webm'}`}
                      title="ダウンロード"
                      className="p-2 text-slate-400 hover:text-violet-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => deleteRecording(rec.id)}
                      title="削除"
                      className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* アップロード成功メッセージ */}
                {uploadSuccessId === rec.id && (
                  <div className="mt-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    クラウドに保存しました
                  </div>
                )}

                {/* トリミングUI */}
                {trimmingId === rec.id && (
                  <div className="mt-3 bg-violet-50 border border-violet-600/10 rounded-xl p-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-bold text-violet-900">トリミング編集</h3>
                      </div>
                      <button onClick={cancelTrim} className="p-1 text-violet-400 hover:text-violet-600 transition-colors rounded-lg hover:bg-violet-100">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* トリミング範囲バー（ビジュアル） */}
                    <div className="h-12 bg-white rounded-lg border border-slate-200 overflow-hidden relative">
                      <div
                        className="absolute h-full bg-violet-500/20 transition-all"
                        style={{
                          left: `${trimStart}%`,
                          width: `${trimEnd - trimStart}%`,
                        }}
                      />
                      <div
                        className="absolute h-full bg-violet-500 transition-all"
                        style={{
                          left: `${trimStart}%`,
                          width: `${trimEnd - trimStart}%`,
                          opacity: 0.3,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-mono text-violet-600 font-bold text-sm">
                          {formatTimeSec(((trimEnd - trimStart) / 100) * (rec.durationMs / 1000))}
                        </span>
                      </div>
                    </div>

                    {/* トリミング範囲表示 */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-violet-600 font-bold">
                        開始: {formatTimeSec((trimStart / 100) * (rec.durationMs / 1000))}
                      </span>
                      <span className="text-violet-400">
                        選択範囲: {formatTimeSec(((trimEnd - trimStart) / 100) * (rec.durationMs / 1000))}
                      </span>
                      <span className="font-mono text-violet-600 font-bold">
                        終了: {formatTimeSec((trimEnd / 100) * (rec.durationMs / 1000))}
                      </span>
                    </div>

                    {/* デュアルスライダー */}
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">開始位置</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={Math.max(trimEnd - 1, 0)}
                            step={0.5}
                            value={trimStart}
                            onChange={e => setTrimStart(Number(e.target.value))}
                            className="flex-1 accent-violet-600"
                          />
                          <span className="text-xs font-mono text-violet-700 w-12 text-right">{trimStart.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">終了位置</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={Math.min(trimStart + 1, 100)}
                            max={100}
                            step={0.5}
                            value={trimEnd}
                            onChange={e => setTrimEnd(Number(e.target.value))}
                            className="flex-1 accent-violet-600"
                          />
                          <span className="text-xs font-mono text-violet-700 w-12 text-right">{trimEnd.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* アクション */}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={playTrimPreview}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-violet-300 text-violet-700 rounded-lg text-sm font-bold hover:bg-violet-100 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" />
                        プレビュー
                      </button>
                      <button
                        onClick={cancelTrim}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        キャンセル
                      </button>
                      <button
                        onClick={applyTrim}
                        disabled={trimming || trimEnd - trimStart < 1}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {trimming ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> トリミング中...</>
                        ) : (
                          <><Check className="w-3.5 h-3.5" /> トリミング適用</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ヒント (empty state) */}
      {recordings.length === 0 && !isRecording && (
        <div className="text-center py-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
          <div className="size-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Mic className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm text-slate-500 font-bold">録音ボタンを押して録音を開始してください</p>
          <p className="text-xs text-slate-400 mt-1">録音後にトリミングやクラウド保存ができます</p>
        </div>
      )}
    </div>
  )
}

/**
 * AudioBuffer を WAV Blob に変換するヘルパー関数
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const length = buffer.length
  const bytesPerSample = 2 // 16-bit
  const blockAlign = numChannels * bytesPerSample
  const dataSize = length * blockAlign
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const arrayBuffer = new ArrayBuffer(totalSize)
  const view = new DataView(arrayBuffer)

  // WAV ヘッダー
  writeString(view, 0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)             // chunk size
  view.setUint16(20, 1, true)              // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)             // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  // PCM データ書き込み
  let offset = headerSize
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = buffer.getChannelData(ch)[i]
      const clamped = Math.max(-1, Math.min(1, sample))
      const int16 = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
      view.setInt16(offset, int16, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
