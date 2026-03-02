'use client'
// ============================================
// ドヤムービーAI - Step3: 企画選択
// ============================================
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { MoviePlan, ProductInfo, MoviePersona } from '@/lib/movie/types'

const STEPS = ['商品情報', 'ペルソナ', '企画選択', '編集']

function PlanCard({
  plan,
  isSelected,
  isLoading,
  onSelect,
}: {
  plan: MoviePlan
  isSelected: boolean
  isLoading: boolean
  onSelect: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isLoading ? 0.5 : 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onSelect}
      className={`rounded-xl border p-5 cursor-pointer transition-all ${
        isSelected
          ? 'border-rose-500 bg-rose-500/15 shadow-lg shadow-rose-500/20'
          : 'border-rose-900/30 bg-slate-900/50 hover:border-rose-700/50 hover:bg-rose-950/30'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            isSelected ? 'border-rose-500 bg-rose-500' : 'border-rose-700'
          }`}>
            {isSelected && <span className="text-white text-xs">✓</span>}
          </div>
          <span className="text-rose-300/70 text-xs font-bold">プラン {plan.index + 1}</span>
        </div>
      </div>

      <h3 className="text-white font-bold text-base mb-2">{plan.concept}</h3>

      {/* ストーリーライン */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {[
          { label: '起', text: plan.storyline.opening },
          { label: '承', text: plan.storyline.development },
          { label: '転', text: plan.storyline.climax },
          { label: '結', text: plan.storyline.conclusion },
        ].map(s => (
          <div key={s.label} className="text-center">
            <div className="text-rose-400/60 text-xs font-bold mb-1">{s.label}</div>
            <div className="text-rose-100/70 text-xs leading-relaxed">{s.text}</div>
          </div>
        ))}
      </div>

      {/* シーン数 */}
      <div className="flex items-center gap-3 text-xs text-rose-300/50">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">movie</span>
          {plan.scenes.length}シーン
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">music_note</span>
          BGM: {plan.bgmMood}
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">record_voice_over</span>
          {plan.narrationStyle}
        </span>
      </div>
    </motion.div>
  )
}

export default function PlanPage() {
  const router = useRouter()
  const [plans, setPlans] = useState<MoviePlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)
  const [persona, setPersona] = useState<MoviePersona | null>(null)
  const [config, setConfig] = useState<any>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const pi = sessionStorage.getItem('movie_product_info')
    const pe = sessionStorage.getItem('movie_persona')
    const co = sessionStorage.getItem('movie_config')
    if (!pi) { router.replace('/movie/new/concept'); return }
    setProductInfo(JSON.parse(pi))
    setPersona(pe ? JSON.parse(pe) : null)
    setConfig(co ? JSON.parse(co) : { platform: 'youtube', duration: 15, aspectRatio: '16:9' })
  }, [router])

  useEffect(() => {
    if (productInfo && config) generatePlans()
  }, [productInfo, config])

  const generatePlans = async () => {
    if (!productInfo) return
    setGenerating(true)
    setPlans([])
    setSelectedPlan(null)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/movie/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productInfo, persona, config }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '企画生成に失敗しました')
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream error')
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            let data: any
            try {
              data = JSON.parse(line.slice(6))
            } catch {
              continue // malformed JSON は無視
            }
            if (data.plan) setPlans(prev => [...prev, data.plan])
            if (data.done) setGenerating(false)
            if (data.error) throw new Error(data.error)
          }
        }
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        toast.error(e.message || '企画生成に失敗しました')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleNext = async () => {
    if (selectedPlan === null) {
      toast.error('企画を選択してください')
      return
    }
    setSubmitting(true)
    try {
      // プロジェクト作成
      const plan = plans[selectedPlan]
      const createRes = await fetch('/api/movie/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${productInfo?.name} 動画`,
          productInfo,
          persona,
          aspectRatio: config?.aspectRatio || '16:9',
          duration: config?.duration || 15,
          platform: config?.platform || 'youtube',
          plans,
          selectedPlan,
          status: 'planning',
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || 'プロジェクト作成に失敗しました')
      }
      const { project } = await createRes.json()

      // シーン生成
      const scenesRes = await fetch('/api/movie/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, plan, productInfo, config }),
      })
      if (!scenesRes.ok) {
        const err = await scenesRes.json()
        throw new Error(err.error || 'シーン生成に失敗しました')
      }

      sessionStorage.removeItem('movie_product_info')
      sessionStorage.removeItem('movie_persona')
      sessionStorage.removeItem('movie_config')

      router.push(`/movie/${project.id}/edit`)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i === 2 ? 'bg-rose-500 text-white' :
              i < 2 ? 'bg-rose-800 text-rose-300' :
              'bg-slate-800 text-slate-400'
            }`}>
              {i < 2 ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === 2 ? 'text-rose-300' : i < 2 ? 'text-rose-400/60' : 'text-slate-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < 2 ? 'bg-rose-700/50' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-white">企画を選んでください</h1>
        {!generating && plans.length > 0 && (
          <button
            onClick={generatePlans}
            className="flex items-center gap-1 text-rose-300 text-sm hover:text-rose-200 transition-colors"
          >
            <span className="material-symbols-outlined text-base">refresh</span>
            再生成
          </button>
        )}
      </div>
      <p className="text-rose-200/60 text-sm mb-6">AIが3パターンの動画企画を生成します。最も気に入ったものを選んでください。</p>

      {/* 企画カード */}
      <div className="space-y-4">
        {plans.map((plan, i) => (
          <PlanCard
            key={i}
            plan={plan}
            isSelected={selectedPlan === i}
            isLoading={false}
            onSelect={() => setSelectedPlan(i)}
          />
        ))}

        {/* ローディング中のスケルトン */}
        {generating && plans.length < 3 && (
          <div className="rounded-xl border border-rose-900/30 bg-slate-900/50 p-5 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-rose-400 animate-spin text-base">progress_activity</span>
              <span className="text-rose-300/70 text-sm">企画{plans.length + 1}を生成中...</span>
            </div>
            <div className="h-4 bg-slate-700/50 rounded mb-2 w-3/4" />
            <div className="h-3 bg-slate-700/50 rounded mb-1 w-full" />
            <div className="h-3 bg-slate-700/50 rounded w-2/3" />
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      {plans.length > 0 && !generating && (
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl font-semibold text-rose-300 border border-rose-900/40 hover:bg-rose-900/20 transition-all"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            disabled={selectedPlan === null || submitting}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                シーンを生成中...
              </>
            ) : (
              <>
                次へ: 編集
                <span className="material-symbols-outlined">arrow_forward</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
