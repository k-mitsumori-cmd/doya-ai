'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, ChevronUp, ChevronDown, PlusCircle, Trash2 } from 'lucide-react'
import { Suspense } from 'react'

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
  const projectId = searchParams.get('projectId')

  const [structures, setStructures] = useState<Structure[]>([])
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [editingSections, setEditingSections] = useState<SectionDef[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('LP構成案を生成中...')

  const generate = useCallback(async () => {
    if (!projectId) return
    setGenerating(true)
    setError('')

    try {
      // プロジェクトの情報を取得
      const projRes = await fetch(`/api/lp/projects/${projectId}`)
      const projData = await projRes.json()
      const project = projData.project
      if (!project) throw new Error('プロジェクトが見つかりません')

      // 既に構成案がある場合はそれを使用
      if (project.structures && Array.isArray(project.structures) && project.structures.length > 0) {
        setStructures(project.structures)
        setGenerating(false)
        return
      }

      // SSEで生成
      const response = await fetch('/api/lp/generate-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          productInfo: project.productInfo,
          purposes: project.purpose || [],
        }),
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
    generate()
  }, [generate])

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
      await fetch(`/api/lp/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedStructure: selectedIdx,
          structures: structures.map((s, i) =>
            i === selectedIdx ? { ...s, sections: editingSections } : s
          ),
        }),
      })
      router.push(`/lp/new/copy?projectId=${projectId}`)
    } catch (e: any) {
      alert(e.message || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            {['商品情報入力', '構成案選択', 'コピー確認', 'デザイン選択'].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-700" />}
                <div className={`flex items-center gap-1.5 ${i === 1 ? 'text-cyan-400' : i < 1 ? 'text-slate-400' : 'text-slate-600'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 1 ? 'bg-cyan-500 text-slate-950' : i < 1 ? 'bg-slate-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                    {i < 1 ? '✓' : i + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-white mb-2">LP構成案を選択してください</h1>
        <p className="text-slate-400 text-sm mb-8">AIが3パターンの構成案を提案しました。気に入ったものを選んで、セクションの順序を調整できます。</p>

        {generating ? (
          <div className="text-center py-24">
            <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-slate-300 text-lg">{statusMsg}</p>
            <p className="text-slate-500 text-sm mt-2">約10〜20秒かかります...</p>
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button onClick={generate} className="text-cyan-400 hover:text-cyan-300">再生成する</button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* 3案カード */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {structures.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => handleSelect(i)}
                  className={`text-left p-5 rounded-xl border transition-all ${selectedIdx === i ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-xs text-cyan-400 font-bold">Pattern {i + 1}</span>
                      <h3 className="font-bold text-white mt-0.5">{s.name}</h3>
                    </div>
                    {selectedIdx === i && <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{s.description}</p>
                  <div className="space-y-1">
                    {s.sections.slice(0, 6).map((sec, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs text-slate-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-600 flex-shrink-0" />
                        {sec.name}
                      </div>
                    ))}
                    {s.sections.length > 6 && (
                      <div className="text-xs text-slate-600">+ {s.sections.length - 6}セクション</div>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            {/* セクション編集 */}
            {selectedIdx !== null && editingSections.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="font-bold text-white mb-4 flex items-center gap-2">
                  セクションの順序を調整
                  <span className="text-xs text-slate-500 font-normal">（上下矢印で並べ替え）</span>
                </h2>
                <div className="space-y-2">
                  {editingSections.map((sec, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-800 rounded-lg px-4 py-3">
                      <span className="text-xs text-slate-500 w-6 text-center font-bold">{i + 1}</span>
                      <span className="flex-1 text-sm text-white">{sec.name}</span>
                      <span className="text-xs text-slate-600 hidden sm:block">{sec.type}</span>
                      <div className="flex gap-1">
                        <button onClick={() => moveSection(i, -1)} disabled={i === 0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30">
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button onClick={() => moveSection(i, 1)} disabled={i === editingSections.length - 1} className="p-1 text-slate-500 hover:text-white disabled:opacity-30">
                          <ChevronDown className="w-4 h-4" />
                        </button>
                        <button onClick={() => removeSection(i)} className="p-1 text-slate-600 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

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
                className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-8 py-4 rounded-xl transition-colors"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                次へ: コピーを生成する
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function LpStructurePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>}>
      <StructurePage />
    </Suspense>
  )
}
