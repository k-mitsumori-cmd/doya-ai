'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, ChevronUp, ChevronDown, Trash2, RefreshCw, LayoutTemplate, LogIn, Info, GripVertical, Layers, Ruler } from 'lucide-react'
import toast from 'react-hot-toast'
import { Suspense } from 'react'
import { generateWireframeSvg } from '@/lib/lp/wireframe'
import type { LpSectionDef } from '@/lib/lp/types'

/** セクションタイプ別アイコン */
const SECTION_ICONS: Record<string, string> = {
  hero: '\u{1F3AF}', problem: '\u{1F630}', empathy: '\u{1F91D}', solution: '\u{1F4A1}',
  features: '\u2B50', proof: '\u{1F4CA}', testimonial: '\u{1F4AC}', pricing: '\u{1F4B0}',
  faq: '\u2753', cta: '\u{1F525}', company: '\u{1F3E2}', footer: '\u{1F4CB}',
}

/** 心理フローの定義 */
interface PsychFlow {
  name: string
  steps: string[]
  color: string
}

const PSYCH_FLOWS: Record<string, PsychFlow> = {
  aida: { name: 'AIDA型', steps: ['注意', '興味', '欲求', '行動'], color: '#05b7d6' },
  pas: { name: 'PAS型', steps: ['問題', '煽り', '解決'], color: '#f59e0b' },
  story: { name: 'ストーリー型', steps: ['共感', '発見', '変化'], color: '#a855f7' },
}

/** パターン名・セクション構成からフロー型を推定 */
function detectFlow(name: string, sections: SectionDef[]): PsychFlow {
  const n = name.toLowerCase()
  if (n.includes('aida') || n.includes('注意') || n.includes('interest')) return PSYCH_FLOWS.aida
  if (n.includes('pas') || n.includes('問題提起') || n.includes('problem')) return PSYCH_FLOWS.pas
  if (n.includes('stor') || n.includes('共感') || n.includes('ストーリー') || n.includes('物語')) return PSYCH_FLOWS.story
  const types = sections.map(s => s.type)
  if (types.includes('problem') && types.includes('empathy')) return PSYCH_FLOWS.pas
  if (types.includes('empathy') && types.indexOf('empathy') < 2) return PSYCH_FLOWS.story
  return PSYCH_FLOWS.aida
}

interface SectionDef {
  type: string
  name: string
  purpose: string
  hasCta: boolean
  headlineChars: number
  bodyChars: number
  recommendedContent: string[]
  heightRatio: number
}

interface Structure {
  id: number
  name: string
  description: string
  sections: SectionDef[]
}

function StructurePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status: sessionStatus } = useSession()
  const projectId = searchParams.get('projectId')

  const [structures, setStructures] = useState<Structure[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [editingSections, setEditingSections] = useState<SectionDef[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('構成案を生成中...')

  const generate = useCallback(async (forceRegenerate = false) => {
    if (!projectId) return
    setGenerating(true)
    setError('')
    setSelectedIdx(null)
    setEditingSections([])

    try {
      const projRes = await fetch(`/api/lp/projects/${projectId}`)
      if (!projRes.ok) throw new Error('プロジェクト情報の取得に失敗しました')
      const projData = await projRes.json()
      const project = projData.project
      if (!project) throw new Error('プロジェクトが見つかりません')

      if (!forceRegenerate && project.structures && Array.isArray(project.structures) && project.structures.length > 0) {
        setStructures(project.structures)
        setGenerating(false)
        return
      }

      if (forceRegenerate) {
        setStructures([])
        setStatusMsg('構成案を再生成中...')
      }

      const response = await fetch('/api/lp/generate-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          productInfo: project.productInfo,
          purposes: project.purpose || [],
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.error || `生成リクエストに失敗しました (${response.status})`)
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
            if (data.type === 'status') setStatusMsg(data.message)
            if (data.type === 'structures') setStructures(data.structures || [])
            if (data.type === 'error') throw new Error(data.message)
          } catch (e: any) {
            if (e.message && !e.message.includes('Unexpected token')) throw e
          }
        }
      }
    } catch (e: any) {
      setError(e.message || '生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }, [projectId])

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    generate()
  }, [generate, sessionStatus])

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx)
    setEditingSections([...structures[idx].sections])
  }

  const moveSection = (i: number, dir: -1 | 1) => {
    const arr = [...editingSections]
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    setEditingSections(arr)
  }

  const removeSection = (i: number) => {
    setEditingSections(editingSections.filter((_, j) => j !== i))
  }

  const handleNext = async () => {
    if (selectedIdx === null || !projectId) return
    setSaving(true)
    try {
      const res = await fetch(`/api/lp/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedStructure: selectedIdx,
          structures: structures.map((s, i) =>
            i === selectedIdx ? { ...s, sections: editingSections } : s
          ),
        }),
      })
      if (!res.ok) throw new Error('構成案の保存に失敗しました')
      router.push(`/lp/new/copy?projectId=${projectId}`)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  /** ミニワイヤーフレームサムネイル（パターンカード内） */
  const thumbnails = useMemo(() => {
    return structures.map(s =>
      generateWireframeSvg(s.sections as LpSectionDef[], { width: 100, baseHeight: 6 })
    )
  }, [structures])

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
        <p className="text-slate-400 text-sm mb-6">ワイヤーフレーム作成機能を使うにはログインしてください。</p>
        <button onClick={() => router.push(`/auth/signin?callbackUrl=${encodeURIComponent(`/lp/new/structure${projectId ? `?projectId=${projectId}` : ''}`)}`)} className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 text-lp-bg font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20">
          <LogIn className="w-4 h-4" /> Googleでログイン
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-lp-bg text-white pb-16 relative">
      {/* 背景グラデーションオーブ */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-lp-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-lp-primary/10 blur-[120px] rounded-full" />
      </div>

      {/* ステップインジケーター */}
      <div className="bg-lp-surface/80 backdrop-blur-md border-b border-lp-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="text-xs font-bold text-lp-primary uppercase tracking-widest">Step 2 / 4</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-lp-primary/40" />
            <div className="h-2.5 w-8 rounded-full bg-lp-primary shadow-[0_0_10px_rgba(5,183,214,0.5)]" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-black text-white tracking-tight">構成案を選択してください</h1>
          {!generating && structures.length > 0 && (
            <button
              onClick={() => generate(true)}
              className="flex items-center gap-1.5 text-sm text-lp-primary hover:text-lp-primary/80 bg-lp-primary/10 border border-lp-primary/20 hover:bg-lp-primary/20 rounded-lg px-4 py-2 transition-all font-bold"
            >
              <RefreshCw className="w-4 h-4" />
              再生成する
            </button>
          )}
        </div>
        <p className="text-slate-400 text-sm mb-8">AIが3パターンの構成案を提案しました。気に入ったものを選んで、セクションの順序を調整できます。</p>

        {generating ? (
          <div className="text-center py-24">
            <Loader2 className="w-12 h-12 animate-spin text-lp-primary mx-auto mb-4" />
            <p className="text-slate-300 text-lg">{statusMsg}</p>
            <p className="text-slate-500 text-sm mt-2">約10〜20秒かかります...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={() => generate(true)} className="text-lp-primary hover:text-lp-primary/80 font-bold">再生成する</button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 3案カード */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* パターンカード（左4カラム） */}
              <div className="lg:col-span-4 space-y-3">
                {structures.map((s, i) => {
                  const flow = detectFlow(s.name, s.sections)
                  const scrollEst = Math.round(s.sections.reduce((sum, sec) => sum + (sec.heightRatio || 1) * 600, 0) / 1000)
                  return (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => handleSelect(i)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                        selectedIdx === i
                          ? 'border-lp-primary bg-lp-primary/5 shadow-[0_0_20px_rgba(5,183,214,0.15)]'
                          : 'border-lp-border bg-lp-surface hover:border-lp-primary/50'
                      }`}
                    >
                      {selectedIdx === i && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle2 className="w-5 h-5 text-lp-primary" />
                        </div>
                      )}

                      {/* ヘッダー: パターン名 + フロー型バッジ */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          {i === 0 && (
                            <p className="text-[10px] text-lp-primary font-bold tracking-widest uppercase mb-1">Popular</p>
                          )}
                          <h3 className="font-bold text-white text-lg mb-0.5">{s.name}</h3>
                          {/* 心理フロー可視化 */}
                          <div className="flex items-center gap-1 flex-wrap mt-1">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: flow.color, backgroundColor: `${flow.color}15` }}>
                              {flow.name}
                            </span>
                            <div className="flex items-center gap-0.5 text-[10px] text-slate-500">
                              {flow.steps.map((step, si) => (
                                <span key={si} className="flex items-center gap-0.5">
                                  <span style={{ color: flow.color }}>{step}</span>
                                  {si < flow.steps.length - 1 && <span className="text-slate-600">→</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* ミニワイヤーフレームサムネイル */}
                        <div
                          className="w-[60px] flex-shrink-0 rounded border border-lp-border/50 bg-white/5 overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: thumbnails[i] || '' }}
                        />
                      </div>

                      {/* セクション一覧（アイコン付き） */}
                      <div className="space-y-0.5">
                        {s.sections.slice(0, 6).map((sec, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="text-[11px] w-4 text-center flex-shrink-0">{SECTION_ICONS[sec.type] || '\u25CF'}</span>
                            <span className="truncate">{sec.name}</span>
                          </div>
                        ))}
                        {s.sections.length > 6 && (
                          <div className="text-xs text-slate-600 pl-5">+ {s.sections.length - 6}セクション</div>
                        )}
                      </div>

                      {/* メタ情報: セクション数 + 推定スクロール長 */}
                      <div className="flex items-center gap-3 mt-3 pt-2.5 border-t border-lp-border/50">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Layers className="w-3 h-3" />
                          <span>{s.sections.length}セクション</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Ruler className="w-3 h-3" />
                          <span>約{scrollEst > 0 ? scrollEst : 1}画面分</span>
                        </div>
                      </div>
                    </motion.button>
                  )
                })}
              </div>

              {/* セクション編集 + ワイヤーフレーム（右8カラム） */}
              {selectedIdx !== null && editingSections.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* セクション編集 */}
                  <div className="bg-lp-surface border border-lp-border rounded-xl p-5">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2 text-sm">
                      セクションの順序を調整
                    </h2>
                    <div className="space-y-1.5">
                      {editingSections.map((sec, i) => (
                        <div key={i} className="flex items-center gap-3 bg-lp-bg rounded-lg px-3 py-2.5 border border-transparent hover:border-lp-primary/30 transition-colors group cursor-move">
                          <span className="text-sm w-5 text-center flex-shrink-0">{SECTION_ICONS[sec.type] || '\u25CF'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white truncate">{sec.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase">{sec.type}</p>
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-2 text-slate-500 hover:text-white disabled:opacity-30">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => moveSection(i, 1)} disabled={i === editingSections.length - 1} className="p-2 text-slate-500 hover:text-white disabled:opacity-30">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            <button onClick={() => removeSection(i)} className="p-2 text-slate-600 hover:text-red-400">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <GripVertical className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ワイヤーフレームプレビュー */}
                  <div className="bg-slate-900 rounded-xl border border-lp-primary/30 p-4 relative overflow-hidden">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500/50" />
                        <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                        <div className="w-2 h-2 rounded-full bg-green-500/50" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5 ml-2">
                        <LayoutTemplate className="w-3.5 h-3.5" />
                        ワイヤーフレーム プレビュー
                      </h3>
                    </div>
                    <div
                      className="w-full overflow-y-auto max-h-[500px] rounded-lg bg-white/5 p-1"
                      dangerouslySetInnerHTML={{
                        __html: generateWireframeSvg(editingSections as LpSectionDef[], { width: 220 }),
                      }}
                    />
                  </div>
                </motion.div>
              )}

              {/* AI推奨理由 */}
              {selectedIdx !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="lg:col-span-12">
                  <div className="p-5 rounded-xl bg-lp-surface/60 border border-lp-primary/10">
                    <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4 text-lp-primary" />
                      AIからの推奨理由
                    </h4>
                    <p className="text-sm text-slate-400">{structures[selectedIdx].description}</p>
                  </div>
                </motion.div>
              )}
            </div>

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
                disabled={selectedIdx === null || saving}
                className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-black px-8 py-4 rounded-xl transition-all shadow-lg shadow-lp-primary/20"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                次へ: コピーを生成する
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* モバイル固定アクション */}
      {selectedIdx !== null && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-lp-bg/95 border-t border-lp-primary/20 backdrop-blur-lg flex gap-3 z-30">
          <button
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-xl border border-lp-border text-slate-400 font-bold text-sm"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-lp-primary text-lp-bg font-black text-sm shadow-lg shadow-lp-primary/20"
          >
            次へ
          </button>
        </div>
      )}
    </div>
  )
}

export default function LpStructurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-lp-bg flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lp-primary" /></div>}>
      <StructurePage />
    </Suspense>
  )
}
