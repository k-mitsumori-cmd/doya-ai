'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Loader2, Sparkles, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { Suspense } from 'react'

interface SectionCopy {
  id?: string
  order: number
  type: string
  name: string
  headline?: string | null
  subheadline?: string | null
  body?: string | null
  ctaText?: string | null
  ctaUrl?: string | null
  items?: Array<{ title?: string; description?: string }> | null
}

interface BrushupModal {
  sectionId: string
  sectionName: string
  currentCopy: { headline?: string | null; body?: string | null }
  instruction: string
}

function CopyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [sections, setSections] = useState<SectionCopy[]>([])
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, sectionName: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [brushupModal, setBrushupModal] = useState<BrushupModal | null>(null)
  const [brushupLoading, setBrushupLoading] = useState(false)
  const hasGenerated = useRef(false)

  const generate = useCallback(async () => {
    if (!projectId || hasGenerated.current) return
    hasGenerated.current = true
    setGenerating(true)
    setError('')

    try {
      // プロジェクトの情報を取得
      const projRes = await fetch(`/api/lp/projects/${projectId}`)
      const projData = await projRes.json()
      const project = projData.project
      if (!project) throw new Error('プロジェクトが見つかりません')

      // 既にセクションがある場合はそれを使用
      if (project.sections && project.sections.length > 0) {
        setSections(project.sections.map((s: any, i: number) => ({ ...s, order: i })))
        setGenerating(false)
        return
      }

      // スケルトン用に構成案のセクションをセット
      const structure = project.structures?.[project.selectedStructure ?? 0]
      if (structure?.sections) {
        setSections(structure.sections.map((s: any, i: number) => ({
          order: i,
          type: s.type,
          name: s.name,
        })))
        setProgress({ current: 0, total: structure.sections.length, sectionName: '' })
      }

      // SSEでコピー生成
      const response = await fetch('/api/lp/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) throw new Error('ストリームの取得に失敗しました')

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'progress') {
              setProgress({ current: data.current, total: data.total, sectionName: data.sectionName })
            }
            if (data.type === 'section') {
              setSections(prev => {
                const next = [...prev]
                const idx = next.findIndex(s => s.name === data.section.name || s.order === data.section.order)
                if (idx >= 0) next[idx] = { ...next[idx], ...data.section }
                else next.push(data.section)
                return next
              })
            }
            if (data.type === 'error') throw new Error(data.message)
          } catch (e: any) {
            if (e.message && !e.message.includes('Unexpected token')) throw e
          }
        }
      }
    } catch (e: any) {
      setError(e.message || '生成に失敗しました')
      hasGenerated.current = false
    } finally {
      setGenerating(false)
    }
  }, [projectId])

  useEffect(() => {
    generate()
  }, [generate])

  const handleBrushup = async () => {
    if (!brushupModal || !projectId) return
    setBrushupLoading(true)
    try {
      const res = await fetch('/api/lp/brushup-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sectionId: brushupModal.sectionId,
          instruction: brushupModal.instruction,
        }),
      })
      const data = await res.json()
      if (data.section) {
        setSections(prev =>
          prev.map(s => (s.id === brushupModal.sectionId ? { ...s, ...data.section } : s))
        )
      }
      setBrushupModal(null)
    } catch (e: any) {
      alert(e.message || 'ブラッシュアップに失敗しました')
    } finally {
      setBrushupLoading(false)
    }
  }

  const handleNext = async () => {
    if (!projectId || sections.length === 0) return
    setSaving(true)
    try {
      router.push(`/lp/new/design?projectId=${projectId}`)
    } finally {
      setSaving(false)
    }
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            {['商品情報入力', '構成案選択', 'コピー確認', 'デザイン選択'].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-700" />}
                <div className={`flex items-center gap-1.5 ${i === 2 ? 'text-cyan-400' : i < 2 ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 2 ? 'bg-cyan-500 text-slate-950' : i < 2 ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    {i < 2 ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-white mb-2">コピーを確認・編集してください</h1>
        <p className="text-slate-400 text-sm mb-6">AIが各セクションのコピーを生成しました。気に入らない箇所は「ブラッシュアップ」ボタンで改善できます。</p>

        {/* プログレスバー */}
        {generating && progress.total > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-cyan-400 font-medium">
                {progress.sectionName ? `「${progress.sectionName}」を生成中...` : 'コピーを生成中...'}
              </span>
              <span className="text-slate-500">{progress.current} / {progress.total}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => { hasGenerated.current = false; generate() }}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mx-auto"
            >
              <RefreshCw className="w-4 h-4" /> 再生成する
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sections.map((sec, i) => {
              const isLoaded = !!sec.headline || !!sec.body
              const isExpanded = expandedIdx === i

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl border transition-colors ${isLoaded ? 'border-slate-700 bg-slate-900' : 'border-slate-800 bg-slate-900/50'}`}
                >
                  {/* カードヘッダー */}
                  <div
                    className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  >
                    <span className="text-xs text-slate-500 w-6 text-center font-bold">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white truncate">{sec.name}</span>
                        {!isLoaded && generating && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400 flex-shrink-0" />
                        )}
                      </div>
                      {isLoaded && !isExpanded && (
                        <p className="text-xs text-slate-500 truncate mt-0.5">{sec.headline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isLoaded && sec.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setBrushupModal({
                              sectionId: sec.id!,
                              sectionName: sec.name,
                              currentCopy: { headline: sec.headline, body: sec.body },
                              instruction: '',
                            })
                          }}
                          className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-700 hover:border-cyan-500 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          ブラッシュアップ
                        </button>
                      )}
                      {isLoaded ? (
                        isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <div className="w-16 h-4 bg-slate-800 rounded animate-pulse" />
                      )}
                    </div>
                  </div>

                  {/* 展開コンテンツ */}
                  <AnimatePresence>
                    {isExpanded && isLoaded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 border-t border-slate-800 pt-4 space-y-3">
                          {sec.headline && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">見出し</span>
                              <p className="text-white font-bold mt-1">{sec.headline}</p>
                            </div>
                          )}
                          {sec.subheadline && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">サブ見出し</span>
                              <p className="text-slate-300 mt-1">{sec.subheadline}</p>
                            </div>
                          )}
                          {sec.body && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">本文</span>
                              <p className="text-slate-400 text-sm mt-1 whitespace-pre-line leading-relaxed">{sec.body}</p>
                            </div>
                          )}
                          {sec.ctaText && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">CTAボタン</span>
                              <p className="text-cyan-400 font-bold mt-1">「{sec.ctaText}」</p>
                            </div>
                          )}
                          {sec.items && sec.items.length > 0 && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">アイテム</span>
                              <div className="mt-2 space-y-2">
                                {sec.items.map((item, j) => (
                                  <div key={j} className="bg-slate-800 rounded-lg px-3 py-2">
                                    <p className="text-sm font-bold text-white">{item.title}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{item.description}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}

            {/* ナビゲーション */}
            <div className="flex items-center justify-between pt-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> 戻る
              </button>
              <button
                onClick={handleNext}
                disabled={sections.length === 0 || generating || saving}
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-8 py-4 rounded-xl transition-colors"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                次へ: デザインを選択する
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ブラッシュアップモーダル */}
      <AnimatePresence>
        {brushupModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40"
              onClick={() => setBrushupModal(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-cyan-400" />
                      ブラッシュアップ
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">「{brushupModal.sectionName}」のコピーを改善</p>
                  </div>
                  <button onClick={() => setBrushupModal(null)} className="p-2 text-slate-500 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {/* 現在のコピー */}
                  <div className="bg-slate-800 rounded-xl p-4">
                    <p className="text-xs text-slate-500 mb-2 font-medium">現在の見出し</p>
                    <p className="text-white text-sm">{brushupModal.currentCopy.headline || '（なし）'}</p>
                    {brushupModal.currentCopy.body && (
                      <>
                        <p className="text-xs text-slate-500 mt-3 mb-2 font-medium">現在の本文</p>
                        <p className="text-slate-400 text-xs whitespace-pre-line leading-relaxed line-clamp-4">{brushupModal.currentCopy.body}</p>
                      </>
                    )}
                  </div>

                  {/* 指示入力 */}
                  <div>
                    <label className="text-sm font-medium text-white mb-2 block">改善の指示</label>
                    <textarea
                      value={brushupModal.instruction}
                      onChange={e => setBrushupModal({ ...brushupModal, instruction: e.target.value })}
                      placeholder="例: もっとカジュアルなトーンにしてください / 数字を使って具体性を出してください / ベネフィットを前に出してください"
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
                  <button
                    onClick={() => setBrushupModal(null)}
                    className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-sm font-medium"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleBrushup}
                    disabled={!brushupModal.instruction.trim() || brushupLoading}
                    className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black transition-colors text-sm flex items-center justify-center gap-2"
                  >
                    {brushupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    更新する
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LpCopyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
      <CopyPage />
    </Suspense>
  )
}
