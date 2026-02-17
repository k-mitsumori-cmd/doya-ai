'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface TranscriptionSegment {
  index: number
  text: string
  speaker?: string
  start: number
  end: number
}

interface MediaInfo {
  url: string
  type: 'audio' | 'video'
  mimeType: string | null
  fileName: string | null
}

type TranscribeStep = 'init' | 'fetching' | 'submitting' | 'analyzing' | 'converting' | 'streaming' | 'complete' | 'error'

const STEP_INFO: Record<TranscribeStep, { icon: string; label: string; color: string }> = {
  init: { icon: 'hourglass_empty', label: '準備中', color: 'text-slate-400' },
  fetching: { icon: 'cloud_download', label: 'ファイル取得', color: 'text-blue-500' },
  submitting: { icon: 'send', label: 'AI送信', color: 'text-purple-500' },
  analyzing: { icon: 'graphic_eq', label: '音声解析', color: 'text-[#7f19e6]' },
  converting: { icon: 'text_fields', label: 'テキスト変換', color: 'text-cyan-500' },
  streaming: { icon: 'stream', label: '文字起こし中', color: 'text-emerald-500' },
  complete: { icon: 'check_circle', label: '完了', color: 'text-emerald-500' },
  error: { icon: 'error', label: 'エラー', color: 'text-red-500' },
}

const STEP_ORDER: TranscribeStep[] = ['init', 'fetching', 'submitting', 'analyzing', 'converting', 'streaming', 'complete']

// 解析中に表示するメッセージ（時間経過で切り替え）
const ANALYZING_MESSAGES = [
  { after: 0, text: '音声データを分析しています...' },
  { after: 10, text: '音声パターンを認識中...' },
  { after: 25, text: 'AIが音声を解析しています...' },
  { after: 45, text: '話者を識別しています...' },
  { after: 70, text: 'テキストに変換中...' },
  { after: 100, text: '高精度モードで処理中...' },
  { after: 140, text: 'もう少しで完了します...' },
  { after: 200, text: '長い音声ファイルを処理中...' },
  { after: 280, text: '最終処理を実行中...' },
]

const MAX_RECONNECT_ATTEMPTS = 20
const RECONNECT_BASE_DELAY_MS = 3000

