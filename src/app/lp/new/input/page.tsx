'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Link2, PenLine, Plus, X, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type InputMode = 'url' | 'manual'

const PURPOSES = [
  { id: 'resource', label: '資料請求', icon: '📋', desc: 'BtoB向け、ホワイトペーパーDL' },
  { id: 'demo', label: '無料体験・デモ', icon: '🎮', desc: 'SaaS/サービス向け' },
  { id: 'purchase', label: '商品購入', icon: '🛒', desc: 'EC/物販向け' },
  { id: 'inquiry', label: '問い合わせ', icon: '💬', desc: 'コンサル/BtoB向け' },
  { id: 'signup', label: '会員登録', icon: '👤', desc: 'メディア/コミュニティ向け' },
  { id: 'event', label: 'イベント集客', icon: '🎤', desc: 'セミナー/ウェビナー向け' },
  { id: 'recruitment', label: '採用', icon: '🏢', desc: '採用ページ向け' },
]

export default function LpInputPage() {
  const router = useRouter()
  const [mode, setMode] = useState<InputMode>('manual')
  const [urlInput, setUrlInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [target, setTarget] = useState('')
  const [price, setPrice] = useState('')
  const [ctaGoal, setCtaGoal] = useState('問い合わせ')
  const [features, setFeatures] = useState(['', '', ''])
  const [problems, setProblems] = useState(['', ''])
  const [purposes, setPurposes] = useState<string[]>([])

  const analyzeUrl = async () => {
    if (!urlInput.trim()) return
    setAnalyzing(true)
    setAnalyzeError('')
    try {
      const res = await fetch('/api/lp/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
      const info = data.productInfo
      if (info.name) setName(info.name)
      if (info.description) setDescription(info.description)
      if (info.target) setTarget(info.target)
      if (info.price) setPrice(info.price)
      if (info.ctaGoal) setCtaGoal(info.ctaGoal)
      if (info.features?.length) setFeatures([...info.features.slice(0, 5), ...Array(Math.max(0, 3 - info.features.length)).fill('')])
      if (info.problems?.length) setProblems([...info.problems.slice(0, 3), ...Array(Math.max(0, 2 - info.problems.length)).fill('')])
      setMode('manual')
    } catch (e: any) {
      setAnalyzeError(e.message || 'URLの解析に失敗しました')
    } finally {
      setAnalyzing(false)
    }
  }

  const togglePurpose = (id: string) => {
    setPurposes((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id])
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('商品名を入力してください')
      return
    }
    setSaving(true)
    try {
      const productInfo = {
        name,
        description,
        target,
        price,
        ctaGoal,
        features: features.filter(Boolean),
        problems: problems.filter(Boolean),
      }
      const res = await fetch('/api/lp/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, purpose: purposes, productInfo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/lp/new/structure?projectId=${data.project.id}`)
    } catch (e: any) {
      toast.error(e.message || 'エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* ステップインジケーター */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 text-sm">
            {['商品情報入力', '構成案選択', 'コピー確認', 'デザイン選択'].map((step, i) => (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-slate-700" />}
                <div className={`flex items-center gap-1.5 ${i === 0 ? 'text-cyan-400' : 'text-slate-600'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-500'}`}>
                    {i + 1}
                  </div>
                  <span className="hidden sm:inline font-medium">{step}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">商品情報を入力してください</h1>
          <p className="text-slate-400 text-sm">URLを入れるだけで自動抽出、または手動でフォームに入力できます。</p>
        </div>

        {/* 入力方法タブ */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'url' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <Link2 className="w-4 h-4" /> URL入力
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            <PenLine className="w-4 h-4" /> 手動入力
          </button>
        </div>

        {/* URL入力 */}
        {mode === 'url' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="https://example.com/product"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={analyzeUrl}
                disabled={analyzing || !urlInput.trim()}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-lg transition-colors flex items-center gap-2"
              >
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {analyzing ? '解析中...' : '解析する'}
              </button>
            </div>
            {analyzeError && <p className="text-red-400 text-sm">{analyzeError}</p>}
          </motion.div>
        )}

        {/* 手動入力フォーム */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                商品・サービス名 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="例: ドヤマーケAI"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">商品・サービスの説明</label>
              <textarea
                placeholder="どんなサービスか、どんな価値を提供するか..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">ターゲット層</label>
              <input
                type="text"
                placeholder="例: 中小企業のマーケ担当者"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">価格</label>
              <input
                type="text"
                placeholder="例: ¥9,980/月"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">CTA目的</label>
              <input
                type="text"
                placeholder="例: 無料トライアル申込み"
                value={ctaGoal}
                onChange={(e) => setCtaGoal(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 特徴 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">主な特徴（最大5つ）</label>
            <div className="space-y-2">
              {features.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`特徴 ${i + 1}`}
                    value={f}
                    onChange={(e) => { const arr = [...features]; arr[i] = e.target.value; setFeatures(arr) }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                  />
                  {features.length > 1 && (
                    <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="p-2 text-slate-600 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {features.length < 5 && (
                <button onClick={() => setFeatures([...features, ''])} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> 追加
                </button>
              )}
            </div>
          </div>

          {/* 解決する課題 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">解決する課題（最大3つ）</label>
            <div className="space-y-2">
              {problems.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    placeholder={`課題 ${i + 1}`}
                    value={p}
                    onChange={(e) => { const arr = [...problems]; arr[i] = e.target.value; setProblems(arr) }}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-sm"
                  />
                  {problems.length > 1 && (
                    <button onClick={() => setProblems(problems.filter((_, j) => j !== i))} className="p-2 text-slate-600 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {problems.length < 3 && (
                <button onClick={() => setProblems([...problems, ''])} className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  <Plus className="w-4 h-4" /> 追加
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* LP目的 */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            LPの目的（複数選択可）
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {PURPOSES.map((p) => {
              const selected = purposes.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePurpose(p.id)}
                  className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors ${selected ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'}`}
                >
                  <span className="text-lg flex-shrink-0">{p.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-white">{p.label}</div>
                    <div className="text-xs text-slate-500">{p.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 次へボタン */}
        <div className="flex justify-end pt-4">
          <button
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black px-8 py-4 rounded-xl text-base transition-colors"
          >
            {saving && <Loader2 className="w-5 h-5 animate-spin" />}
            次へ: 構成案を生成する
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
