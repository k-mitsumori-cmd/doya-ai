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

const MAX_RECONNECT_ATTEMPTS = 10
const RECONNECT_DELAY_MS = 3000

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
  const [reconnectCount, setReconnectCount] = useState(0)
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null)
  const [mediaCurrentTime, setMediaCurrentTime] = useState(0)
  const [isMediaPlaying, setIsMediaPlaying] = useState(false)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)

  const segmentsEndRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef(Date.now())
  const eventSourceRef = useRef<EventSource | null>(null)
  const isCompleteRef = useRef(false)
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // 経過時間カウンター
  useEffect(() => {
    if (currentStep === 'complete' || currentStep === 'error') return
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
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
      // 完了後はアクティブセグメントにスクロール
      if (currentStep === 'complete') {
        const el = segmentRefs.current.get(active)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [mediaCurrentTime, segments, activeSegmentIndex, currentStep])

  // メディア timeupdate
  const handleTimeUpdate = useCallback(() => {
    if (mediaRef.current) {
      setMediaCurrentTime(mediaRef.current.currentTime)
    }
  }, [])

  // セグメントクリックでメディアをシーク
  const handleSegmentClick = useCallback((seg: TranscriptionSegment) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seg.start
      if (mediaRef.current.paused) {
        mediaRef.current.play().catch(() => {})
      }
    }
  }, [])

  // SSE接続 (再接続対応)
  const connect = useCallback(() => {
    if (!materialId || isCompleteRef.current) return

    const eventSource = new EventSource(`/api/interview/materials/${materialId}/transcribe-stream`)
    eventSourceRef.current = eventSource

    eventSource.addEventListener('media', (e) => {
      const data = JSON.parse(e.data)
      setMediaInfo(data)
    })

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      setCurrentStep(data.step as TranscribeStep)
      setStatusMessage(data.message)
      if (data.reconnected) {
        setReconnectCount(0)
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
      setReconnectCount(0)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as any).data)
        if (data.retryable) {
          eventSource.close()
          setReconnectCount(prev => prev + 1)
          setStatusMessage('再接続中...')
          setTimeout(connect, RECONNECT_DELAY_MS)
          return
        }
        setErrorMessage(data.message || '文字起こしに失敗しました')
      } catch {
        setErrorMessage('接続が切断されました')
      }
      setCurrentStep('error')
      eventSource.close()
    })

    eventSource.onerror = () => {
      if (isCompleteRef.current) {
        eventSource.close()
        return
      }
      eventSource.close()

      setReconnectCount(prev => {
        const next = prev + 1
        if (next <= MAX_RECONNECT_ATTEMPTS) {
          setStatusMessage(`再接続中... (${next}/${MAX_RECONNECT_ATTEMPTS})`)
          setCurrentStep('analyzing')
          setTimeout(connect, RECONNECT_DELAY_MS)
        } else {
          setErrorMessage('接続が何度も切断されました。ページを更新してください。')
          setCurrentStep('error')
        }
        return next
      })
    }

    return () => eventSource.close()
  }, [materialId])

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
  const handleGoToGenerate = () => router.push(`/interview/projects/${projectId}/generate`)

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div className="max-w-5xl mx-auto">
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7f19e6] to-blue-600 flex items-center justify-center shadow-lg shadow-[#7f19e6]/20">
            <span className="material-symbols-outlined text-white text-2xl">mic</span>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">文字起こし</h1>
            <p className="text-sm text-slate-500">
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
              <span className="material-symbols-outlined text-4xl mb-2">videocam</span>
              <span className="text-sm font-bold">メディアを読み込み中...</span>
            </div>
          )}
        </div>

        {/* ステッププログレス */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-700">進行状況</span>
              {reconnectCount > 0 && currentStep !== 'error' && currentStep !== 'complete' && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  再接続 {reconnectCount}回
                </span>
              )}
            </div>
            <span className="text-sm font-bold text-slate-500 tabular-nums">{formatTime(elapsed)}</span>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center gap-1 mb-6">
            {STEP_ORDER.map((step, i) => {
              if (step === 'complete') return null
              const isActive = currentStepIndex === i
              const isDone = currentStepIndex > i
              const info = STEP_INFO[step]
              return (
                <div key={step} className="flex-1 flex flex-col items-center">
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
                  <span className={`text-[10px] font-bold mt-0.5 ${isDone ? 'text-[#7f19e6]' : isActive ? 'text-slate-700' : 'text-slate-300'}`}>
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
              <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
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
            <span className={`text-sm font-bold ${
              currentStep === 'error' ? 'text-red-600' : currentStep === 'complete' ? 'text-emerald-600' : 'text-slate-700'
            }`}>
              {currentStep === 'error' ? errorMessage : statusMessage}
            </span>
          </div>

          {/* 波形アニメーション（解析中、セグメント未到着） */}
          {(currentStep === 'analyzing' || currentStep === 'submitting') && segments.length === 0 && (
            <div className="mt-4 flex items-end justify-center gap-[3px] h-12">
              {Array.from({ length: 30 }).map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-gradient-to-t from-[#7f19e6] to-blue-400 rounded-full"
                  animate={{ height: [6, Math.random() * 36 + 12, 6] }}
                  transition={{
                    duration: 0.8 + Math.random() * 0.6,
                    repeat: Infinity,
                    delay: i * 0.03,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 文字起こし結果（リアルタイム表示 + セグメントクリックでシーク） */}
      {segments.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#7f19e6] text-lg">subtitles</span>
              <span className="text-sm font-bold text-slate-700">文字起こし結果</span>
            </div>
            <div className="flex items-center gap-3">
              {currentStep === 'complete' && (
                <span className="text-[10px] text-slate-400">クリックで再生位置にジャンプ</span>
              )}
              <span className="text-xs font-bold text-slate-400">{segments.length} セグメント</span>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
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
                    {/* タイムスタンプ */}
                    <div className="flex-shrink-0 pt-1">
                      <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
                        isActive ? 'bg-[#7f19e6] text-white' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {formatTimestamp(seg.start)}
                      </span>
                    </div>

                    {/* スピーカー & テキスト */}
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

                    {/* 再生中インジケーター */}
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
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-2xl">check</span>
                </div>
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
