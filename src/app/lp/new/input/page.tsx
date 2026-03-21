'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link2, PenLine, Plus, X, ArrowRight, Loader2, LogIn, Lightbulb, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

type InputMode = 'url' | 'manual'

const PURPOSES = [
  { id: 'resource', label: '資料請求', desc: 'BtoB向け、ホワイトペーパーDL' },
  { id: 'demo', label: '無料体験・デモ', desc: 'SaaS/サービス向け' },
  { id: 'purchase', label: '商品購入', desc: 'EC/物販向け' },
  { id: 'inquiry', label: '問い合わせ', desc: 'コンサル/BtoB向け' },
  { id: 'signup', label: '会員登録', desc: 'メディア/コミュニティ向け' },
  { id: 'event', label: 'イベント集客', desc: 'セミナー/ウェビナー向け' },
  { id: 'recruitment', label: '採用', desc: '採用ページ向け' },
]

export default function LpInputPage() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [mode, setMode] = useState<InputMode>('manual')
  const [urlInput, setUrlInput] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)

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

  /** AIが空フィールドを自動推測して入力 */
  const suggestFields = async () => {
    if (!name.trim()) return
    setSuggesting(true)
    try {
      const trigger = description.trim() ? 'description' : 'name'
      const res = await fetch('/api/lp/suggest-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partialInfo: {
            name,
            description,
            target,
            price,
            ctaGoal,
            features: features.filter(Boolean),
            problems: problems.filter(Boolean),
            purposes,
          },
          trigger,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'エラーが発生しました')
      const s = data.suggestions
      // 空フィールドのみ埋める（ユーザー入力は上書きしない）
      if (s.description && !description.trim()) setDescription(s.description)
      if (s.target && !target.trim()) setTarget(s.target)
      if (s.price && !price.trim()) setPrice(s.price)
      if (s.ctaGoal && !ctaGoal.trim()) setCtaGoal(s.ctaGoal)
      if (s.features?.length && !features.some((f: string) => f.trim())) {
        setFeatures([...s.features.slice(0, 5), ...Array(Math.max(0, 3 - s.features.length)).fill('')])
      }
      if (s.problems?.length && !problems.some((p: string) => p.trim())) {
        setProblems([...s.problems.slice(0, 3), ...Array(Math.max(0, 2 - s.problems.length)).fill('')])
      }
      if (s.purposes?.length && purposes.length === 0) {
        setPurposes(s.purposes)
      }
      toast.success('AIが入力を補完しました')
    } catch (e: any) {
      toast.error(e.message || 'AI提案に失敗しました')
    } finally {
      setSuggesting(false)
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

  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-lp-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-lp-primary" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-lp-bg flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-lp-primary/20 flex items-center justify-center mb-6">
          <LogIn className="w-8 h-8 text-lp-primary" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">ログインが必要です</h2>
        <p className="text-slate-400 text-sm mb-6">ワイヤーフレーム作成機能を使うにはGoogleアカウントでログインしてください。</p>
        <button
          onClick={() => router.push('/auth/signin?callbackUrl=/lp/new/input')}
          className="flex items-center gap-2 bg-lp-primary hover:bg-lp-primary/90 text-lp-bg font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-lp-primary/20"
        >
          <LogIn className="w-4 h-4" />
          Googleでログイン
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

      {/* ステップインジケーター（ドットスタイル） */}
      <div className="bg-lp-surface/80 backdrop-blur-md border-b border-lp-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs font-bold text-lp-primary uppercase tracking-widest">Step 1 / 4</p>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-8 rounded-full bg-lp-primary shadow-[0_0_10px_rgba(5,183,214,0.5)]" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
            <div className="h-2 w-2 rounded-full bg-lp-primary/20" />
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* メインフォーム */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h1 className="text-2xl font-black text-white mb-1 tracking-tight">商品情報を入力してください</h1>
              <p className="text-slate-400 text-sm">商品名を入れるだけでAIが残りを自動入力。URLからの自動抽出も可能です。</p>
            </div>

            {/* 入力方法タブ */}
            <div className="flex border-b border-lp-border">
              <button
                onClick={() => setMode('url')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-[3px] transition-colors ${mode === 'url' ? 'border-lp-primary text-lp-primary' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                <Link2 className="w-4 h-4" /> URL入力
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-[3px] transition-colors ${mode === 'manual' ? 'border-lp-primary text-lp-primary' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
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
                    className="flex-1 bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary"
                  />
                  <button
                    onClick={analyzeUrl}
                    disabled={analyzing || !urlInput.trim()}
                    className="px-6 py-3 bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-lp-primary/20"
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
                {/* 商品名 + AI自動入力ボタン */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-300 mb-2">
                    商品・サービス名 <span className="text-lp-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="例: ドヤマーケAI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary"
                  />

                  {/* AI自動入力ボタン — 商品名入力後に表示 */}
                  <AnimatePresence>
                    {name.trim() && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={suggestFields}
                          disabled={suggesting}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all
                            bg-gradient-to-r from-lp-primary/20 to-purple-500/20 border border-lp-primary/30
                            hover:from-lp-primary/30 hover:to-purple-500/30 hover:border-lp-primary/50
                            text-lp-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {suggesting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4" />
                          )}
                          {suggesting ? 'AIが入力を推測中...' : 'AIが残りを自動入力する'}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-300 mb-2">商品・サービスの説明</label>
                  <textarea
                    placeholder="どんなサービスか、どんな価値を提供するか..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">ターゲット層</label>
                  <input
                    type="text"
                    placeholder="例: 中小企業のマーケ担当者"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">価格</label>
                  <input
                    type="text"
                    placeholder="例: ¥9,980/月"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-300 mb-2">CTA目的</label>
                  <input
                    type="text"
                    placeholder="例: 無料トライアル申込み"
                    value={ctaGoal}
                    onChange={(e) => setCtaGoal(e.target.value)}
                    className="w-full bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary"
                  />
                </div>
              </div>

              {/* 特徴 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">主な特徴（最大5つ）</label>
                <div className="space-y-2">
                  {features.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`特徴 ${i + 1}`}
                        value={f}
                        onChange={(e) => { const arr = [...features]; arr[i] = e.target.value; setFeatures(arr) }}
                        className="flex-1 bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary text-sm"
                      />
                      {features.length > 1 && (
                        <button onClick={() => setFeatures(features.filter((_, j) => j !== i))} className="p-2 text-slate-600 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {features.length < 5 && (
                    <button onClick={() => setFeatures([...features, ''])} className="text-sm text-lp-primary hover:opacity-80 flex items-center gap-1 font-bold transition-opacity">
                      <Plus className="w-4 h-4" /> 特徴を追加する
                    </button>
                  )}
                </div>
              </div>

              {/* 解決する課題 */}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">解決する課題（最大3つ）</label>
                <div className="space-y-2">
                  {problems.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        placeholder={`課題 ${i + 1}`}
                        value={p}
                        onChange={(e) => { const arr = [...problems]; arr[i] = e.target.value; setProblems(arr) }}
                        className="flex-1 bg-lp-bg border border-lp-primary/30 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-lp-primary focus:ring-1 focus:ring-lp-primary text-sm"
                      />
                      {problems.length > 1 && (
                        <button onClick={() => setProblems(problems.filter((_, j) => j !== i))} className="p-2 text-slate-600 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {problems.length < 3 && (
                    <button onClick={() => setProblems([...problems, ''])} className="text-sm text-lp-primary hover:opacity-80 flex items-center gap-1 font-bold transition-opacity">
                      <Plus className="w-4 h-4" /> 追加
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {/* LP目的 */}
            <div>
              <label className="block text-sm font-bold text-slate-300 mb-3">
                LPの目的（複数選択可）
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {PURPOSES.map((p) => {
                  const selected = purposes.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePurpose(p.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${selected ? 'border-lp-primary bg-lp-primary/20' : 'border-lp-primary/30 bg-lp-bg hover:bg-lp-primary/5'}`}
                    >
                      <div className="text-sm font-medium text-white">{p.label}</div>
                      <div className="text-xs text-slate-500">{p.desc}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 次へボタン */}
            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={saving || !name.trim()}
                className="w-full bg-lp-primary hover:bg-lp-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-lp-bg font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-lp-primary/20 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-5 h-5 animate-spin" />}
                次へ: 構成案を生成する
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* サイドバー：入力のヒント */}
          <div className="hidden lg:block">
            <div className="sticky top-20 p-6 rounded-xl bg-lp-primary/5 border border-lp-primary/20">
              <div className="flex items-center gap-2 mb-4 text-lp-primary">
                <Lightbulb className="w-5 h-5" />
                <h4 className="font-bold">入力のヒント</h4>
              </div>
              <div className="space-y-4 text-sm text-slate-400">
                <div>
                  <p className="font-bold text-slate-300 mb-1">商品名だけでOK</p>
                  <p>商品名を入力して「AIが残りを自動入力する」ボタンを押すだけで、すべてのフィールドをAIが推測します。</p>
                </div>
                <div>
                  <p className="font-bold text-slate-300 mb-1">ターゲットを絞る</p>
                  <p>「誰でも」より「月商300万以上のEC事業者」のように具体化。</p>
                </div>
                <div>
                  <p className="font-bold text-slate-300 mb-1">特徴は数字で</p>
                  <p>「速い」より「導入3分で完了」「CTR平均2.5倍」のように数値化。</p>
                </div>
                <div>
                  <p className="font-bold text-slate-300 mb-1">URLがあれば自動取得</p>
                  <p>既存サイトのURLを入れると、商品情報を自動で抽出します。</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
