'use client'
// ============================================
// ドヤムービーAI - Step1: 商品コンセプト
// ============================================
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { PLATFORMS, DURATION_PRESETS } from '@/lib/movie/types'
import type { AspectRatio, DurationPreset } from '@/lib/movie/types'

const STEPS = ['商品情報', 'ペルソナ', '企画選択', '編集']

const ASPECT_RATIOS: { ratio: AspectRatio; label: string; icon: string }[] = [
  { ratio: '16:9', label: '横型 16:9', icon: '▬' },
  { ratio: '9:16', label: '縦型 9:16', icon: '▮' },
  { ratio: '1:1',  label: '正方形 1:1', icon: '■' },
  { ratio: '4:5',  label: '縦型 4:5', icon: '▯' },
]

export default function ConceptPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    url: '',
    description: '',
    features: '',
    target: '',
    usp: '',
    industry: '',
  })
  const [platform, setPlatform] = useState('youtube')
  const [duration, setDuration] = useState<DurationPreset>(15)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9')

  // プラットフォーム選択でアスペクト比を自動セット
  const handlePlatformChange = (id: string) => {
    setPlatform(id)
    const p = PLATFORMS.find(p => p.id === id)
    if (p) setAspectRatio(p.ratio)
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('商品名を入力してください')
      return
    }
    if (!form.description.trim()) {
      toast.error('商品説明を入力してください')
      return
    }

    setLoading(true)
    try {
      // 商品分析
      const analyzeRes = await fetch('/api/movie/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          url: form.url,
          description: form.description,
          features: form.features.split('\n').filter(Boolean),
          target: form.target,
          usp: form.usp,
          industry: form.industry,
        }),
      })
      if (!analyzeRes.ok) {
        const err = await analyzeRes.json()
        throw new Error(err.error || '分析に失敗しました')
      }
      const { productInfo } = await analyzeRes.json()

      // セッションに保存してペルソナページへ
      sessionStorage.setItem('movie_product_info', JSON.stringify(productInfo))
      sessionStorage.setItem('movie_config', JSON.stringify({ platform, duration, aspectRatio }))
      router.push('/movie/new/persona')
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ステップインジケーター */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              i === 0
                ? 'bg-rose-500 text-white'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${i === 0 ? 'text-rose-300' : 'text-slate-500'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-700" />}
          </div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-white mb-2">商品・サービス情報</h1>
        <p className="text-rose-200/60 text-sm mb-6">動画を作りたい商品・サービスの情報を入力してください。</p>

        {/* フォーム */}
        <div className="space-y-4">
          <div>
            <label className="block text-rose-200 text-sm font-semibold mb-1.5">
              商品名 / サービス名 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="例: ドヤバナーAI"
              className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-rose-200 text-sm font-semibold mb-1.5">
              商品URL（任意）
            </label>
            <input
              type="url"
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://example.com/product"
              className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
            />
          </div>

          <div>
            <label className="block text-rose-200 text-sm font-semibold mb-1.5">
              商品説明 <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="例: AIでバナー広告を自動生成するSaaSツール。商品URLを入力するだけで、プロ品質のバナーが10種類生成される。"
              rows={3}
              className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-rose-200 text-sm font-semibold mb-1.5">
              主な特徴・機能（1行1つ、任意）
            </label>
            <textarea
              value={form.features}
              onChange={e => setForm(f => ({ ...f, features: e.target.value }))}
              placeholder={"URLを入れるだけで自動生成\n10種類のデザインから選択\n商用利用OK"}
              rows={3}
              className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-rose-200 text-sm font-semibold mb-1.5">
                ターゲット（任意）
              </label>
              <input
                type="text"
                value={form.target}
                onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                placeholder="例: EC事業者、マーケター"
                className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-rose-200 text-sm font-semibold mb-1.5">
                業種（任意）
              </label>
              <input
                type="text"
                value={form.industry}
                onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                placeholder="例: IT・SaaS、EC、美容"
                className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-rose-200 text-sm font-semibold mb-1.5">
              USP / 強み（任意）
            </label>
            <input
              type="text"
              value={form.usp}
              onChange={e => setForm(f => ({ ...f, usp: e.target.value }))}
              placeholder="例: 業界最速・最安値・特許技術"
              className="w-full bg-slate-800/60 border border-rose-900/40 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-500/60 transition-colors"
            />
          </div>
        </div>

        {/* 配信先プラットフォーム */}
        <div className="mt-6">
          <h2 className="text-rose-200 text-sm font-bold mb-3">配信先プラットフォーム</h2>
          <div className="grid grid-cols-3 gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePlatformChange(p.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  platform === p.id
                    ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                    : 'border-rose-900/30 bg-slate-800/40 text-slate-400 hover:border-rose-700/50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* アスペクト比 */}
        <div className="mt-4">
          <h2 className="text-rose-200 text-sm font-bold mb-3">アスペクト比</h2>
          <div className="flex gap-2">
            {ASPECT_RATIOS.map(r => (
              <button
                key={r.ratio}
                onClick={() => setAspectRatio(r.ratio)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                  aspectRatio === r.ratio
                    ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                    : 'border-rose-900/30 bg-slate-800/40 text-slate-400 hover:border-rose-700/50'
                }`}
              >
                <div className="text-base mb-0.5">{r.icon}</div>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 尺 */}
        <div className="mt-4">
          <h2 className="text-rose-200 text-sm font-bold mb-3">動画の尺</h2>
          <div className="flex gap-2">
            {DURATION_PRESETS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  duration === d
                    ? 'border-rose-500 bg-rose-500/20 text-rose-200'
                    : 'border-rose-900/30 bg-slate-800/40 text-slate-400 hover:border-rose-700/50'
                }`}
              >
                {d}秒
              </button>
            ))}
          </div>
        </div>

        {/* 次へ */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full mt-8 py-4 rounded-xl font-bold text-white text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #f43f5e, #ec4899)' }}
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
              商品を分析中...
            </>
          ) : (
            <>
              次へ: ペルソナ設定
              <span className="material-symbols-outlined">arrow_forward</span>
            </>
          )}
        </button>
      </motion.div>
    </div>
  )
}
