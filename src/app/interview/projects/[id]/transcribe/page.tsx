'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface TranscriptionSegment {
  index: number
  text: string
  speaker?: string
  start: number
  end: number
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
  const segmentsEndRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef(Date.now())

  // 経過時間カウンター
  useEffect(() => {
    if (currentStep === 'complete' || currentStep === 'error') return
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [currentStep])

  // セグメント追加時にスクロール
  useEffect(() => {
    segmentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments])

  // SSE接続
  useEffect(() => {
    if (!materialId) return

    const eventSource = new EventSource(`/api/interview/materials/${materialId}/transcribe-stream`)

    eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      setCurrentStep(data.step as TranscribeStep)
      setStatusMessage(data.message)
    })

    eventSource.addEventListener('segment', (e) => {
      const data = JSON.parse(e.data)
      setCurrentStep('streaming')
      setStatusMessage('文字起こし中...')
      setSegments(prev => [...prev, data])
    })

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data)
      setCurrentStep('complete')
      setStatusMessage('文字起こし完了!')
      setTranscriptionId(data.transcriptionId)
      setDurationMinutes(data.durationMinutes)
      setFullText(data.fullText)
      eventSource.close()
    })

    eventSource.addEventListener('error', (e) => {
      try {
        const data = JSON.parse((e as any).data)
        setErrorMessage(data.message || '文字起こしに失敗しました')
      } catch {
        setErrorMessage('接続が切断されました')
      }
      setCurrentStep('error')
      eventSource.close()
    })

    eventSource.onerror = () => {
      if (currentStep !== 'complete') {
        setErrorMessage('接続が切断されました。ページを更新してください。')
        setCurrentStep('error')
      }
      eventSource.close()
    }

    return () => eventSource.close()
  }, [materialId])

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

  const handleGoToEditor = () => {
    router.push(`/interview/projects/${projectId}/edit`)
  }

  const handleGoToGenerate = () => {
    router.push(`/interview/projects/${projectId}/generate`)
  }

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div className="max-w-4xl mx-auto">
      {/* ヘッダー */}
      <div className="mb-8">
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
            <p className="text-sm text-slate-500">リアルタイムで音声をテキストに変換しています</p>
          </div>
        </div>
      </div>

      {/* ステッププログレス */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-slate-700">進行状況</span>
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

        {/* 現在のステータスメッセージ */}
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
      </div>

      {/* 波形アニメーション（解析中） */}
      {(currentStep === 'analyzing' || currentStep === 'submitting') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 shadow-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[#7f19e6] text-lg">graphic_eq</span>
            <span className="text-sm font-bold text-slate-700">音声解析中</span>
          </div>
          <div className="flex items-end justify-center gap-[3px] h-16">
            {Array.from({ length: 40 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1.5 bg-gradient-to-t from-[#7f19e6] to-blue-400 rounded-full"
                animate={{
                  height: [8, Math.random() * 48 + 16, 8],
                }}
                transition={{
                  duration: 0.8 + Math.random() * 0.6,
                  repeat: Infinity,
                  delay: i * 0.03,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* 文字起こし結果（リアルタイム表示） */}
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
            <span className="text-xs font-bold text-slate-400">{segments.length} セグメント</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto p-4 space-y-3">
            <AnimatePresence>
              {segments.map((seg) => (
                <motion.div
                  key={seg.index}
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: 'auto' }}
                  transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                  className="flex gap-3"
                >
                  {/* タイムスタンプ */}
                  <div className="flex-shrink-0 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 tabular-nums bg-slate-50 px-1.5 py-0.5 rounded">
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
                    <p className="text-sm text-slate-700 leading-relaxed">{seg.text}</p>
                  </div>
                </motion.div>
              ))}
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
