'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Check,
  AlertCircle,
  ArrowLeft,
  Copy,
} from 'lucide-react'
import ProductInfoForm, { type ProductInfoData, type PersonaData as FormPersonaData } from '@/components/copy/ProductInfoForm'

type Step = 'input' | 'platforms' | 'generating' | 'result'

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

interface SnsCopyResult {
  platform: string
  primaryText: string
  headline: string
  description: string
  hashtags: string[]
  cta: string
}

const PLATFORM_OPTIONS = [
  { id: 'meta', label: 'Meta（Facebook / Instagram）', desc: '感情訴求が効果的。主テキスト125文字以内推奨。', color: 'blue' },
  { id: 'x', label: 'X（旧Twitter）', desc: '簡潔でインパクト重視。280文字以内。', color: 'gray' },
  { id: 'line', label: 'LINE 広告', desc: '親しみやすいトーン。幅広いリーチ。', color: 'green' },
] as const

function SnsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectIdParam = searchParams.get('projectId')

  const [step, setStep] = useState<Step>('input')
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

  // SNS広告設定
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['meta'])
  const [projectName, setProjectName] = useState('')

  // 結果
  const [results, setResults] = useState<SnsCopyResult[]>([])
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

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
          setPersona(proj.persona as PersonaData)
        }
        // 既存プロジェクトがあれば直接プラットフォーム選択へ
        setStep('platforms')
      }
    } catch {
      // ignore
    }
  }

  const handleProductInfoChange = (updates: Partial<ProductInfoData>) => {
    if (updates.productUrl !== undefined) setProductUrl(updates.productUrl)
    if (updates.productName !== undefined) setProductName(updates.productName)
    if (updates.productDesc !== undefined) setProductDesc(updates.productDesc)
    if (updates.productFeatures !== undefined) setProductFeatures(updates.productFeatures)
    if (updates.analyzedProductInfo !== undefined) setAnalyzedProductInfo(updates.analyzedProductInfo as ProductInfo | null)
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

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platformId)
        ? prev.filter(p => p !== platformId)
        : [...prev, platformId]
    )
  }

  const handleGenerate = async () => {
    if (selectedPlatforms.length === 0) {
      setError('プラットフォームを1つ以上選択してください')
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
        keywords: [],
        searchBehavior: 'SNSで情報収集する',
        purchaseTrigger: '口コミやレビューを参考にする',
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

      // 2. SNS広告コピー生成
      const res = await fetch('/api/copy/generate-sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          productInfo,
          persona: effectivePersona,
          platforms: selectedPlatforms,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'SNS広告コピーの生成に失敗しました')

      setResults(data.snsCopies || [])
      setStep('result')
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成に失敗しました')
      setStep('platforms')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const copyFullCopy = async (item: SnsCopyResult, index: number) => {
    const parts = [
      item.primaryText,
      '',
      item.headline,
      item.description,
      '',
      item.hashtags.map(h => `#${h}`).join(' '),
      '',
      `CTA: ${item.cta}`,
    ]
    await copyToClipboard(parts.join('\n'), `full-${index}`)
  }

  const platformLabel = (id: string): string => {
    return PLATFORM_OPTIONS.find(p => p.id === id)?.label || id
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
              <Hash className="w-5 h-5 text-yellow-500" />
              <h1 className="font-black text-gray-900">SNS広告コピー生成</h1>
            </div>
          </div>
          {step !== 'generating' && step !== 'result' && (
            <div className="flex items-center gap-2 text-sm mt-3">
              {(['input', 'platforms'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                    step === s ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' :
                    (['input', 'platforms'].indexOf(step) > i) ? 'text-gray-500' :
                    'text-gray-400'
                  }`}>
                    {(['input', 'platforms'].indexOf(step) > i) && (
                      <Check className="w-3 h-3" />
                    )}
                    <span>
                      {s === 'input' ? '商品情報' : 'プラットフォーム'}
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
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-6">
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
                onChange={handleProductInfoChange}
                theme="yellow"
                showPersona
                persona={persona as FormPersonaData | null}
                onGeneratePersona={generatePersona}
                isGeneratingPersona={isGeneratingPersona}
                projectName={projectName}
                onProjectNameChange={setProjectName}
              />

              <div className="mt-8 flex justify-end">
                <button
                  onClick={() => setStep('platforms')}
                  disabled={!productName}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                >
                  次へ：プラットフォーム選択 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 2: プラットフォーム選択 */}
          {step === 'platforms' && (
            <motion.div key="platforms" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-2xl font-black text-gray-900 mb-2">プラットフォームを選択</h2>
              <p className="text-gray-500 text-sm mb-6">SNS広告コピーを生成するプラットフォームを選択してください。複数選択可能です。</p>

              {/* プロジェクト名 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-2">プロジェクト名 <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder={productName ? `${productName} SNS広告` : 'プロジェクト名を入力'}
                  className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-yellow-500"
                />
              </div>

              {/* プラットフォーム選択 */}
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-600 mb-3">プラットフォーム（複数選択可）</label>
                <div className="space-y-3">
                  {PLATFORM_OPTIONS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                        selectedPlatforms.includes(p.id)
                          ? 'bg-yellow-50 border-yellow-400 text-gray-900'
                          : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${selectedPlatforms.includes(p.id) ? 'bg-yellow-200' : 'bg-gray-200'}`}>
                        <Hash className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{p.label}</p>
                        <p className="text-xs text-gray-400">{p.desc}</p>
                      </div>
                      {selectedPlatforms.includes(p.id) && <Check className="w-5 h-5 text-yellow-600" />}
                    </button>
                  ))}
                </div>
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
                  disabled={selectedPlatforms.length === 0 || !projectName}
                  className="flex items-center gap-2 px-8 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-colors text-lg"
                >
                  <Sparkles className="w-5 h-5" />SNSコピーを生成
                </button>
              </div>
            </motion.div>
          )}

          {/* 生成中 */}
          {step === 'generating' && (
            <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
                <Hash className="w-10 h-10 text-yellow-600 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">SNS広告コピーを生成中...</h2>
              <p className="text-gray-500">
                {selectedPlatforms.map(p => platformLabel(p)).join('・')}向けのコピーを作成しています
              </p>
              <div className="mt-8 flex justify-center gap-1">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-yellow-500"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 結果表示 */}
          {step === 'result' && results.length > 0 && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">SNS広告コピー生成結果</h2>
                  <p className="text-gray-500 text-sm mt-1">{results.length}プラットフォーム分のコピーを生成しました</p>
                </div>
                <button
                  onClick={() => { setResults([]); setStep('platforms') }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-lg transition-colors"
                >
                  再生成
                </button>
              </div>

              <div className="space-y-6">
                {results.map((item, index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                    {/* プラットフォームヘッダー */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-yellow-500" />
                        <span className="font-bold text-gray-900">{platformLabel(item.platform)}</span>
                      </div>
                      <button
                        onClick={() => copyFullCopy(item, index)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                          copiedKey === `full-${index}` ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Copy className="w-3 h-3" />
                        {copiedKey === `full-${index}` ? 'コピー済' : 'すべてコピー'}
                      </button>
                    </div>

                    {/* メインテキスト */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400">メインテキスト</p>
                        <button
                          onClick={() => copyToClipboard(item.primaryText, `primary-${index}`)}
                          className={`p-1 rounded transition-colors ${
                            copiedKey === `primary-${index}` ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">{item.primaryText}</p>
                    </div>

                    {/* 見出し */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400">見出し</p>
                        <button
                          onClick={() => copyToClipboard(item.headline, `headline-${index}`)}
                          className={`p-1 rounded transition-colors ${
                            copiedKey === `headline-${index}` ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-900 font-bold">{item.headline}</p>
                    </div>

                    {/* 説明文 */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-400">説明文</p>
                        <button
                          onClick={() => copyToClipboard(item.description, `desc-${index}`)}
                          className={`p-1 rounded transition-colors ${
                            copiedKey === `desc-${index}` ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'
                          }`}
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600">{item.description}</p>
                    </div>

                    {/* ハッシュタグ */}
                    {item.hashtags.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1">ハッシュタグ</p>
                        <div className="flex flex-wrap gap-1.5">
                          {item.hashtags.map(tag => (
                            <span
                              key={tag}
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-500 rounded-full cursor-pointer hover:bg-blue-100 transition-colors"
                              onClick={() => copyToClipboard(`#${tag}`, `tag-${index}-${tag}`)}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400">CTA:</p>
                        <span className="text-sm font-bold text-yellow-600">{item.cta}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* アクション */}
              <div className="flex items-center gap-3 pt-6 mt-6 border-t border-gray-200">
                <Link
                  href="/copy"
                  className="flex items-center gap-2 px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  ダッシュボードに戻る
                </Link>
                <button
                  onClick={() => { setResults([]); setStep('platforms') }}
                  className="flex items-center gap-2 px-5 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4" />別のプラットフォームで再生成
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function CopyNewSnsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SnsPageInner />
    </Suspense>
  )
}
