'use client'
// ============================================
// ドヤムービーAI - Step2: ペルソナ設定
// ============================================
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import type { MoviePersona, ProductInfo } from '@/lib/movie/types'

const STEPS = ['商品情報', 'ペルソナ', '企画選択', '編集']

const DEFAULT_PERSONA: MoviePersona = {
  age: '30代',
  gender: '男女問わず',
  occupation: 'マーケター・EC担当者',
  income: '400〜800万円',
  pain: '広告制作に時間とコストがかかる',
  goal: '低コストで効果的な広告を作りたい',
  mediaHabits: ['YouTube', 'Instagram', 'TikTok'],
  keywords: ['時短', 'コスト削減', '自動化'],
}

type Mode = 'auto' | 'manual' | 'skip'

export default function PersonaPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('auto')
  const [generating, setGenerating] = useState(false)
  const [persona, setPersona] = useState<MoviePersona>(DEFAULT_PERSONA)
  const [productInfo, setProductInfo] = useState<ProductInfo | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('movie_product_info')
    if (!stored) {
      router.replace('/movie/new/concept')
      return
    }
    setProductInfo(JSON.parse(stored))
  }, [router])

  const generatePersona = async () => {
    if (!productInfo) return
    setGenerating(true)
    try {
      // ペルソナ生成はpersona APIを流用するか、productInfoから推論
      // ここではシンプルにproductInfoからデフォルト値を設定
      const generated: MoviePersona = {
        age: '30〜40代',
        gender: '男女問わず',
        occupation: productInfo.target || 'マーケター',
        income: '400〜800万円',
        pain: `${productInfo.name}を使う前の課題や悩み`,
        goal: `${productInfo.usp || productInfo.name}で課題を解決したい`,
        mediaHabits: ['YouTube', 'Instagram', 'TikTok'],
        keywords: productInfo.features.slice(0, 3),
      }
      setPersona(generated)
      toast.success('ペルソナを自動生成しました')
    } catch {
      toast.error('生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  const handleNext = () => {
    const finalPersona = mode === 'skip' ? null : persona
    sessionStorage.setItem('movie_persona', JSON.stringify(finalPersona))
    router.push('/movie/new/plan')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i === 1 ? 'bg-rose-500 text-white' :
              i < 1 ? 'bg-rose-800 text-rose-300' :
              'bg-slate-800 text-slate-400'
            }`}>
              {i < 1 ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === 1 ? 'text-rose-300' : i < 1 ? 'text-rose-400/60' : 'text-slate-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < 1 ? 'bg-rose-700/50' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-white mb-2">ペルソナ設定</h1>
        <p className="text-rose-200/60 text-sm mb-6">ターゲット視聴者のペルソナを設定すると、より効果的な動画企画が生成されます。</p>

        {/* モード選択 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { id: 'auto' as Mode, label: '自動生成', icon: '🤖', desc: 'AIが商品情報から自動生成' },
            { id: 'manual' as Mode, label: '手動入力', icon: '✏️', desc: '詳細を自分で入力' },
            { id: 'skip' as Mode, label: 'スキップ', icon: '⏩', desc: 'ペルソナなしで進む' },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                mode === m.id
                  ? 'border-rose-500 bg-rose-500/20'
                  : 'border-rose-900/30 bg-slate-800/40 hover:border-rose-700/50'
              }`}
            >
              <div className="text-xl mb-1">{m.icon}</div>
              <div className={`text-sm font-semibold ${mode === m.id ? 'text-rose-200' : 'text-slate-300'}`}>{m.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{m.desc}</div>
            </button>
          ))}
        </div>

        {mode === 'skip' ? (
          <div className="rounded-xl border border-dashed border-rose-900/40 p-6 text-center">
            <div className="text-4xl mb-2">⏩</div>
            <p className="text-rose-200/60 text-sm">ペルソナなしで企画生成に進みます</p>
          </div>
        ) : (
          <>
            {mode === 'auto' && (
              <button
                onClick={generatePersona}
                disabled={generating}
                className="w-full mb-4 py-3 rounded-xl font-bold text-white border border-rose-500/50 hover:bg-rose-500/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                    生成中...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">auto_awesome</span>
                    AIでペルソナを自動生成
                  </>
                )}
              </button>
            )}

            {/* ペルソナフォーム */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-rose-200 text-xs font-semibold mb-1.5">年齢層</label>
                  <input
                    type="text"
                    value={persona.age}
                    onChange={e => setPersona(p => ({ ...p, age: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-rose-200 text-xs font-semibold mb-1.5">性別</label>
                  <input
                    type="text"
                    value={persona.gender}
                    onChange={e => setPersona(p => ({ ...p, gender: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-rose-200 text-xs font-semibold mb-1.5">職業</label>
                  <input
                    type="text"
                    value={persona.occupation}
                    onChange={e => setPersona(p => ({ ...p, occupation: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-rose-200 text-xs font-semibold mb-1.5">収入（任意）</label>
                  <input
                    type="text"
                    value={persona.income || ''}
                    onChange={e => setPersona(p => ({ ...p, income: e.target.value }))}
                    className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-rose-200 text-xs font-semibold mb-1.5">抱えている悩み・課題</label>
                <textarea
                  value={persona.pain}
                  onChange={e => setPersona(p => ({ ...p, pain: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-rose-200 text-xs font-semibold mb-1.5">達成したいゴール</label>
                <textarea
                  value={persona.goal}
                  onChange={e => setPersona(p => ({ ...p, goal: e.target.value }))}
                  rows={2}
                  className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors resize-none"
                />
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 mt-8">
          <button
            onClick={() => router.back()}
            className="px-6 py-3 rounded-xl font-semibold text-rose-300 border border-rose-900/40 hover:bg-rose-900/20 transition-all"
          >
            戻る
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
          >
            次へ: 企画選択
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
