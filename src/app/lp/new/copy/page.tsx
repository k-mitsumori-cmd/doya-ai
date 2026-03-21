'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ArrowLeft, Loader2, Sparkles, X, ChevronDown, ChevronUp, RefreshCw, Pencil, Check as CheckIcon, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
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

const BRUSHUP_PRESETS = [
  '感情的に訴える',
  '信頼性を高める',
  '短く簡潔にする',
  '煽りを入れる',
  '数字を使って具体化',
  'カジュアルなトーンに',
]

function CopyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
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

  const [editingField, setEditingField] = useState<{ sectionIdx: number; field: 'headline' | 'subheadline' | 'body' } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [savingField, setSavingField] = useState(false)

  const startEditing = (sectionIdx: number, field: 'headline' | 'subheadline' | 'body') => {
    const sec = sections[sectionIdx]
    setEditingField({ sectionIdx, field })
    setEditingValue(sec[field] || '')
  }

  const cancelEditing = () => {
    setEditingField(null)
    setEditingValue('')
  }

  const saveEditing = async () => {
    if (!editingField || !projectId) return
    const { sectionIdx, field } = editingField
    const sec = sections[sectionIdx]
    if (!sec.id) return

    setSavingField(true)
    try {
      setSections(prev =>
        prev.map((s, i) => i === sectionIdx ? { ...s, [field]: editingValue } : s)
      )

      const res = await fetch(`/api/lp/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: [{
            id: sec.id,
            order: sec.order,
            headline: field === 'headline' ? editingValue : sec.headline,
            subheadline: field === 'subheadline' ? editingValue : sec.subheadline,
            body: field === 'body' ? editingValue : sec.body,
            ctaText: sec.ctaText,
            ctaUrl: sec.ctaUrl,
            items: sec.items,
          }],
        }),
      })

      if (!res.ok) throw new Error('保存に失敗しました')
      setEditingField(null)
      setEditingValue('')
    } catch (e: any) {
      toast.error(e.message || '保存に失敗しました')
      setSections(prev =>
        prev.map((s, i) => i === sectionIdx ? { ...s, [field]: sec[field] } : s)
      )
    } finally {
      setSavingField(false)
    }
  }

  const generate = useCallback(async () => {
    if (!projectId || hasGenerated.current) return
    hasGenerated.current = true
    setGenerating(true)
    setError('')

    try {
      const projRes = await fetch(`/api/lp/projects/${projectId}`)
      if (!projRes.ok) throw new Error('プロジェクト情報の取得に失敗しました')
      const projData = await projRes.json()
      const project = projData.project
      if (!project) throw new Error('プロジェクトが見つかりません')

      if (project.sections && project.sections.length > 0) {
        setSections(project.sections.map((s: any, i: number) => ({ ...s, order: i })))
        setGenerating(false)
        return
      }

      const structure = project.structures?.[project.selectedStructure ?? 0]
      if (structure?.sections) {
        setSections(structure.sections.map((s: any, i: number) => ({
          order: i,
          type: s.type,
          name: s.name,
        })))
        setProgress({ current: 0, total: structure.sections.length, sectionName: '' })
      }

      const response = await fetch('/api/lp/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `コピー生成リクエストに失敗しました (${response.status})`)
      }

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
            if (data.type === 'warning') toast.error(data.message || '一部セクションの生成に失敗しました')
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
    hasGenerated.current = false
  }, [projectId])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    generate()
  }, [generate, sessionStatus])

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
      if (!res.ok) {
        if (res.status === 403 && data.upgradePath) {
          toast.error('ブラッシュアップはProプラン以上で利用可能です')
          router.push(data.upgradePath)
          return
        }
        throw new Error(data.error || 'ブラッシュアップに失敗しました')
      }
      if (data.section) {
        setSections(prev =>
          prev.map(s => (s.id === brushupModal.sectionId ? { ...s, ...data.section } : s))
        )
      }
      setBrushupModal(null)
    } catch (e: any) {
      toast.error(e.message || 'ブラッシュアップに失敗しました')
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

  if (sessionStatus === 'loading') {
    return <div className="min-h-screen bg-lp-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lp-primary" /></div>
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-lp-bg flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-lp-primary/20 flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-lp-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
        <p className="text-slate-400 text-sm mb-6">LP作成機能を使うにはログインしてください。</p>
        <button onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/lp/new/copy${projectId ? `?projectId=${projectId}` : ''}`)}`)} className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 text-lp-bg font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20">
          <LogIn className="w-4 h-4" /> Googleでログイン
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lp-bg text-white pb-32 relative">
      {/* 背景グラデーションオーブ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lp-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-lp-primary/10 blur-[120px] rounded-full" />
      </div>

      {/* ステップ + プログレスバー */}
      <div className="bg-lp-surface/80 backdrop-blur-md border-b border-lp-border sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <p className="text-xs font-bold text-lp-primary uppercase tracking-widest">Step 3 / 4</p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
              <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
              <div className="h-2.5 w-8 rounded-full bg-lp-primary shadow-[0_0_10px_rgba(5,183,214,0.5)]" />
              <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
            </div>
          </div>
        </div>
        {/* リニアプログレスバー */}
        {generating && progress.total > 0 && (
          <div className="w-full h-1 bg-lp-border relative">
            <motion.div
              className="absolute top-0 left-0 h-full bg-lp-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {/* AIステータスピル */}
      {!generating && sections.some(s => s.headline) && (
        <div className="flex justify-center py-4">
          <div className="flex items-center gap-2 bg-lp-primary/10 px-4 py-1.5 rounded-full border border-lp-primary/20">
            <Sparkles className="w-3.5 h-3.5 text-lp-primary" />
            <span className="text-xs font-medium text-lp-primary">AIが最適なコピーを生成しました</span>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-4">
        <h1 className="text-2xl font-black text-white mb-2 tracking-tight">コピーを確認・編集してください</h1>
        <p className="text-slate-400 text-sm mb-6">各セクションをクリックして内容を確認。「ブラッシュアップ」でAIが改善します。</p>

        {/* プログレスバー（生成中） */}
        {generating && progress.total > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-lp-primary font-medium">
                {progress.sectionName ? `「${progress.sectionName}」を生成中...` : 'コピーを生成中...'}
              </span>
              <span className="text-slate-500">{progress.current} / {progress.total}</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={() => { hasGenerated.current = false; generate() }}
              className="flex items-center gap-2 text-lp-primary hover:text-lp-primary/80 mx-auto font-bold"
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
                  className={`rounded-xl border overflow-hidden transition-colors ${isLoaded ? 'border-lp-primary/20 bg-lp-primary/5' : 'border-lp-border bg-lp-surface/50'}`}
                >
                  {/* アコーディオンヘッダー */}
                  <button
                    className="w-full flex items-center justify-between p-5 hover:bg-lp-primary/5 transition-colors text-left"
                    onClick={() => setExpandedIdx(isExpanded ? null : i)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-lp-primary/20 flex items-center justify-center text-lp-primary font-bold text-sm flex-shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <div className="min-w-0">
                        <h3 className="font-bold text-white text-base">{sec.name}</h3>
                        {isLoaded && !isExpanded && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{sec.headline}</p>
                        )}
                      </div>
                      {!isLoaded && generating && (
                        <Loader2 className="w-4 h-4 animate-spin text-lp-primary flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isLoaded && sec.id && (
                        <span
                          onClick={(e) => {
                            e.stopPropagation()
                            setBrushupModal({
                              sectionId: sec.id!,
                              sectionName: sec.name,
                              currentCopy: { headline: sec.headline, body: sec.body },
                              instruction: '',
                            })
                          }}
                          className="flex items-center gap-1.5 text-xs text-lp-primary bg-lp-primary/10 border border-lp-primary/20 rounded-lg px-3 py-1.5 hover:bg-lp-primary/20 transition-all cursor-pointer font-medium group"
                        >
                          <Sparkles className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                          <span className="hidden sm:inline">ブラッシュアップ</span>
                          <span className="bg-lp-primary text-[10px] text-white px-1.5 py-0.5 rounded font-black ml-0.5">PRO</span>
                        </span>
                      )}
                      {isLoaded ? (
                        isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />
                      ) : (
                        <div className="w-16 h-4 bg-lp-border rounded animate-pulse" />
                      )}
                    </div>
                  </button>

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
                        <div className="px-5 pb-5 pt-0 space-y-4">
                          {sec.headline && (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">見出し</span>
                                {editingField?.sectionIdx === i && editingField?.field === 'headline' ? (
                                  <div className="flex gap-1 ml-auto">
                                    <button onClick={saveEditing} disabled={savingField} className="p-2 text-lp-primary hover:text-lp-primary/80 disabled:opacity-50">
                                      {savingField ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={cancelEditing} className="p-2 text-slate-500 hover:text-slate-300">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditing(i, 'headline')} className="p-2 text-slate-600 hover:text-lp-primary ml-auto">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {editingField?.sectionIdx === i && editingField?.field === 'headline' ? (
                                <input
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing() }}
                                  autoFocus
                                  className="w-full bg-lp-bg border border-lp-primary rounded-lg px-3 py-2 text-white font-bold mt-1 focus:outline-none focus:ring-1 focus:ring-lp-primary"
                                />
                              ) : (
                                <p className="text-white font-bold mt-1 cursor-pointer hover:bg-lp-surface rounded px-1 -mx-1 transition-colors" onClick={() => startEditing(i, 'headline')}>{sec.headline}</p>
                              )}
                            </div>
                          )}
                          {sec.subheadline && (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">サブ見出し</span>
                                {editingField?.sectionIdx === i && editingField?.field === 'subheadline' ? (
                                  <div className="flex gap-1 ml-auto">
                                    <button onClick={saveEditing} disabled={savingField} className="p-2 text-lp-primary hover:text-lp-primary/80 disabled:opacity-50">
                                      {savingField ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={cancelEditing} className="p-2 text-slate-500 hover:text-slate-300">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditing(i, 'subheadline')} className="p-2 text-slate-600 hover:text-lp-primary ml-auto">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {editingField?.sectionIdx === i && editingField?.field === 'subheadline' ? (
                                <input
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditing(); if (e.key === 'Escape') cancelEditing() }}
                                  autoFocus
                                  className="w-full bg-lp-bg border border-lp-primary rounded-lg px-3 py-2 text-slate-300 mt-1 focus:outline-none focus:ring-1 focus:ring-lp-primary"
                                />
                              ) : (
                                <p className="text-slate-300 mt-1 cursor-pointer hover:bg-lp-surface rounded px-1 -mx-1 transition-colors" onClick={() => startEditing(i, 'subheadline')}>{sec.subheadline}</p>
                              )}
                            </div>
                          )}
                          {sec.body && (
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">本文</span>
                                {editingField?.sectionIdx === i && editingField?.field === 'body' ? (
                                  <div className="flex gap-1 ml-auto">
                                    <button onClick={saveEditing} disabled={savingField} className="p-2 text-lp-primary hover:text-lp-primary/80 disabled:opacity-50">
                                      {savingField ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckIcon className="w-3.5 h-3.5" />}
                                    </button>
                                    <button onClick={cancelEditing} className="p-2 text-slate-500 hover:text-slate-300">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => startEditing(i, 'body')} className="p-2 text-slate-600 hover:text-lp-primary ml-auto">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              {editingField?.sectionIdx === i && editingField?.field === 'body' ? (
                                <textarea
                                  value={editingValue}
                                  onChange={e => setEditingValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Escape') cancelEditing() }}
                                  autoFocus
                                  rows={6}
                                  className="w-full bg-lp-bg border border-lp-primary rounded-lg px-3 py-2 text-slate-400 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-lp-primary resize-y leading-relaxed"
                                />
                              ) : (
                                <p className="text-slate-400 text-sm mt-1 whitespace-pre-line leading-relaxed cursor-pointer hover:bg-lp-surface rounded px-1 -mx-1 transition-colors" onClick={() => startEditing(i, 'body')}>{sec.body}</p>
                              )}
                            </div>
                          )}
                          {sec.ctaText && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">CTAボタン</span>
                              <p className="text-lp-primary font-bold mt-1">{sec.ctaText}</p>
                            </div>
                          )}
                          {sec.items && sec.items.length > 0 && (
                            <div>
                              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">アイテム</span>
                              <div className="mt-2 space-y-2">
                                {sec.items.map((item, j) => (
                                  <div key={j} className="bg-lp-surface rounded-lg px-3 py-2 border border-lp-border">
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
          </div>
        )}
      </div>

      {/* 固定ボトムナビゲーション */}
      <div className="fixed bottom-0 left-0 right-0 bg-lp-bg border-t border-lp-primary/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <button
            onClick={handleNext}
            disabled={sections.length === 0 || generating || saving}
            className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-black px-5 sm:px-8 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            <span className="hidden sm:inline">次へ: デザインを選択する</span>
            <span className="sm:hidden">次へ</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ブラッシュアップモーダル */}
      <AnimatePresence>
        {brushupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-lp-bg/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setBrushupModal(null)}
            onKeyDown={e => { if (e.key === 'Escape') setBrushupModal(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-lp-surface w-full max-w-lg rounded-2xl shadow-2xl border border-lp-primary/20 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-lp-border">
                <div>
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-lp-primary" />
                    AIブラッシュアップ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">「{brushupModal.sectionName}」のコピーを改善</p>
                </div>
                <button onClick={() => setBrushupModal(null)} className="p-2 text-slate-500 hover:text-white rounded-lg hover:bg-lp-border transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* 現在のコピー */}
                <div className="bg-lp-bg rounded-xl p-4 border border-lp-border">
                  <p className="text-xs text-slate-500 mb-2 font-medium">現在の見出し</p>
                  <p className="text-white text-sm">{brushupModal.currentCopy.headline || '（なし）'}</p>
                  {brushupModal.currentCopy.body && (
                    <>
                      <p className="text-xs text-slate-500 mt-3 mb-2 font-medium">現在の本文</p>
                      <p className="text-slate-400 text-xs whitespace-pre-line leading-relaxed line-clamp-4">{brushupModal.currentCopy.body}</p>
                    </>
                  )}
                </div>

                {/* クイック提案チップ */}
                <div>
                  <p className="text-xs text-slate-500 font-medium mb-2">クイック指示</p>
                  <div className="flex flex-wrap gap-2">
                    {BRUSHUP_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setBrushupModal({ ...brushupModal, instruction: preset })}
                        className="px-3 py-1.5 bg-lp-primary/10 border border-lp-primary/20 rounded-full text-xs text-lp-primary hover:bg-lp-primary/20 transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 指示入力 */}
                <div>
                  <label className="text-sm font-medium text-white mb-2 block">改善の指示</label>
                  <textarea
                    value={brushupModal.instruction}
                    onChange={e => setBrushupModal({ ...brushupModal, instruction: e.target.value })}
                    placeholder="例: もっとカジュアルなトーンにしてください / 数字を使って具体性を出してください"
                    rows={3}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-lp-border flex gap-3">
                <button
                  onClick={() => setBrushupModal(null)}
                  className="flex-1 py-3 rounded-xl border border-lp-border text-slate-400 hover:text-white hover:border-slate-600 transition-colors text-sm font-medium"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleBrushup}
                  disabled={!brushupModal.instruction.trim() || brushupLoading}
                  className="flex-1 py-3 rounded-xl bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-black transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-lp-primary/20"
                >
                  {brushupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  更新する
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LpCopyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-lp-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lp-primary" /></div>}>
      <CopyPage />
    </Suspense>
  )
}