export default function TranscribePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const projectId = params.id as string
  const materialId = searchParams.get('materialId')

  const [currentStep, setCurrentStep] = useState<TranscribeStep>('init')
  const [statusMessage, setStatusMessage] = useState('接続中...')
  const [elapsed, setElapsed] = useState(0)
  const [segments, setSegments] = useState<TranscriptionSegment[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null)
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null)
  const [fullText, setFullText] = useState('')
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [mediaCurrentTime, setMediaCurrentTime] = useState(0)
  const [isMediaPlaying, setIsMediaPlaying] = useState(false)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)

  const segmentsEndRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef(Date.now())
  const eventSourceRef = useRef<EventSource | null>(null)
  const isCompleteRef = useRef(false)
  const isReconnectingRef = useRef(false)
  const reconnectCountRef = useRef(0)
  const connectRef = useRef<() => void>()
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // 経過時間カウンター + 解析中メッセージ自動更新
  useEffect(() => {
    if (currentStep === 'complete' || currentStep === 'error') return
    const timer = setInterval(() => {
      const sec = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsed(sec)
      // 解析中のメッセージを経過時間に応じて更新
      if (currentStep === 'analyzing') {
        const msg = [...ANALYZING_MESSAGES].reverse().find(m => sec >= m.after)
        if (msg) setStatusMessage(msg.text)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [currentStep])

  // セグメント追加時にスクロール (文字起こし中のみ)
  useEffect(() => {
    if (currentStep === 'streaming' || currentStep === 'converting') {
      segmentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [segments, currentStep])

  // メディア再生位置に応じてアクティブセグメントをハイライト
  useEffect(() => {
    if (segments.length === 0) return
    const active = segments.findIndex(
      (s) => mediaCurrentTime >= s.start && mediaCurrentTime < s.end
    )
    if (active !== -1 && active !== activeSegmentIndex) {
      setActiveSegmentIndex(active)
      if (currentStep === 'complete') {
        const el = segmentRefs.current.get(active)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [mediaCurrentTime, segments, activeSegmentIndex, currentStep])

  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) setMediaCurrentTime(mediaRef.current.currentTime)
  }, [])

  const handleSegmentClick = useCallback((seg: TranscriptionSegment) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seg.start
      if (mediaRef.current.paused) mediaRef.current.play().catch(() => {})
    }
  }, [])

  // SSE接続 (再接続は完全透過 — UIに影響を与えない)
  const connect = useCallback(() => {
    if (!materialId || isCompleteRef.current) return

    function scheduleReconnect() {
      if (isCompleteRef.current || isReconnectingRef.current) return
      isReconnectingRef.current = true

      const count = ++reconnectCountRef.current

      if (count > MAX_RECONNECT_ATTEMPTS) {
        setErrorMessage('処理に失敗しました。もう一度お試しください。')
        setCurrentStep('error')
        isReconnectingRef.current = false
        return
      }

      // 再接続は透過的 — ステップやメッセージを変更しない
      // analyzing のままキープすることでUIの連続性を保つ
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(1.5, count - 1), 15000)

      setTimeout(() => {
        isReconnectingRef.current = false
        connectRef.current?.()
      }, delay)
    }

    const eventSource = new EventSource(`/api/interview/materials/${materialId}/transcribe-stream`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('media', (e) => {
      const data = JSON.parse(e.data)
      setMediaInfo(data)
    })

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      // 再接続時の status イベントではステップを戻さない
      // (例: analyzing → init に戻らないようにする)
      const newStep = data.step as TranscribeStep
      setCurrentStep(prev => {
        const prevIdx = STEP_ORDER.indexOf(prev)
        const newIdx = STEP_ORDER.indexOf(newStep)
        // 完了・エラー以外は、進行方向のみ許可（後退しない）
        if (prev === 'complete' || prev === 'error') return prev
        if (reconnectCountRef.current > 0 && newIdx < prevIdx) return prev
        return newStep
      })
      if (!data.reconnected) {
        setStatusMessage(data.message)
      }
      if (data.reconnected) {
        reconnectCountRef.current = 0
      }
    })

    eventSource.addEventListener('segment', (e) => {
      const data = JSON.parse(e.data)
      setCurrentStep('streaming')
      setStatusMessage('文字起こし中...')
      setSegments(prev => {
        if (prev.some(s => s.index === data.index)) return prev
        return [...prev, data]
      })
    })

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      isCompleteRef.current = true
      setCurrentStep('complete')
      setStatusMessage('文字起こし完了!')
      setTranscriptionId(data.transcriptionId)
      setDurationMinutes(data.durationMinutes)
      setFullText(data.fullText)
      reconnectCountRef.current = 0
      eventSource.close()
    })

    // "fail" イベント — サーバーからのエラー通知
    // ※ "error" ではなく "fail" を使用: EventSourceのネイティブ onerror と衝突を避けるため
    eventSource.addEventListener('fail', (e) => {
      const data = JSON.parse(e.data)
      if (data.retryable) {
        eventSource.close()
        scheduleReconnect()
        return
      }
      // 非再試行エラー — 最終エラーとして表示、再接続しない
      isCompleteRef.current = true
      setErrorMessage(data.message || '文字起こしに失敗しました')
      setCurrentStep('error')
      eventSource.close()
    })

    // ネイティブ接続エラー (ネットワーク切断, Vercelタイムアウト等)
    eventSource.onerror = () => {
      if (isCompleteRef.current) {
        eventSource.close()
        return
      }
      eventSource.close()
      scheduleReconnect()
    }

    return () => eventSource.close()
  }, [materialId])

  connectRef.current = connect

  useEffect(() => {
    const cleanup = connect()
    return () => {
      cleanup?.()
      eventSourceRef.current?.close()
    }
  }, [connect])

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleGoToEditor = () => router.push(`/interview/projects/${projectId}/edit`)
  const handleGoToGenerate = () => router.push(`/interview/projects/${projectId}/skill`)

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)
  const isProcessing = currentStep !== 'complete' && currentStep !== 'error'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-0">
      {/* ヘッダー */}
      <div className="mb-6">
        <button
          onClick={() => router.push(`/interview/projects/${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          プロジェクトに戻る
        </button>
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-blue-600 flex items-center justify-center shadow-lg shadow-[#7f19e6]/20">
              <span className="material-symbols-outlined text-white text-xl sm:text-2xl">mic</span>
            </div>
            {/* 処理中パルス */}
            {isProcessing && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-[#7f19e6]"
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                />
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-[#7f19e6]"
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
                />
              </>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">文字起こし</h1>
            <p className="text-sm text-slate-500 truncate">
              {mediaInfo?.fileName || 'リアルタイムで音声をテキストに変換しています'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">1回の文字起こし上限: 約3時間（180分）</p>
          </div>
        </div>
      </div>

      {/* メディアプレーヤー + ステッププログレス */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* メディアプレーヤー */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {mediaInfo ? (
            <div>
              {mediaInfo.type === 'video' ? (
                <video
                  ref={(el) => { mediaRef.current = el }}
                  src={mediaInfo.url}
                  controls
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsMediaPlaying(true)}
                  onPause={() => setIsMediaPlaying(false)}
                  className="w-full aspect-video bg-black"
                  playsInline
                />
              ) : (
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                      isMediaPlaying
                        ? 'bg-gradient-to-br from-[#7f19e6] to-blue-600 shadow-lg shadow-[#7f19e6]/30'
                        : 'bg-slate-100'
                    }`}>
                      <span className={`material-symbols-outlined text-2xl ${isMediaPlaying ? 'text-white' : 'text-slate-400'}`}>
                        {isMediaPlaying ? 'graphic_eq' : 'audio_file'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-700 truncate">{mediaInfo.fileName || '音声ファイル'}</p>
                      <p className="text-xs text-slate-400">
                        {isMediaPlaying ? '再生中' : '一時停止'}
                        {mediaRef.current?.duration ? ` — ${formatTimestamp(mediaRef.current.duration)}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* 波形風の装飾 */}
                  {isMediaPlaying && (
                    <div className="flex items-end justify-center gap-[2px] h-10 mb-4">
                      {Array.from({ length: 30 }).map((_, i) => (
                        <motion.div
                          key={i}
                          className="w-1 bg-gradient-to-t from-[#7f19e6] to-blue-400 rounded-full"
                          animate={{ height: [4, Math.random() * 32 + 8, 4] }}
                          transition={{
                            duration: 0.6 + Math.random() * 0.4,
                            repeat: Infinity,
                            delay: i * 0.02,
                            ease: 'easeInOut',
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <audio
                    ref={(el) => { mediaRef.current = el }}
                    src={mediaInfo.url}
                    controls
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsMediaPlaying(true)}
                    onPause={() => setIsMediaPlaying(false)}
                    className="w-full"
                  />
                </div>
              )}
              {/* 再生位置表示 */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">
                  <span className="material-symbols-outlined text-[14px] mr-1 align-middle">schedule</span>
                  {formatTimestamp(mediaCurrentTime)}
                </span>
                {activeSegmentIndex !== null && segments[activeSegmentIndex] && (
                  <span className="text-xs text-slate-400 truncate max-w-[60%]">
                    {segments[activeSegmentIndex].speaker && (
                      <span className="font-bold text-[#7f19e6] mr-1">話者{segments[activeSegmentIndex].speaker}</span>
                    )}
                    {segments[activeSegmentIndex].text.slice(0, 40)}...
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col items-center justify-center h-48 text-slate-400">
              <motion.span
                className="material-symbols-outlined text-4xl mb-2"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                videocam
              </motion.span>
              <span className="text-sm font-bold">メディアを読み込み中...</span>
            </div>
          )}
        </div>

        {/* ステッププログレス */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-slate-700">進行状況</span>
            <span className="text-sm font-bold text-slate-500 tabular-nums">{formatTime(elapsed)}</span>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto">
            {STEP_ORDER.map((step, i) => {
              if (step === 'complete') return null
              const isActive = currentStepIndex === i
              const isDone = currentStepIndex > i
              const info = STEP_INFO[step]
              return (
                <div key={step} className="flex-1 flex flex-col items-center min-w-[48px]">
                  <div className={`w-full h-1.5 rounded-full mb-2 transition-all duration-500 ${
                    isDone ? 'bg-[#7f19e6]' : isActive ? 'bg-[#7f19e6]/50' : 'bg-slate-100'
                  }`}>
                    {isActive && (
                      <motion.div
                        className="h-full rounded-full bg-[#7f19e6]"
                        initial={{ width: '0%' }}
                        animate={{ width: '60%' }}
                        transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
                      />
                    )}
                  </div>
                  <span className={`material-symbols-outlined text-[14px] ${isDone ? 'text-[#7f19e6]' : isActive ? info.color : 'text-slate-300'}`}>
                    {isDone ? 'check_circle' : info.icon}
                  </span>
                  <span className={`text-[10px] font-bold mt-0.5 whitespace-nowrap ${isDone ? 'text-[#7f19e6]' : isActive ? 'text-slate-700' : 'text-slate-300'}`}>
                    {info.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* ステータスメッセージ */}
          <div className="flex items-center gap-3">
            {currentStep === 'error' ? (
              <span className="material-symbols-outlined text-red-500 text-xl">error</span>
            ) : currentStep === 'complete' ? (
              <motion.span
                className="material-symbols-outlined text-emerald-500 text-xl"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 10 }}
              >
                check_circle
              </motion.span>
            ) : (
              <div className="relative w-5 h-5">
                <div className="absolute inset-0 rounded-full border-2 border-[#7f19e6]/20" />
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-[#7f19e6] border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            )}
            <AnimatePresence mode="wait">
              <motion.span
                key={statusMessage}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3 }}
                className={`text-sm font-bold ${
                  currentStep === 'error' ? 'text-red-600' : currentStep === 'complete' ? 'text-emerald-600' : 'text-slate-700'
                }`}
              >
                {currentStep === 'error' ? errorMessage : statusMessage}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* 解析中ビジュアライザー */}
          {(currentStep === 'analyzing' || currentStep === 'submitting' || currentStep === 'init' || currentStep === 'fetching') && segments.length === 0 && (
            <div className="mt-5">
              {/* 波形アニメーション */}
              <div className="flex items-end justify-center gap-[2px] h-14 mb-3">
                {Array.from({ length: 40 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full"
                    style={{
                      background: `linear-gradient(to top, #7f19e6, ${i % 3 === 0 ? '#3b82f6' : i % 3 === 1 ? '#a855f7' : '#6366f1'})`,
                    }}
                    animate={{
                      height: [4, Math.random() * 40 + 14, 6, Math.random() * 30 + 8, 4],
                    }}
                    transition={{
                      duration: 1.2 + Math.random() * 0.8,
                      repeat: Infinity,
                      delay: i * 0.025,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              {/* 処理中の追加インジケーター */}
              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-[#7f19e6]"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span>AI処理中</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-blue-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span>音声認識</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-purple-500"
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span>話者分離</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 文字起こし結果 */}
      {segments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <span className="material-symbols-outlined text-[#7f19e6] text-lg">subtitles</span>
              <span className="text-sm font-bold text-slate-700">文字起こし結果</span>
              {isProcessing && (
                <motion.div
                  className="flex items-center gap-[2px]"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {[0, 1, 2].map((j) => (
                    <motion.div
                      key={j}
                      className="w-1 bg-[#7f19e6] rounded-full"
                      animate={{ height: [3, 10, 3] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: j * 0.12, ease: 'easeInOut' }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {currentStep === 'complete' && (
                <span className="text-[10px] text-slate-400 hidden sm:inline">クリックで再生位置にジャンプ</span>
              )}
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">{segments.length} セグメント</span>
            </div>
          </div>

          <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto p-3 sm:p-4 space-y-2">
            <AnimatePresence>
              {segments.map((seg) => {
                const isActive = activeSegmentIndex === seg.index
                return (
                  <motion.div
                    key={seg.index}
                    ref={(el) => { if (el) segmentRefs.current.set(seg.index, el) }}
                    initial={{ opacity: 0, x: -20, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    onClick={() => handleSegmentClick(seg)}
                    className={`flex gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#7f19e6]/5 border border-[#7f19e6]/20 shadow-sm'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex-shrink-0 pt-1">
                      <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-[#7f19e6] text-white' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {formatTimestamp(seg.start)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      {seg.speaker && (
                        <span className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded-full mb-1 ${
                          seg.speaker === 'A' ? 'bg-blue-100 text-blue-600' :
                          seg.speaker === 'B' ? 'bg-emerald-100 text-emerald-600' :
                          'bg-purple-100 text-purple-600'
                        }`}>
                          話者{seg.speaker}
                        </span>
                      )}
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-slate-900 font-medium' : 'text-slate-700'}`}>
                        {seg.text}
                      </p>
                    </div>

                    {isActive && isMediaPlaying && (
                      <div className="flex-shrink-0 flex items-center gap-[2px] pt-1">
                        {[0, 1, 2].map((j) => (
                          <motion.div
                            key={j}
                            className="w-0.5 bg-[#7f19e6] rounded-full"
                            animate={{ height: [4, 14, 4] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: j * 0.15, ease: 'easeInOut' }}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
            <div ref={segmentsEndRef} />
          </div>
        </motion.div>
      )}

      {/* 完了カード */}
      <AnimatePresence>
        {currentStep === 'complete' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2, damping: 10 }}
                >
                  <span className="material-symbols-outlined text-white text-2xl">check</span>
                </motion.div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">文字起こし完了</h2>
                  <p className="text-sm text-slate-600">
                    {durationMinutes ? `${durationMinutes}分の音声を` : ''}
                    {segments.length}セグメントに変換しました（{formatTime(elapsed)}）
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGoToGenerate}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-[#7f19e6] to-blue-600 hover:from-[#152e70] hover:to-blue-700 shadow-lg shadow-[#7f19e6]/20 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                  AI記事を生成する
                </button>
                <button
                  onClick={handleGoToEditor}
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">edit_note</span>
                  エディタで確認
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* エラーカード */}
      <AnimatePresence>
        {currentStep === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-white rounded-2xl border border-red-200 shadow-sm p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-2xl">error</span>
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">エラーが発生しました</h2>
                <p className="text-sm text-red-600">{errorMessage}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-bold text-white bg-[#7f19e6] hover:bg-[#6b12c9] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                もう一度試す
              </button>
              <button
                onClick={() => router.push(`/interview/projects/${projectId}`)}
                className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                プロジェクトに戻る
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
