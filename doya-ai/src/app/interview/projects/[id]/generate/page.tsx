'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'

export default function GeneratePage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = params.id as string
  const recipeId = searchParams.get('recipeId') || ''
  const displayFormat = searchParams.get('displayFormat') || 'MONOLOGUE'
  const customInstructions = searchParams.get('instructions') || ''

  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState('')
  const [generatedText, setGeneratedText] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const [error, setError] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // 自動スクロール
  useEffect(() => {
    if (contentRef.current && status === 'generating') {
      contentRef.current.scrollTop = contentRef.current.scrollHeight
    }
  }, [generatedText, status])

  const startGeneration = async () => {
    if (!recipeId) {
      setError('スキルが選択されていません。前の画面に戻ってスキルを選択してください。')
      setStatus('error')
      return
    }

    setStatus('generating')
    setGeneratedText('')
    setError('')
    setProgress('接続中...')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/interview/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          recipeId,
          displayFormat,
          customInstructions: customInstructions || undefined,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      // SSE ストリームを読む
      const reader = res.body?.getReader()
      if (!reader) throw new Error('ストリーム読み取り失敗')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            switch (event.type) {
              case 'progress':
                setProgress(event.step)
                break
              case 'chunk':
                setGeneratedText((prev) => prev + event.text)
                break
              case 'done':
                setDraftId(event.draftId)
                setWordCount(event.wordCount)
                setStatus('done')
                // 記事内容を反映したサムネイルを自動再生成 (fire-and-forget)
                // API側でDBから最新ドラフトを自動取得して分析
                fetch(`/api/interview/projects/${projectId}/thumbnail`, {
                  method: 'POST',
                }).catch(() => {})
                break
              case 'error':
                setError(event.message)
                setStatus('error')
                break
            }
          } catch {
            // パース失敗は無視
          }
        }
      }

      // stream終了後にステータスが更新されていない場合
      if (status === 'generating') {
        setStatus('done')
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setStatus('idle')
        setProgress('キャンセルされました')
        return
      }
      setError(e.message || '記事生成に失敗しました')
      setStatus('error')
    }
  }

  const cancelGeneration = () => {
    abortRef.current?.abort()
  }

  // ページ読み込み時に自動開始
  useEffect(() => {
    if (recipeId && status === 'idle') {
      startGeneration()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* Material Symbols Outlined フォント読み込み */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />

      <div className="flex flex-1 -mx-4 md:-mx-8 -my-6 md:-my-8 h-[calc(100vh-4rem)] bg-[#f7f6f8] overflow-hidden">
        {/* Left Sidebar: Progress */}
        <aside className="w-80 border-r border-slate-200 bg-white p-6 overflow-y-auto hidden md:block">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">
              <span className="material-symbols-outlined text-sm">folder</span>
              <span>AI記事生成</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-1">記事を生成中</h3>
            <p className="text-slate-500 text-sm">
              {status === 'generating' && (progress || 'AI記事を生成中...')}
              {status === 'done' && `完了 — ${wordCount.toLocaleString()}文字`}
              {status === 'error' && 'エラーが発生しました'}
              {status === 'idle' && '準備中...'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold">生成進捗</span>
              <span className="text-[#7f19e6] text-sm font-bold">
                {status === 'done' ? '100' : status === 'generating' ? '75' : '0'}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-[#7f19e6] rounded-full transition-all duration-300"
                style={{ width: status === 'done' ? '100%' : status === 'generating' ? '75%' : '0%' }}
              />
            </div>

            {/* Vertical stepper */}
            <div className="space-y-6">
              {[
                { label: '文字起こし解析', stepStatus: 'completed' },
                { label: '構成マッピング', stepStatus: status === 'idle' ? 'pending' : 'completed' },
                { label: 'コンテンツ執筆', stepStatus: status === 'generating' ? 'active' : status === 'done' ? 'completed' : 'pending' },
                { label: '最終仕上げ', stepStatus: status === 'done' ? 'completed' : 'pending' },
              ].map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                      step.stepStatus === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                      step.stepStatus === 'active' ? 'border-[#7f19e6] text-[#7f19e6]' :
                      'border-slate-300'
                    }`}>
                      <span className="material-symbols-outlined text-sm">
                        {step.stepStatus === 'completed' ? 'check' : 'sync'}
                      </span>
                    </div>
                    {i < 3 && <div className="w-px h-full bg-slate-200 my-1" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold tracking-tight ${
                      step.stepStatus === 'active' ? 'text-[#7f19e6]' : 'text-slate-900'
                    }`}>{step.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons at bottom */}
          {status === 'generating' && (
            <button
              onClick={cancelGeneration}
              className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">cancel</span>
              キャンセル
            </button>
          )}
          {status === 'done' && draftId && (
            <button
              onClick={() => router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)}
              className="w-full px-4 py-2.5 bg-[#7f19e6] text-white rounded-lg text-sm font-medium hover:bg-[#6b12c9] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#7f19e6]/20"
            >
              <span className="material-symbols-outlined text-lg">edit_note</span>
              エディタで編集
            </button>
          )}
          {status === 'error' && (
            <button
              onClick={startGeneration}
              className="w-full px-4 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              再試行
            </button>
          )}
        </aside>

        {/* Main Canvas */}
        <main className="flex-1 p-8 overflow-y-auto relative">
          {/* Error display */}
          {status === 'error' && (
            <div className="max-w-[850px] mx-auto bg-red-50 text-red-600 rounded-xl px-5 py-4 text-sm border border-red-200 mb-6">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-xl">error</span>
                <div className="flex-1">
                  <p className="font-medium mb-1">エラーが発生しました</p>
                  <p className="text-red-500">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Document canvas */}
          <div
            ref={contentRef}
            className="max-w-[850px] mx-auto bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] p-16 relative"
          >
            {generatedText ? (
              <div className="space-y-2">
                {generatedText.split('\n').map((line, i) => {
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-900 mt-4 mb-2">{line.slice(4)}</h3>
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold tracking-tight text-slate-900 mt-6 mb-3">{line.slice(3)}</h2>
                  if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-extrabold tracking-tight text-slate-900 mt-6 mb-3">{line.slice(2)}</h1>
                  if (line.trim() === '') return <br key={i} />
                  return <p key={i} className="text-sm text-slate-700 leading-relaxed mb-1">{line}</p>
                })}
                {status === 'generating' && (
                  <span className="inline-block w-2 h-4 bg-[#7f19e6] animate-pulse ml-0.5" />
                )}
              </div>
            ) : (
              <motion.div
                className="space-y-8"
                animate={status === 'generating' ? { opacity: [0.5, 1, 0.5] } : {}}
                transition={status === 'generating' ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
              >
                <div className="border-b border-slate-100 pb-8">
                  <div className="h-8 w-3/4 bg-slate-100 rounded mb-4" />
                  <div className="flex items-center gap-6 mt-6">
                    <div className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                      {status === 'generating' ? 'AI Writing...' : '準備中'}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="h-4 w-full bg-slate-50 rounded" />
                  <div className="h-4 w-full bg-slate-50 rounded" />
                  <div className="h-4 w-3/4 bg-slate-50 rounded" />
                </div>
              </motion.div>
            )}
          </div>

          {/* Floating status bar */}
          <AnimatePresence>
          {status === 'generating' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/90 backdrop-blur-md px-6 py-3 rounded-full border border-slate-200 shadow-xl z-20">
              <div className="flex items-center gap-3 pr-4 border-r border-slate-200">
                <div className="w-2 h-2 rounded-full bg-[#7f19e6] animate-ping" />
                <span className="text-sm font-semibold">{progress || 'AIがコンテンツを執筆中...'}</span>
              </div>
              <button
                onClick={cancelGeneration}
                className="text-sm font-bold text-slate-600 hover:text-[#7f19e6] transition-colors"
              >
                停止
              </button>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Completion actions */}
          <AnimatePresence>
          {status === 'done' && (
            <motion.div
              className="max-w-[850px] mx-auto mt-6 flex gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <button
                onClick={() => router.push(`/interview/projects/${projectId}/skill`)}
                className="px-5 py-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                スキルを変えて再生成
              </button>
              <button
                onClick={() => router.push(`/interview/projects/${projectId}/edit?draftId=${draftId}`)}
                className="flex-1 px-5 py-3 bg-[#7f19e6] text-white rounded-lg text-sm font-medium hover:bg-[#6b12c9] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#7f19e6]/20"
              >
                <span className="material-symbols-outlined text-lg">edit_note</span>
                エディタで編集する
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            </motion.div>
          )}
          </AnimatePresence>
        </main>
      </div>
    </>
  )
}
