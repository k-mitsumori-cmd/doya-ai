'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Globe,
  BarChart3,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  ArrowLeft,
  Copy,
  Plus,
  X,
} from 'lucide-react'
import ProductInfoForm, { type PersonaData as FormPersonaData } from '@/components/copy/ProductInfoForm'

type Step = 'input' | 'keywords' | 'generating' | 'result'
type Platform = 'google' | 'yahoo'

interface ProductInfo {
  productName: string
  category: string
  targetAudience: string
  mainBenefit: string
  features: string[]
  priceRange: string
  tone: string
  uniqueValue: string
}

interface PersonaData {
  name: string
  age: string
  gender: string
  occupation: string
  income: string
  painPoints: string[]
  desires: string[]
  keywords: string[]
  searchBehavior: string
  purchaseTrigger: string
}

interface SearchCopyResult {
  headlines: string[]
  descriptions: string[]
  displayPath: string[]
}

function SearchPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')

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
  const [analyzedProductInfo, setAnalyzedProductInfo] = useState<ProductInfo | null>(null)

  // ペルソナ
  const [persona, setPersona] = useState<PersonaData | null>(null)

  // 検索広告設定
  const [platform, setPlatform] = useState<Platform>('google')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [projectName, setProjectName] = useState('')

  // 結果
  const [result, setResult] = useState<SearchCopyResult | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null)

  // 既存プロジェクトから情報取得
  useEffect(() => {
    if (projectIdParam) {
      fetchProjectInfo(projectIdParam)
    }
  }, [projectIdParam])

  const fetchProjectInfo = async (pid: string) => {
    try {
      const res = await fetch(`/api/copy/projects/${pid}`)
      if (res.ok) {
        const data = await res.json()
        const proj = data.project
        if (proj.productInfo) {
          const info = proj.productInfo as ProductInfo
          setAnalyzedProductInfo(info)
          setProductName(info.productName || '')
          setProductDesc(info.mainBenefit || '')
          setProductFeatures((info.features || []).join('\n'))
          setProjectName(proj.name || '')
        }
        if (proj.persona) {
          const p = proj.persona as PersonaData
          setPersona(p)
          if (p.keywords?.length) {
            setKeywords(p.keywords)
          }
        }
        // 既存プロジェクトがあれば直接キーワードステップへ
        setStep('keywords')
      }
    } catch {
      // ignore
    }
  }

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
      const productInfo = buildProductInfo()
      const res = await fetch('/api/copy/generate-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productInfo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ペルソナ生成に失敗しました')
      setPersona(data.persona)
      if (data.persona?.keywords?.length) {
        setKeywords(prev => prev.length ? prev : data.persona.keywords)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ペルソナ生成に失敗しました')
    } finally {
      setIsGeneratingPersona(false)
    }
  }

  const buildProductInfo = (): ProductInfo => {
    return analyzedProductInfo || {
      productName,
      category: 'その他',
      targetAudience: '一般ユーザー',
      mainBenefit: productDesc,
      features: productFeatures.split('\n').filter(Boolean),
      priceRange: '要問合せ',
      tone: 'professional',
      uniqueValue: productDesc,
    }
  }

  const addKeyword = () => {
    const trimmed = keywordInput.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setKeywords(prev => [...prev, trimmed])
      setKeywordInput('')
    }
  }

  const removeKeyword = (keyword: string) => {
    setKeywords(prev => prev.filter(k => k !== keyword))
  }

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  const handleGenerate = async () => {
    if (keywords.length === 0) {
      setError('検索キーワードを1つ以上入力してください')
      return
    }
    if (!projectName) {
      setError('プロジェクト名を入力してください')
      return
    }

    setIsGenerating(true)
    setStep('generating')
    setError('')

    try {
      const productInfo = buildProductInfo()
      const effectivePersona: PersonaData = persona || {
        name: 'ターゲットユーザー',
        age: '30代',
        gender: '不明',
        occupation: '会社員',
        income: '400〜600万円',
        painPoints: ['課題を抱えている'],
        desires: ['解決したい'],
        keywords,
        searchBehavior: '検索エンジンで情報収集する',
        purchaseTrigger: '比較検討後に決定する',
      }

      // 1. プロジェクト作成（既存プロジェクトがない場合）
      let projectId = projectIdParam
      if (!projectId) {
        const projectRes = await fetch('/api/copy/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: projectName,
            productUrl,
            productInfo,
            persona: effectivePersona,
            personaSource: persona ? 'generated' : 'none',
          }),
        })
        const projectData = await projectRes.json()
        if (!projectRes.ok) throw new Error(projectData.error || 'プロジェクト作成に失敗しました')
        projectId = projectData.project.id
      }

      // 2. 検索広告コピー生成
      const res = await fetch('/api/copy/generate-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          productInfo,
          persona: effectivePersona,
          platform,
          keywords,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '検索広告コピーの生成に失敗しました')

      setResult(data.searchCopy)
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
      setStep('keywords')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedIndex(key)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const copyAllHeadlines = async () => {
    if (!result) return
    const text = result.headlines.join('\n')
    await copyToClipboard(text, 'all-headlines')
  }

  const copyAllDescriptions = async () => {
    if (!result) return
    const text = result.descriptions.join('\n')
    await copyToClipboard(text, 'all-descriptions')
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/copy"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <h1 className="font-black text-gray-900">検索広告（RSA）コピー生成</h1>
            </div>
          </div>
          {step !== 'generating' && step !== 'result' && (
            <div className="flex items-center gap-2 text-sm mt-3">
              {(['input', 'keywords'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                    step === s ? 'bg-orange-100 text-orange-600 border border-orange-300' :
                    (['input', 'keywords'].indexOf(step) > i) ? 'text-gray-500' :
                    'text-gray-400'
                  }`}>
                    {(['input', 'keywords'].indexOf(step) > i) && (
                      <Check className="w-3 h-3" />
                    )}
                    <span>
                      {s === 'input' ? '商品情報' : 'キーワード設定'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-sm mb-6">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: 商品情報入力 */}
          {step === 'input' && (
            <motion.div key="input" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-2xl font-black text-gray-900 mb-2">商品・サービス情報を入力</h2>
              <p className="text-gray-500 text-sm mb-6">URLを入力すると自動解析します。手動入力も可能です。</p>

              <ProductInfoForm
                data={{
                  productUrl,
                  productName,
                  productDesc,
                  productFeatures,
                  analyzedProductInfo: analyzedProductInfo as Record<string, unknown> | null,
                }}
                onChange={(updates) => {
                  if (updates.productUrl !== undefined) setProductUrl(updates.productUrl)
                  if (updates.productName !== undefined) setProductName(updates.productName)
                  if (updates.productDesc !== undefined) setProductDesc(updates.productDesc)
                  if (updates.productFeatures !== undefined) setProductFeatures(updates.productFeatures)
                  if (updates.analyzedProductInfo !== undefined) setAnalyzedProductInfo(updates.analyzedProductInfo as ProductInfo | null)
                }}
                theme="orange"
                showPersona
                persona={persona as FormPersonaData | null}
                onGeneratePersona={generatePersona}
                isGeneratingPersona={isGeneratingPersona}
                projectName={projectName}
                onProjectNameChange={setProjectName}
              />

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep('keywords')}
                  disabled={!productName}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                >
                  次へ：キーワード設定 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: キーワード設定 */}
          {step === 'keywords' && (
            <motion.div key="keywords" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-2xl font-black text-gray-900 mb-2">検索キーワードを設定</h2>
              <p className="text-gray-500 text-sm mb-6">RSA広告に含める検索キーワードを入力してください。</p>

              {/* プロジェクト名 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2">プロジェクト名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder={productName ? `${productName} 検索広告` : 'プロジェクト名を入力'}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* プラットフォーム選択 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-3">広告プラットフォーム</label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { id: 'google' as Platform, label: 'Google 広告', desc: '見出し30文字・説明文90文字' },
                    { id: 'yahoo' as Platform, label: 'Yahoo! 広告', desc: '見出し20文字・説明文50文字' },
                  ]).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        platform === p.id
                          ? 'bg-orange-100 border-orange-400 text-gray-900'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <p className="font-bold text-sm">{p.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                      {platform === p.id && <Check className="w-4 h-4 text-orange-600 mt-1" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* キーワード入力 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2">検索キーワード <span className="text-red-400">*</span></label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    placeholder="キーワードを入力してEnter"
                    className="flex-1 px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-orange-500"
                  />
                  <button
                    onClick={addKeyword}
                    disabled={!keywordInput.trim()}
                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 font-bold rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* キーワードタグ */}
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {keywords.map(kw => (
                      <span
                        key={kw}
                        className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 text-sm rounded-full border border-orange-300"
                      >
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="text-orange-400 hover:text-orange-600">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">{keywords.length}個のキーワード</p>
              </div>

              <div className="mt-8 flex justify-between">
                <button
                  onClick={() => setStep('input')}
                  className="flex items-center gap-2 px-5 py-3 text-gray-500 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />戻る
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={keywords.length === 0 || !projectName}
                  className="flex items-center gap-2 px-8 py-3 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors text-lg"
                >
                  <Sparkles className="w-5 h-5" />RSAコピーを生成
                </button>
              </div>
            </motion.div>
          )}

          {/* 生成中 */}
          {step === 'generating' && (
            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-10 h-10 text-orange-600 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">RSAコピーを生成中...</h2>
              <p className="text-gray-500">{platform === 'google' ? 'Google' : 'Yahoo!'}広告用のレスポンシブ検索広告コピーを作成しています</p>
              <div className="mt-8 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-orange-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 結果表示 */}
          {step === 'result' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">RSAコピー生成結果</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {platform === 'google' ? 'Google' : 'Yahoo!'}広告用 / キーワード: {keywords.join('、')}
                  </p>
                </div>
                <button
                  onClick={() => { setResult(null); setStep('keywords') }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
                >
                  再生成
                </button>
              </div>

              {/* ヘッドライン */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    見出し（{result.headlines.length}案）
                    <span className="text-xs text-gray-400 font-normal">
                      {platform === 'google' ? '30文字以内' : '20文字以内'}
                    </span>
                  </h3>
                  <button
                    onClick={copyAllHeadlines}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      copiedIndex === 'all-headlines' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedIndex === 'all-headlines' ? 'コピー済' : 'すべてコピー'}
                  </button>
                </div>
                <div className="space-y-2">
                  {result.headlines.map((headline, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs text-gray-400 font-mono w-6 text-right flex-shrink-0">{i + 1}</span>
                        <p className="text-sm text-gray-900 font-medium truncate">{headline}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0">{headline.length}文字</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(headline, `h-${i}`)}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ml-2 ${
                          copiedIndex === `h-${i}` ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 説明文 */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    説明文（{result.descriptions.length}案）
                    <span className="text-xs text-gray-400 font-normal">
                      {platform === 'google' ? '90文字以内' : '50文字以内'}
                    </span>
                  </h3>
                  <button
                    onClick={copyAllDescriptions}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      copiedIndex === 'all-descriptions' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <Copy className="w-3 h-3" />
                    {copiedIndex === 'all-descriptions' ? 'コピー済' : 'すべてコピー'}
                  </button>
                </div>
                <div className="space-y-2">
                  {result.descriptions.map((desc, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <span className="text-xs text-gray-400 font-mono w-6 text-right flex-shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-sm text-gray-900 leading-relaxed">{desc}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">{desc.length}文字</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(desc, `d-${i}`)}
                        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ml-2 ${
                          copiedIndex === `d-${i}` ? 'text-green-500 bg-green-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 表示パス */}
              {result.displayPath.length > 0 && (
                <div className="mb-8">
                  <h3 className="font-bold text-gray-900 mb-3">表示URLパス</h3>
                  <div className="p-3 bg-white border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600 font-mono">
                      example.com/<span className="text-orange-600">{result.displayPath.join('/')}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* アクション */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <Link
                  href="/copy"
                  className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  ダッシュボードに戻る
                </Link>
                <button
                  onClick={() => { setResult(null); setStep('keywords') }}
                  className="flex items-center gap-2 px-5 py-3 bg-orange-500 hover:bg-orange-400 text-white font-bold rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4" />別のキーワードで再生成
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function CopyNewSearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  )
}
