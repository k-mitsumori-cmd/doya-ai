'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  PenLine,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  Target,
  BarChart3,
  Hash,
} from 'lucide-react'

type Step = 'input' | 'persona' | 'settings' | 'generating'
type AdType = 'display' | 'search' | 'sns'
type WriterType = 'straight' | 'emotional' | 'logical' | 'provocative' | 'story'
type Purpose = 'awareness' | 'interest' | 'comparison' | 'purchase'

const WRITER_TYPES: { id: WriterType; label: string; desc: string; emoji: string }[] = [
  { id: 'straight', label: 'ストレート', desc: 'ベネフィット直訴型', emoji: '🎯' },
  { id: 'emotional', label: 'エモーショナル', desc: 'ペインポイント訴求型', emoji: '❤️' },
  { id: 'logical', label: 'ロジカル', desc: 'データ・実績訴求型', emoji: '📊' },
  { id: 'provocative', label: 'プロボカティブ', desc: '常識を覆す切り口', emoji: '⚡' },
  { id: 'story', label: 'ストーリー', desc: 'ビフォーアフター型', emoji: '📖' },
]

const AD_TYPES: { id: AdType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'display', label: 'ディスプレイ広告', icon: PenLine, desc: '見出し・説明文・キャッチコピーを20案以上' },
  { id: 'search', label: '検索広告（RSA）', icon: BarChart3, desc: 'Google/Yahoo! 文字数制限遵守' },
  { id: 'sns', label: 'SNS広告', icon: Hash, desc: 'Meta/X/LINE/TikTok向け最適化' },
]

const PURPOSES: { id: Purpose; label: string }[] = [
  { id: 'awareness', label: '認知' },
  { id: 'interest', label: '興味・関心' },
  { id: 'comparison', label: '比較・検討' },
  { id: 'purchase', label: '購入・CV' },
]

function CopyNewPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = (searchParams.get('type') as AdType) || 'display'

  const [step, setStep] = useState<Step>('input')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGeneratingPersona, setIsGeneratingPersona] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  // 入力データ
  const [productUrl, setProductUrl] = useState('')
  const [productName, setProductName] = useState('')
  const [productDesc, setProductDesc] = useState('')
  const [productFeatures, setProductFeatures] = useState('')
  const [analyzedProductInfo, setAnalyzedProductInfo] = useState<Record<string, unknown> | null>(null)

  // ペルソナ
  const [persona, setPersona] = useState<Record<string, unknown> | null>(null)
  const [personaText, setPersonaText] = useState('')

  // 生成設定
  const [selectedAdTypes, setSelectedAdTypes] = useState<AdType[]>([initialType])
  const [selectedWriters, setSelectedWriters] = useState<WriterType[]>(['straight'])
  const [selectedPurpose, setSelectedPurpose] = useState<Purpose>('awareness')
  const [projectName, setProjectName] = useState('')

  const analyzeUrl = async () => {
    if (!productUrl) return
    setIsAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/copy/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: productUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'URL解析に失敗しました')
      const info = data.productInfo || {}
      setAnalyzedProductInfo(info)
      if (info.productName) setProductName(info.productName)
      if (info.mainBenefit) setProductDesc(info.mainBenefit)
      if (info.features?.length) setProductFeatures(info.features.join('\n'))
      if (info.productName && !projectName) setProjectName(info.productName)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'URL解析に失敗しました')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const generatePersona = async () => {
    setIsGeneratingPersona(true)
    setError('')
    try {
      const productInfo = analyzedProductInfo || {
        productName,
        category: 'その他',
        targetAudience: '一般ユーザー',
        mainBenefit: productDesc,
        features: productFeatures.split('\n').filter(Boolean),
        priceRange: '要問合せ',
        tone: 'professional',
        uniqueValue: productDesc,
      }
      const res = await fetch('/api/copy/generate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productInfo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ペルソナ生成に失敗しました')
      setPersona(data.persona)
      setPersonaText(JSON.stringify(data.persona, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ペルソナ生成に失敗しました')
    } finally {
      setIsGeneratingPersona(false)
    }
  }

  const handleGenerate = async () => {
    if (!projectName) {
      setError('プロジェクト名を入力してください')
      return
    }
    setIsGenerating(true)
    setStep('generating')
    setError('')

    try {
      // 1. プロジェクト作成
      const projectRes = await fetch('/api/copy/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          productUrl,
          productInfo: analyzedProductInfo || {
            productName,
            category: 'その他',
            targetAudience: '一般ユーザー',
            mainBenefit: productDesc,
            features: productFeatures.split('\n').filter(Boolean),
            priceRange: '要問合せ',
            tone: 'professional',
            uniqueValue: productDesc,
          },
          persona,
          personaSource: persona ? 'generated' : 'none',
        }),
      })
      const projectData = await projectRes.json()
      if (!projectRes.ok) throw new Error(projectData.error || 'プロジェクト作成に失敗しました')
      const projectId = projectData.project.id

      // 2. コピー生成（SSE）
      const generateRes = await fetch('/api/copy/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          adTypes: selectedAdTypes,
          writerTypes: selectedWriters,
          purpose: selectedPurpose,
          productInfo: analyzedProductInfo || {
            productName,
            category: 'その他',
            targetAudience: '一般ユーザー',
            mainBenefit: productDesc,
            features: productFeatures.split('\n').filter(Boolean),
            priceRange: '要問合せ',
            tone: 'professional',
            uniqueValue: productDesc,
          },
          persona,
        }),
      })

      if (!generateRes.ok) {
        const err = await generateRes.json()
        throw new Error(err.error || 'コピー生成に失敗しました')
      }

      // SSEストリームを読み込む
      const reader = generateRes.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value)
          const lines = chunk.split('\n').filter(l => l.startsWith('data:'))
          for (const line of lines) {
            const jsonStr = line.slice(5).trim()
            if (jsonStr === '[DONE]') break
            try {
              const event = JSON.parse(jsonStr)
              if (event.type === 'complete' || event.type === 'done') {
                router.push(`/copy/${projectId}`)
                return
              }
            } catch { /* ignore */ }
          }
        }
      }

      router.push(`/copy/${projectId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
      setStep('settings')
      setIsGenerating(false)
    }
  }

  const toggleWriter = (w: WriterType) => {
    setSelectedWriters(prev =>
      prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w]
    )
  }

  const toggleAdType = (t: AdType) => {
    setSelectedAdTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ステッパー */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            {(['input', 'persona', 'settings'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                  step === s ? 'bg-amber-100 text-amber-600 border border-amber-300' :
                  (['input','persona','settings'].indexOf(step) > i) ? 'text-gray-500' :
                  'text-gray-400'
                }`}>
                  {(['input','persona','settings'].indexOf(step) > i) && (
                    <Check className="w-3 h-3" />
                  )}
                  <span>
                    {s === 'input' ? '商品情報' : s === 'persona' ? 'ペルソナ' : '生成設定'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: 商品情報入力 */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-black text-gray-900 mb-2">商品・サービス情報を入力</h1>
              <p className="text-gray-500 text-sm mb-6">URLを入力すると自動解析します。手動入力も可能です。</p>

              {/* URL解析 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2">商品・LP URL（任意）</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="url"
                      value={productUrl}
                      onChange={e => setProductUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full pl-9 pr-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    onClick={analyzeUrl}
                    disabled={!productUrl || isAnalyzing}
                    className="px-4 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors whitespace-nowrap"
                  >
                    {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : '自動解析'}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">商品・サービス名 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    placeholder="例：ドヤコピーAI"
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">商品説明</label>
                  <textarea
                    value={productDesc}
                    onChange={e => setProductDesc(e.target.value)}
                    placeholder="商品の概要・特徴・ターゲットなど"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">特徴・ベネフィット</label>
                  <textarea
                    value={productFeatures}
                    onChange={e => setProductFeatures(e.target.value)}
                    placeholder="例：月200回まで生成可能、5種類のライタータイプ、CSV出力対応"
                    rows={3}
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep('persona')}
                  disabled={!productName}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                >
                  次へ：ペルソナ設定 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: ペルソナ設定 */}
          {step === 'persona' && (
            <motion.div key="persona" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-black text-gray-900 mb-2">ターゲットペルソナを設定</h1>
              <p className="text-gray-500 text-sm mb-6">AIがペルソナを自動生成します。スキップして手動記述も可能です。</p>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={generatePersona}
                  disabled={isGeneratingPersona}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                >
                  {isGeneratingPersona ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />生成中...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />AIでペルソナ生成</>
                  )}
                </button>
                <a href="/persona" target="_blank" className="flex items-center gap-2 px-5 py-3 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-600 font-bold rounded-xl transition-colors text-sm">
                  <Target className="w-4 h-4" />ドヤペルソナAIから取込
                </a>
              </div>

              {persona && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-xl shadow-sm">
                  <p className="text-amber-600 text-sm font-bold mb-2 flex items-center gap-1">
                    <Check className="w-4 h-4" />ペルソナ生成完了
                  </p>
                  <div className="text-gray-600 text-sm space-y-1">
                    {!!persona.demographics && (
                      <p><span className="text-gray-500">デモグラ：</span>{String((persona.demographics as Record<string,unknown>)?.summary || '')}</p>
                    )}
                    {!!persona.painPoints && (
                      <p><span className="text-gray-500">ペイン：</span>{String((persona.painPoints as string[])?.[0] || '')}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2">
                  ペルソナ詳細（自由記述・AIが参照します）
                </label>
                <textarea
                  value={personaText}
                  onChange={e => setPersonaText(e.target.value)}
                  placeholder="例：30代女性、マーケティング担当者、コピー作成に時間がかかっていて困っている..."
                  rows={6}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 resize-none font-mono text-sm"
                />
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep('input')}
                  className="flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />戻る
                </button>
                <button
                  onClick={() => setStep('settings')}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-white font-bold rounded-xl transition-colors"
                >
                  次へ：生成設定 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: 生成設定 */}
          {step === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h1 className="text-2xl font-black text-gray-900 mb-2">生成設定</h1>
              <p className="text-gray-500 text-sm mb-6">広告タイプ・ライタータイプ・目的を選択してください。</p>

              <div className="space-y-6">
                {/* プロジェクト名 */}
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-2">プロジェクト名 <span className="text-red-400">*</span></label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={e => setProjectName(e.target.value)}
                    placeholder={productName ? `${productName} 広告コピー` : 'プロジェクト名を入力'}
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500"
                  />
                </div>

                {/* 広告タイプ */}
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-3">広告タイプ（複数選択可）</label>
                  <div className="space-y-2">
                    {AD_TYPES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleAdType(t.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left ${
                          selectedAdTypes.includes(t.id)
                            ? 'bg-amber-100 border-amber-400 text-gray-900'
                            : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg ${selectedAdTypes.includes(t.id) ? 'bg-amber-200' : 'bg-gray-100'}`}>
                          <t.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{t.label}</p>
                          <p className="text-xs text-gray-400">{t.desc}</p>
                        </div>
                        {selectedAdTypes.includes(t.id) && <Check className="w-4 h-4 text-amber-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ライタータイプ */}
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-3">ライタータイプ（複数選択可）</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WRITER_TYPES.map(w => (
                      <button
                        key={w.id}
                        onClick={() => toggleWriter(w.id)}
                        className={`flex items-center gap-2 p-3 rounded-xl border transition-colors text-left ${
                          selectedWriters.includes(w.id)
                            ? 'bg-amber-100 border-amber-400 text-gray-900'
                            : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        <span>{w.emoji}</span>
                        <div>
                          <p className="text-xs font-bold">{w.label}</p>
                          <p className="text-xs text-gray-400">{w.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 目的 */}
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-3">広告の目的</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PURPOSES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPurpose(p.id)}
                        className={`py-2.5 rounded-xl border text-sm font-bold transition-colors ${
                          selectedPurpose === p.id
                            ? 'bg-amber-100 border-amber-400 text-amber-600'
                            : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep('persona')}
                  className="flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />戻る
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={selectedAdTypes.length === 0 || selectedWriters.length === 0 || !projectName}
                  className="flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors text-lg"
                >
                  <Sparkles className="w-5 h-5" />コピーを生成する
                </button>
              </div>
            </motion.div>
          )}

          {/* 生成中 */}
          {step === 'generating' && (
            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-10 h-10 text-amber-600 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">コピーを生成中...</h2>
              <p className="text-gray-500">5種類のライターが広告コピーを作成しています</p>
              <div className="mt-8 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-amber-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function CopyNewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <CopyNewPageInner />
    </Suspense>
  )
}
