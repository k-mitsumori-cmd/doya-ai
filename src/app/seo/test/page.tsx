'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { articleSections } from './data'
import { ArticleTemplate } from './types'
import { HorizontalScrollSection } from './components/HorizontalScrollSection'
import { Sparkles, Play, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Loader2, CheckCircle2, Lightbulb, FileText, Zap, Target, TrendingUp, Search, BarChart3, Link2, X, HelpCircle, Download, Maximize2, Square, RectangleHorizontal, RectangleVertical, Upload, User, ImageIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { Toaster, toast } from 'react-hot-toast'

// 記事タイプ定義（/seo/create と同じ）
const ARTICLE_TYPES = [
  { id: 'comparison', label: '比較記事', desc: '複数の製品やサービスを比較', icon: BarChart3 },
  { id: 'howto', label: 'HowTo記事', desc: '手順や方法を解説', icon: FileText },
  { id: 'explanation', label: '解説記事', desc: '概念や仕組みを詳しく説明', icon: Lightbulb },
  { id: 'case', label: '事例記事', desc: '導入事例や成功例を紹介', icon: Target },
  { id: 'ranking', label: 'ランキング記事', desc: 'おすすめ順に紹介', icon: TrendingUp },
] as const

const AUDIENCE_PRESETS = [
  { id: 'marketer', label: 'マーケ担当者', desc: 'SEO/広告を扱う人' },
  { id: 'executive', label: '経営者', desc: '意思決定者・役員' },
  { id: 'hr', label: '人事担当', desc: '採用・労務担当' },
  { id: 'beginner', label: '初心者', desc: 'その分野を学び始めた人' },
  { id: 'expert', label: '上級者', desc: '既に詳しい人向け' },
  { id: 'custom', label: '自分で入力', desc: '' },
] as const

const TONE_OPTIONS = [
  { id: 'logical', label: '論理的', desc: 'データや根拠を重視', emoji: '📊' },
  { id: 'friendly', label: 'やさしい', desc: '初心者にも分かりやすく', emoji: '😊' },
  { id: 'professional', label: '専門的', desc: '業界知識を前提に', emoji: '🎓' },
  { id: 'casual', label: 'カジュアル', desc: '親しみやすい文体', emoji: '💬' },
] as const

const CHAR_PRESETS = [
  { value: 3000, label: '3,000字', desc: 'コンパクトな記事', minPlan: 'GUEST' },
  { value: 5000, label: '5,000字', desc: '要点を絞った記事', minPlan: 'GUEST' },
  { value: 10000, label: '10,000字', desc: '標準的なSEO記事', minPlan: 'FREE' },
  { value: 20000, label: '20,000字', desc: '網羅性の高い記事', minPlan: 'PRO' },
  { value: 30000, label: '30,000字', desc: '徹底解説記事', minPlan: 'ENTERPRISE' },
  { value: 50000, label: '50,000字', desc: '超大型コンテンツ', minPlan: 'ENTERPRISE' },
] as const

const CHAR_LIMITS: Record<string, number> = {
  GUEST: 5000,
  FREE: 10000,
  PRO: 20000,
  ENTERPRISE: 50000,
}

// バナー生成用の型定義（ドヤバナーAIと同じ）
type GeneratedBanner = {
  id: string
  imageUrl: string
  prompt: string
  createdAt: Date
}

// サイズプリセット（ドヤバナーAIと同じ）
const SIZE_PRESETS = [
  { id: 'square', label: '正方形', ratio: '1:1', width: 1024, height: 1024, icon: Square },
  { id: 'landscape-4-3', label: '横長 4:3', ratio: '4:3', width: 1024, height: 768, icon: RectangleHorizontal },
  { id: 'portrait-3-4', label: '縦長 3:4', ratio: '3:4', width: 768, height: 1024, icon: RectangleVertical },
  { id: 'landscape-16-9', label: 'ワイド 16:9', ratio: '16:9', width: 1280, height: 720, icon: RectangleHorizontal },
  { id: 'portrait-9-16', label: 'ストーリー 9:16', ratio: '9:16', width: 720, height: 1280, icon: RectangleVertical },
]

// 生成中のローディングメッセージ（ドヤバナーAIと同じ）
const LOADING_MESSAGES = [
  'AIがデザインを分析中...',
  'スタイルを適用中...',
  'レイアウトを調整中...',
  'テキストを配置中...',
  '色彩を最適化中...',
  '最終調整中...',
  'もう少しで完成です...',
]

function normalizeUrlInput(raw: string): string | null {
  const s = String(raw || '')
    .trim()
    .replace(/[)\]】】）]+$/g, '')
    .replace(/^[「『【\[]+/g, '')
    .replace(/[、。,\s]+$/g, '')
  if (!s) return null
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function parseUrlListText(text: string, max: number) {
  const parts = String(text || '')
    .split(/[\n\r,、\t ]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const urls: string[] = []
  const invalid: string[] = []
  for (const p of parts) {
    const u = normalizeUrlInput(p)
    if (u) {
      urls.push(u)
    } else {
      invalid.push(p)
    }
  }
  const uniq = Array.from(new Set(urls)).slice(0, max)
  const invalidUniq = Array.from(new Set(invalid)).slice(0, 6)
  return { urls: uniq, invalid: invalidUniq }
}

export default function SeoTestPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [selectedTemplate, setSelectedTemplate] = useState<ArticleTemplate | null>(null)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const formRef = useRef<HTMLDivElement | null>(null)

  // Step管理
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // テンプレート情報に基づいて記事タイプをマッピング
  const mapTemplateToArticleType = useCallback((category?: string, phase?: string) => {
    if (category === '比較型' || phase === '比較') return 'comparison'
    if (category === '一覧型') return 'ranking'
    if (category === '解説型' || phase === '認知') return 'explanation'
    return 'comparison'
  }, [])

  // テンプレート情報に基づいて読者像を推測
  const mapTemplateToAudience = useCallback((usage?: string, phase?: string) => {
    if (usage === 'LP補助向け' || phase === 'CV') return 'executive'
    if (usage === 'DL誘導向け') return 'marketer'
    if (phase === '認知') return 'beginner'
    return 'marketer'
  }, [])

  // テンプレート情報に基づいて文体を推測
  const mapTemplateToTone = useCallback((phase?: string, category?: string) => {
    if (phase === '認知' || category === '解説型') return 'friendly'
    if (phase === '比較' || category === '比較型') return 'logical'
    if (phase === 'CV') return 'professional'
    return 'logical'
  }, [])

  // Step1: 記事の軸
  const [mainKeyword, setMainKeyword] = useState('')
  const [articleTitle, setArticleTitle] = useState('')
  const [titleCandidates, setTitleCandidates] = useState<string[]>([])
  const [titleSelected, setTitleSelected] = useState<number | null>(null)
  const [titleLoading, setTitleLoading] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [articleType, setArticleType] = useState<string>('comparison')

  // Step2: 読者
  const [audiencePreset, setAudiencePreset] = useState<string>('marketer')
  const [customAudience, setCustomAudience] = useState('')

  // Step3: 仕上がり
  const [tone, setTone] = useState<string>('logical')
  const [targetChars, setTargetChars] = useState(10000)

  // プラン情報
  const isLoggedIn = !!session?.user?.email
  const userPlan = useMemo(() => {
    if (!isLoggedIn) return 'GUEST'
    const seoPlan = (session?.user as any)?.seoPlan
    const plan = (session?.user as any)?.plan
    const p = String(seoPlan || plan || 'FREE').toUpperCase()
    if (p === 'ENTERPRISE') return 'ENTERPRISE'
    if (p === 'PRO') return 'PRO'
    return 'FREE'
  }, [session, isLoggedIn])
  
  const charLimit = CHAR_LIMITS[userPlan] || 10000

  // 詳細設定（折りたたみ）
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [relatedKeywords, setRelatedKeywords] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [constraints, setConstraints] = useState('')
  const [referenceUrlsText, setReferenceUrlsText] = useState('')

  // 処理状態
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // バナー生成用の状態（ドヤバナーAIと同じ）
  const [isGeneratingBanner, setIsGeneratingBanner] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<GeneratedBanner[]>([])
  const [selectedSize, setSelectedSize] = useState(SIZE_PRESETS[3]) // デフォルト: ワイド 16:9
  const [generateCount, setGenerateCount] = useState(3)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [personFile, setPersonFile] = useState<File | null>(null)
  const [personPreview, setPersonPreview] = useState<string | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showCustomPrompt, setShowCustomPrompt] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [generationProgress, setGenerationProgress] = useState(0)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [generationComplete, setGenerationComplete] = useState(false)
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null)

  // テンプレート選択時に初期値を設定
  useEffect(() => {
    if (selectedTemplate) {
      // 記事タイプをマッピング
      const mappedType = mapTemplateToArticleType(selectedTemplate.category, selectedTemplate.phase)
      setArticleType(mappedType)
      
      // デフォルト値を設定（テンプレートに定義されている場合はそれを使用）
      const defaultKeyword = selectedTemplate.defaultKeyword || selectedTemplate.title.split('｜')[0].trim()
      const defaultTitle = selectedTemplate.defaultTitle || selectedTemplate.title
      setMainKeyword(defaultKeyword)
      setArticleTitle(defaultTitle)
      
      // 一次情報の例を設定
      if (selectedTemplate.exampleContent) {
        setOriginalContent(selectedTemplate.exampleContent)
      }
      
      // 関連キーワードの例を設定
      if (selectedTemplate.exampleKeywords && selectedTemplate.exampleKeywords.length > 0) {
        setRelatedKeywords(selectedTemplate.exampleKeywords.join('、'))
      }
      
      // 読者像を設定（テンプレートに推奨がある場合はそれを使用）
      const mappedAudience = selectedTemplate.targetAudience || mapTemplateToAudience(selectedTemplate.usage, selectedTemplate.phase)
      setAudiencePreset(mappedAudience)
      
      // 文体を設定（テンプレートに推奨がある場合はそれを使用）
      const mappedTone = selectedTemplate.recommendedTone || mapTemplateToTone(selectedTemplate.phase, selectedTemplate.category)
      setTone(mappedTone)
      
      // 文字数を設定（テンプレートに推奨がある場合はそれを使用）
      if (selectedTemplate.recommendedChars) {
        const recommended = selectedTemplate.recommendedChars
        // 推奨文字数がプラン上限を超える場合は上限に制限
        setTargetChars(Math.min(recommended, charLimit))
      }
      
      // ステップを1にリセット
      setStep(1)
    }
  }, [selectedTemplate, mapTemplateToArticleType, mapTemplateToAudience, mapTemplateToTone, charLimit])

  // IntersectionObserverでフォームの可視性を検知
  useEffect(() => {
    if (!formRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsFormVisible(entry.isIntersecting)
        })
      },
      {
        threshold: 0.4,
      }
    )

    observer.observe(formRef.current)
    return () => observer.disconnect()
  }, [selectedTemplate])

  const handleSelectTemplate = useCallback((template: ArticleTemplate) => {
    setSelectedTemplate(template)
    // テンプレート選択後、DOMが更新されてからフォームへスクロール
    // requestAnimationFrameを使用してレンダリング完了後にスクロール
    requestAnimationFrame(() => {
      setTimeout(() => {
        const formElement = document.getElementById('article-form')
        if (formElement) {
          // スクロール位置を計算（ヒーローセクションの高さを考慮）
          const heroHeight = window.innerHeight * 0.22 // 縮小時のヒーロー高さ
          const elementPosition = formElement.getBoundingClientRect().top + window.scrollY
          const offsetPosition = elementPosition - heroHeight - 20
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        }
      }, 150)
    })
  }, [])

  // ロゴアップロード処理（ドヤバナーAIと同じ）
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('画像サイズは5MB以下にしてください')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setLogoPreview(base64)
    }
    reader.readAsDataURL(file)
    setLogoFile(file)
  }

  // 人物写真アップロード処理（ドヤバナーAIと同じ）
  const handlePersonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('画像サイズは5MB以下にしてください')
      return
    }
    
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result as string
      setPersonPreview(base64)
    }
    reader.readAsDataURL(file)
    setPersonFile(file)
  }

  // バナー生成処理（ドヤバナーAIと同じ）
  const handleGenerateBanner = async () => {
    if (!selectedTemplate) {
      toast.error('テンプレートを選択してください')
      return
    }

    if (!articleTitle.trim()) {
      toast.error('記事タイトルを入力してください')
      return
    }

    setIsGeneratingBanner(true)
    setGeneratedBanners([])
    setGenerationProgress(0)
    setLoadingMessage(LOADING_MESSAGES[0])
    setShowGenerationModal(true)
    setGenerationComplete(false)
    
    // ローディングメッセージを定期的に更新
    let messageIndex = 0
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length
      setLoadingMessage(LOADING_MESSAGES[messageIndex])
      setGenerationProgress(prev => Math.min(prev + Math.random() * 15, 90))
    }, 3000)

    try {
      // サイズ文字列を生成
      const finalWidth = selectedSize.width
      const finalHeight = selectedSize.height
      const sizeString = `${finalWidth}x${finalHeight}`

      // バナー生成APIを呼び出し
      const res = await fetch('/api/seo/test/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          mainTitle: articleTitle,
          subTitle: mainKeyword,
          size: sizeString,
          count: generateCount,
          logoBase64: logoPreview || undefined,
          personBase64: personPreview || undefined,
          customPrompt: customPrompt.trim() || undefined,
        }),
      })

      const result = await res.json()

      if (!res.ok || !result.success) {
        throw new Error(result.error || '生成に失敗しました')
      }

      if (result.banners && Array.isArray(result.banners) && result.banners.length > 0) {
        setGenerationProgress(100)
        setLoadingMessage('完成しました！')
        const banners: GeneratedBanner[] = result.banners.map((url: string, idx: number) => ({
          id: `banner-${Date.now()}-${idx}`,
          imageUrl: url,
          prompt: result.prompts?.[idx] || '',
          createdAt: new Date(),
        }))
        setGeneratedBanners(banners)
        setGenerationComplete(true)
        clearInterval(messageInterval)
        
        // 完了演出を3秒表示してからモーダルを閉じる
        setTimeout(() => {
          setShowGenerationModal(false)
          setIsGeneratingBanner(false)
          setGenerationComplete(false)
        }, 3000)
      } else {
        throw new Error('バナーが生成されませんでした')
      }
    } catch (err: any) {
      console.error('Banner generation error:', err)
      toast.error(err.message || '生成に失敗しました')
      setShowGenerationModal(false)
      clearInterval(messageInterval)
      setIsGeneratingBanner(false)
      setGenerationProgress(0)
      setLoadingMessage('')
    }
  }

  // バナーダウンロード処理（ドヤバナーAIと同じ）
  const handleDownloadBanner = (banner: GeneratedBanner) => {
    const link = document.createElement('a')
    link.href = banner.imageUrl
    link.download = `banner-${banner.id}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロードしました')
  }

  async function generateTitleCandidates() {
    if (titleLoading) return
    const kw = mainKeyword.trim()
    if (kw.length < 2) return
    setTitleLoading(true)
    setTitleError(null)
    try {
      const res = await fetch('/api/seo/title-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: kw,
          articleType,
          targetChars,
          tone,
          count: 6,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `タイトル生成に失敗しました (${res.status})`)
      }
      const list = Array.isArray(json?.titles) ? (json.titles as string[]) : []
      const uniq = Array.from(new Set(list.map((s) => String(s || '').trim()).filter(Boolean))).slice(0, 6)
      if (!uniq.length) throw new Error('タイトル候補を生成できませんでした')
      setTitleCandidates(uniq)
      if (!articleTitle.trim()) {
        setArticleTitle(uniq[0])
        setTitleSelected(0)
      }
    } catch (e: any) {
      setTitleError(e?.message || 'タイトル候補の生成に失敗しました')
    } finally {
      setTitleLoading(false)
    }
  }

  async function handleGenerate() {
    if (loading || !selectedTemplate) return
    setLoading(true)
    setError(null)

    try {
      const referenceUrls = parseUrlListText(referenceUrlsText, 20).urls
      const related = relatedKeywords
        .split(/[,、\n]/)
        .map((s) => s.trim())
        .filter(Boolean)

      const persona = audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.label || ''

      const toneMap: Record<string, string> = {
        logical: 'ビジネス',
        friendly: 'やさしい',
        professional: '専門的',
        casual: 'カジュアル',
      }

      const isComparisonMode = articleType === 'comparison' || articleType === 'ranking'
      const mode = isComparisonMode ? 'comparison_research' : 'standard'
      const comparisonConfig = isComparisonMode
        ? {
            template: articleType === 'ranking' ? 'ranking' : 'tools',
            count: 10,
            region: 'JP',
            requireOfficial: true,
            includeThirdParty: true,
          }
        : undefined

      const requestText = [
        originalContent.trim() ? `【一次情報（経験・訴求ポイント）】\n${originalContent.trim()}` : '',
        constraints.trim() ? `【制約・NG表現】\n${constraints.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      const fallbackTitle = `${mainKeyword}に関する${ARTICLE_TYPES.find((t) => t.id === articleType)?.label || '記事'}`
      const finalTitle = articleTitle.trim() || fallbackTitle

      let seoIntent = '情報収集'
      if (articleType === 'comparison' || articleType === 'ranking') seoIntent = '比較検討'
      if (mainKeyword.includes('おすすめ') || mainKeyword.includes('比較')) seoIntent = '購買検討'

      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          keywords: [mainKeyword, ...related],
          persona,
          tone: toneMap[tone] || '丁寧',
          targetChars,
          searchIntent: seoIntent,
          referenceUrls,
          llmoOptions: {
            tldr: true,
            conclusionFirst: true,
            faq: true,
            glossary: false,
            comparison: isComparisonMode ? true : false,
            quotes: true,
            templates: false,
            objections: false,
          },
          autoBundle: true,
          createJob: true,
          requestText: requestText || undefined,
          mode,
          comparisonConfig,
        }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `エラーが発生しました (${res.status})`)
      }

      const jobId = json.jobId || json.job?.id
      const articleId = json.articleId || json.article?.id
      if (jobId) {
        router.push(`/seo/jobs/${jobId}?auto=1`)
      } else if (articleId) {
        router.push(`/seo/articles/${articleId}`)
      } else {
        router.push('/seo')
      }
    } catch (e: any) {
      setError(e?.message || '生成に失敗しました')
      setLoading(false)
    }
  }

  const preview = useMemo(() => {
    const type = ARTICLE_TYPES.find((t) => t.id === articleType)
    const audience = audiencePreset === 'custom' ? customAudience : AUDIENCE_PRESETS.find((a) => a.id === audiencePreset)?.label
    const toneLabel = TONE_OPTIONS.find((t) => t.id === tone)?.label

    const estimatedHeadings = Math.max(5, Math.floor(targetChars / 1500))

    let seoIntent = '情報収集'
    if (articleType === 'comparison' || articleType === 'ranking') seoIntent = '比較検討'
    if (mainKeyword.includes('おすすめ') || mainKeyword.includes('比較')) seoIntent = '購買検討'

    return {
      type: type?.label || '解説記事',
      audience: audience || '一般読者',
      tone: toneLabel || '論理的',
      chars: targetChars.toLocaleString(),
      headings: estimatedHeadings,
      seoIntent,
    }
  }, [mainKeyword, articleType, audiencePreset, customAudience, tone, targetChars])

  const referenceUrlParse = useMemo(() => parseUrlListText(referenceUrlsText, 20), [referenceUrlsText])

  const canProceed = useMemo(() => {
    if (step === 1) return mainKeyword.trim().length >= 2
    if (step === 2) return audiencePreset !== 'custom' || customAudience.trim().length >= 2
    return true
  }, [step, mainKeyword, audiencePreset, customAudience])

  return (
    <div className="min-h-screen bg-black">
      {/* 固定ヒーローセクション（ドヤバナーAIスタイル） */}
      {selectedTemplate && (
        <div
          className={`fixed top-0 left-0 right-0 z-20 overflow-hidden transition-all duration-300 ease-in-out ${
            isFormVisible
              ? 'h-[15vh] sm:h-[18vh] md:h-[20vh] lg:h-[22vh]'
              : 'h-[32vh] sm:h-[40vh] md:h-[50vh] lg:h-[55vh]'
          }`}
        >
          {/* グラデーションオーバーレイ */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent z-10" />

          {/* ヒーロー背景 */}
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-black to-slate-900 flex items-center justify-center">
            {selectedTemplate.imageUrl ? (
              <img
                src={selectedTemplate.imageUrl}
                alt={selectedTemplate.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-8">
                <Sparkles className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 text-blue-400" />
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-4 text-white">
                  {selectedTemplate.title}
                </h2>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedTemplate.phase === '認知'
                        ? 'bg-blue-500/80 text-white'
                        : selectedTemplate.phase === '比較'
                          ? 'bg-amber-500/80 text-white'
                          : 'bg-emerald-500/80 text-white'
                    }`}
                  >
                    {selectedTemplate.phase}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      selectedTemplate.category === '解説型'
                        ? 'bg-purple-500/80 text-white'
                        : selectedTemplate.category === '比較型'
                          ? 'bg-pink-500/80 text-white'
                          : 'bg-cyan-500/80 text-white'
                    }`}
                  >
                    {selectedTemplate.category}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-700/80 text-gray-200">
                    {selectedTemplate.usage}
                  </span>
                </div>
              </div>
            )}
      </div>

          {/* オーバーレイ情報（Netflix風） */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ease-in-out ${
              isFormVisible ? 'p-1 sm:p-2' : 'p-2 sm:p-4 md:p-6 lg:p-8'
            }`}
          >
            <div className="max-w-6xl mx-auto">
              {/* メインタイトル */}
              <h1
                className={`font-black drop-shadow-2xl leading-tight transition-all duration-300 ${
                  isFormVisible
                    ? 'text-sm sm:text-base md:text-lg mb-0.5'
                    : 'text-base sm:text-xl md:text-3xl lg:text-4xl mb-0.5 sm:mb-2'
                }`}
              >
                {selectedTemplate.title}
          </h1>

              {/* サブタイトル（フォーム表示時は非表示） */}
              {!isFormVisible && (
                <p className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-200 mb-1 drop-shadow-lg font-medium">
                  {selectedTemplate.category} / {selectedTemplate.usage}
                </p>
              )}

              {/* ボタン（フォーム表示時は非表示） */}
              {!isFormVisible && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      const formElement = document.getElementById('article-form')
                      if (formElement) {
                        // スクロール位置を計算（ヒーローセクションの高さを考慮）
                        const heroHeight = window.innerHeight * 0.22
                        const elementPosition = formElement.getBoundingClientRect().top + window.scrollY
                        const offsetPosition = elementPosition - heroHeight - 20
                        
                        window.scrollTo({
                          top: offsetPosition,
                          behavior: 'smooth'
                        })
                      }
                    }}
                    className="px-3 sm:px-4 md:px-6 py-1.5 sm:py-2 bg-white text-black font-bold rounded-md hover:bg-gray-200 transition-all flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm shadow-lg hover:shadow-xl"
                  >
                    <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current" />
                    <span className="whitespace-nowrap">このテンプレートで記事を作成</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

      {/* テンプレート一覧（Netflix風の横スクロール） */}
      <div
        className={`w-full overflow-x-hidden px-0 sm:px-4 md:px-8 lg:px-12 relative z-10 space-y-4 sm:space-y-6 md:space-y-10 bg-black pb-6 sm:pb-8 transition-all duration-300 ease-in-out ${
          isFormVisible
            ? 'pt-[17vh] sm:pt-[20vh] md:pt-[22vh] lg:pt-[24vh]'
            : selectedTemplate
              ? 'pt-[34vh] sm:pt-[42vh] md:pt-[52vh] lg:pt-[57vh]'
              : 'pt-6 sm:pt-8'
        }`}
      >
        {/* ヘッダー（テンプレート未選択時のみ表示） */}
        {!selectedTemplate && (
          <div className="w-full px-4 sm:px-6 md:px-8 lg:px-12 py-6 sm:py-8 bg-gradient-to-b from-black via-slate-900 to-black">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">
                SEO記事テンプレートを選択
              </h1>
              <p className="text-blue-100 font-medium text-sm sm:text-base">
                30種類の実績あるSEO記事テンプレートから、上位表示を狙える記事構成を選んでください
              </p>
            </div>
          </div>
        )}

        {/* テンプレート一覧 */}
        <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 md:space-y-10">
          {articleSections.map((section) => (
            <HorizontalScrollSection
              key={section.id}
              section={section}
              selectedTemplateId={selectedTemplate?.id || null}
              onSelectTemplate={handleSelectTemplate}
            />
          ))}
        </div>
            </div>

      {/* 生成フォーム（選択されたテンプレートに基づく、/seo/createと同じ3ステップ形式） */}
      {selectedTemplate && (
        <div
          ref={formRef}
          id="article-form"
          className="w-full overflow-x-hidden px-3 sm:px-4 md:px-8 lg:px-12 py-6 sm:py-8 md:py-12 bg-black/95 backdrop-blur-sm scroll-mt-4"
        >
          <div className="max-w-5xl mx-auto w-full">
            <div className="bg-gray-900/90 rounded-xl md:rounded-2xl border border-gray-800 overflow-hidden">
              {/* ヘッダー */}
              <div className="px-6 sm:px-10 pt-8 sm:pt-10 pb-6 text-center border-b border-gray-800 relative">
            <button
                  type="button"
                  onClick={() => setSelectedTemplate(null)}
                  className="absolute top-4 right-4 sm:top-6 sm:right-6 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-black hover:bg-gray-700 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  閉じる
            </button>

                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-xl shadow-blue-500/30">
                  <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  SEO記事を作成する
                </h2>
                <p className="text-sm text-gray-400 font-bold mt-2">
                  3ステップで上位表示を狙える高品質なSEO記事を生成
                </p>

                {/* Stepインジケーター */}
                <div className="mt-6 flex items-center justify-center gap-3">
                  {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                          step === s
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : step > s
                              ? 'bg-blue-600/30 text-blue-400 border border-blue-500/50'
                              : 'bg-gray-800 text-gray-500 border border-gray-700'
                        }`}
                      >
                        {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                      {s < 3 && (
                        <div className={`w-8 h-0.5 ${step > s ? 'bg-blue-500/50' : 'bg-gray-700'}`} />
                      )}
                </div>
                  ))}
                            </div>
                <div className="mt-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  {step === 1 && 'Step 1: キーワード・タイトル・記事タイプ'}
                  {step === 2 && 'Step 2: 読者像・ターゲット設定'}
                  {step === 3 && 'Step 3: 文字数・参考URL・仕上がり調整'}
                </div>
              </div>

              {/* コンテンツ */}
              <div className="px-6 sm:px-10 py-6 sm:py-8">
                <AnimatePresence mode="wait">
                  {/* Step 1: 記事の軸 */}
                  {step === 1 && (
                      <motion.div
                      key="step1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      {/* 選択中のテンプレート情報 */}
                      <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700">
                        <div className="flex items-center gap-3">
                          {selectedTemplate.imageUrl && (
                            <div className="w-20 h-12 sm:w-24 sm:h-14 rounded overflow-hidden flex-shrink-0">
                              <img 
                                src={selectedTemplate.imageUrl} 
                                alt={selectedTemplate.title} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs sm:text-sm text-gray-400">選択中のテンプレート</p>
                            <p className="text-sm sm:text-base font-bold text-white truncate">
                              {selectedTemplate.title}
                            </p>
                            {selectedTemplate.description && (
                              <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                                {selectedTemplate.description}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  selectedTemplate.phase === '認知'
                                    ? 'bg-blue-500/80 text-white'
                                    : selectedTemplate.phase === '比較'
                                      ? 'bg-amber-500/80 text-white'
                                      : 'bg-emerald-500/80 text-white'
                                }`}
                              >
                                {selectedTemplate.phase}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  selectedTemplate.category === '解説型'
                                    ? 'bg-purple-500/80 text-white'
                                    : selectedTemplate.category === '比較型'
                                      ? 'bg-pink-500/80 text-white'
                                      : 'bg-cyan-500/80 text-white'
                                }`}
                              >
                                {selectedTemplate.category}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-700/80 text-gray-200">
                                {selectedTemplate.usage}
                              </span>
                            </div>
                          </div>
                            </div>
                          </div>

                      {/* 主キーワード */}
                      <div>
                        <label className="block text-xs sm:text-sm font-bold mb-2 text-white">
                          主キーワード <span className="text-red-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={mainKeyword}
                          onChange={(e) => setMainKeyword(e.target.value)}
                          placeholder="例：AI ライティング ツール 比較"
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5">
                          上位表示したい検索キーワードを入力してください
                        </p>
                    </div>

                      {/* 記事タイトル */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs sm:text-sm font-bold text-white">
                            記事タイトル <span className="text-red-400">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={generateTitleCandidates}
                            disabled={titleLoading || mainKeyword.trim().length < 2}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-[10px] font-black shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            {titleLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                            タイトル自動生成（6）
                          </button>
                </div>
                        <input
                          type="text"
                          value={articleTitle}
                          onChange={(e) => setArticleTitle(e.target.value)}
                          placeholder="例：AIライティングツール比較｜料金・特徴・選び方を2026年版で徹底解説"
                          className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm sm:text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {titleError ? (
                          <p className="mt-2 text-xs font-bold text-red-400">{titleError}</p>
                        ) : (
                          <p className="text-[10px] sm:text-xs text-gray-400 mt-1.5">
                            ボタンで候補を生成→クリックでタイトル確定（後から編集もOK）
                          </p>
                        )}

                        {titleCandidates.length ? (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {titleCandidates.slice(0, 6).map((t, i) => {
                              const active = titleSelected === i
                              return (
                                <button
                                  key={`${i}_${t}`}
                                  type="button"
                                  onClick={() => {
                                    setArticleTitle(t)
                                    setTitleSelected(i)
                                  }}
                                  className={[
                                    'text-left px-4 py-3 rounded-lg sm:rounded-xl border transition-all',
                                    active
                                      ? 'border-blue-500 bg-blue-600/20 shadow-sm'
                                      : 'border-gray-700 bg-gray-800 hover:bg-gray-700',
                                  ].join(' ')}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-sm font-bold text-white leading-snug">{t}</div>
                                    {active ? <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0" /> : null}
                </div>
                                </button>
                              )
                            })}
                          </div>
                        ) : null}
              </div>

                      {/* 一次情報 */}
                      <div className="rounded-xl border-2 border-blue-500/50 bg-gradient-to-br from-blue-900/20 via-indigo-900/20 to-blue-800/10 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black tracking-widest">
                                重要
                              </span>
                              <label className="text-xs font-black text-blue-300 uppercase tracking-widest">
                                一次情報（経験・訴求ポイント）
                              </label>
                  </div>
                            <p className="text-xs font-bold text-blue-200">
                              ぜひ入力してください。ここが入るほど「あなたにしか書けない記事」になり、差別化できます。
                            </p>
                </div>
              </div>
                        <textarea
                          value={originalContent}
                          onChange={(e) => setOriginalContent(e.target.value)}
                          placeholder="例：実体験、現場の失敗談、数字、独自の主張、比較の結論、読者に必ず伝えたいこと…"
                          rows={5}
                          className="w-full px-4 py-3 rounded-xl bg-gray-800 border-2 border-blue-500/50 text-white font-bold text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all resize-none"
                        />
                        <p className="mt-2 text-xs font-bold text-blue-200">
                          ✨ この内容は本文プロンプトに組み込み、オリジナル性が高い記事になるよう反映されます
                        </p>
            </div>

                      {/* 記事タイプ */}
                      <div>
                        <label className="block text-xs sm:text-sm font-bold mb-3 text-white">
                          記事タイプ
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {ARTICLE_TYPES.map((type) => {
                            const Icon = type.icon
                            const selected = articleType === type.id
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => setArticleType(type.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                  selected
                                    ? 'border-blue-500 bg-blue-600/20'
                                    : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                                }`}
                              >
                                <Icon className={`w-5 h-5 mb-2 ${selected ? 'text-blue-400' : 'text-gray-400'}`} />
                                <p className={`text-sm font-bold ${selected ? 'text-blue-400' : 'text-gray-300'}`}>
                                  {type.label}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">{type.desc}</p>
                              </button>
                            )
                          })}
                </div>
                        <p className="mt-3 text-xs text-gray-400">
                          📝 記事タイプに応じて構成が最適化されます
                        </p>
                  </div>
            </motion.div>
        )}

                  {/* Step 2: 読者像 */}
                  {step === 2 && (
          <motion.div
                      key="step2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div>
                        <label className="block text-xs sm:text-sm font-bold mb-3 text-white">
                          想定読者
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {AUDIENCE_PRESETS.map((preset) => {
                            const selected = audiencePreset === preset.id
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => setAudiencePreset(preset.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                  selected
                                    ? 'border-blue-500 bg-blue-600/20'
                                    : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                                }`}
                              >
                                <p className={`text-sm font-bold ${selected ? 'text-blue-400' : 'text-gray-300'}`}>
                                  {preset.label}
                                </p>
                                {preset.desc && (
                                  <p className="text-[10px] text-gray-400 mt-1">{preset.desc}</p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {audiencePreset === 'custom' && (
              <div>
                          <label className="block text-xs sm:text-sm font-bold mb-2 text-gray-300">
                            読者を具体的に
                          </label>
                <input
                  type="text"
                            value={customAudience}
                            onChange={(e) => setCustomAudience(e.target.value)}
                            placeholder="例：SaaS企業のマーケ責任者（30〜40代）"
                            className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
                      )}

                      <p className="text-xs text-gray-400">
                        👤 読者像を設定すると、語り口や具体例が最適化されます
                      </p>
            </motion.div>
                  )}
            
                  {/* Step 3: 仕上がり */}
                  {step === 3 && (
            <motion.div
                      key="step3"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      {/* 文体 */}
              <div>
                        <label className="block text-xs sm:text-sm font-bold mb-3 text-white">
                          文体・トーン
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {TONE_OPTIONS.map((option) => {
                            const selected = tone === option.id
                            return (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => setTone(option.id)}
                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                  selected
                                    ? 'border-blue-500 bg-blue-600/20'
                                    : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-lg">{option.emoji}</span>
                                  <p className={`text-sm font-bold ${selected ? 'text-blue-400' : 'text-gray-300'}`}>
                                    {option.label}
                                  </p>
                                </div>
                                <p className="text-[10px] text-gray-400">{option.desc}</p>
                              </button>
                            )
                          })}
                        </div>
              </div>

                      {/* 文字数 */}
              <div>
                        <label className="block text-xs sm:text-sm font-bold mb-3 text-white">
                  文字数目安
                  <span className="ml-2 text-[10px] font-bold text-gray-400 normal-case">
                    ({userPlan === 'GUEST' ? 'ゲスト' : userPlan === 'FREE' ? '無料' : userPlan === 'PRO' ? 'プロ' : 'エンタープライズ'}プラン: 最大{charLimit.toLocaleString()}字)
                  </span>
                </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {CHAR_PRESETS.map((preset) => {
                            const selected = targetChars === preset.value
                            const locked = preset.value > charLimit
                    return (
                      <button
                                key={preset.value}
                        type="button"
                        onClick={() => {
                                  if (locked) return
                                  setTargetChars(preset.value)
                                }}
                        className={`relative p-3 rounded-xl border-2 text-center transition-all overflow-hidden ${
                          selected
                                    ? 'border-blue-500 bg-blue-600/20'
                            : locked
                                      ? 'border-gray-700 bg-gray-800 opacity-50 cursor-not-allowed'
                                      : 'border-gray-700 bg-gray-800 hover:bg-gray-700'
                                }`}
                              >
                                <p className={`text-sm font-bold ${selected ? 'text-blue-400' : locked ? 'text-gray-500' : 'text-gray-300'}`}>
                                  {preset.label}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{preset.desc}</p>
                      </button>
                    )
                  })}
                            </div>
                          </div>

                      {/* 参考記事URL */}
                      <div className="rounded-xl border-2 border-indigo-500/50 bg-gradient-to-br from-indigo-900/20 via-blue-900/20 to-indigo-800/10 p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black tracking-widest">
                                重要
                              </span>
                              <label className="text-xs font-black text-indigo-300 uppercase tracking-widest">
                                参考記事URL（競合｜フォーマット参考）
                  </label>
                    </div>
                            <p className="text-xs font-bold text-indigo-200">
                              ぜひ入力してください。ここに入れたURLを調査し、構成・見出しの"型"を参考にして、より上位表示を狙える記事にします（内容のコピーはしません）。
                            </p>
                    </div>
                          <div className="text-[10px] font-bold text-indigo-300/80 bg-gray-800/70 border border-indigo-500/50 px-3 py-2 rounded-xl inline-flex items-center gap-2">
                            <Link2 className="w-3.5 h-3.5" />
                            <span>有効: {referenceUrlParse.urls.length}件</span>
                  </div>
                </div>
                        <textarea
                          value={referenceUrlsText}
                          onChange={(e) => setReferenceUrlsText(e.target.value)}
                          placeholder="例：競合記事（上位表示されている記事）のURLを貼り付けてください&#10;https://example.com/article-a&#10;https://example.com/article-b"
                          rows={4}
                          className="w-full px-4 py-3 rounded-xl bg-gray-800 border-2 border-indigo-500/50 text-white font-bold text-sm placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 transition-all resize-none"
                        />
                        {referenceUrlParse.invalid.length ? (
                          <p className="mt-2 text-xs font-bold text-red-400">
                            入力形式を確認してください（URLとして解釈できないもの）: {referenceUrlParse.invalid.join(' / ')}
                          </p>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-indigo-200">
                            ✨ 参考URLが無い場合は空でOK。キーワードと調査結果をベースに記事を作成します
                          </p>
                        )}
                      </div>

                      {/* 詳細設定（折りたたみ） */}
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          <Zap className="w-3.5 h-3.5" />
                          SEOを本気で強化する（任意）
                        </button>

                        <AnimatePresence>
                          {showAdvanced && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.3 }}
                              className="mt-4 space-y-4 overflow-hidden"
                            >
                  <div>
                                <label className="block text-xs sm:text-sm font-bold mb-2 text-gray-300">
                                  関連キーワード
                      </label>
                                <textarea
                                  value={relatedKeywords}
                                  onChange={(e) => setRelatedKeywords(e.target.value)}
                                  placeholder="カンマ区切りで入力&#10;例：SEO対策, コンテンツ作成, 記事代行"
                                  rows={3}
                                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <p className="mt-1 text-[10px] text-gray-400">
                                  💡 入れなくても生成できます。入れると網羅性が上がります
                                </p>
                </div>

                              <div>
                                <label className="block text-xs sm:text-sm font-bold mb-2 text-gray-300">
                                  制約・NG表現（任意）
                                </label>
                <textarea
                                  value={constraints}
                                  onChange={(e) => setConstraints(e.target.value)}
                                  placeholder="例：この表現は使わない、必ず『料金相場』を入れる、結論を冒頭に置く…"
                                  rows={4}
                                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <p className="mt-1 text-[10px] text-gray-400">
                                  💡 一次情報を入れると、他にない記事になります
                </p>
              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
            </div>

                      {/* プレビューパネル */}
                      <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-br from-blue-900/20 to-indigo-900/20 border border-blue-500/30">
                        <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3">
                          生成プレビュー
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-[10px] text-blue-400 font-bold">記事タイプ</p>
                            <p className="font-bold text-white">{preview.type}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-blue-400 font-bold">想定読者</p>
                            <p className="font-bold text-white">{preview.audience}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-blue-400 font-bold">想定見出し数</p>
                            <p className="font-bold text-white">{preview.headings}見出し</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-blue-400 font-bold">想定文字数</p>
                            <p className="font-bold text-white">{preview.chars}字</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[10px] text-blue-400 font-bold">SEO意図</p>
                            <p className="font-bold text-white">{preview.seoIntent}</p>
                          </div>
                        </div>
                      </div>

                      {/* バナー生成セクション（ドヤバナーAIと同じ） */}
                      <div className="rounded-xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-900/20 via-pink-900/20 to-purple-800/10 p-4 sm:p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <ImageIcon className="w-5 h-5 text-purple-400" />
                          <label className="text-xs font-black text-purple-300 uppercase tracking-widest">
                            記事バナー生成（オプション）
                          </label>
                        </div>
                        <p className="text-xs font-bold text-purple-200 mb-4">
                          記事タイトルを反映したバナー画像を生成できます。記事と一緒に使用するアイキャッチ画像として活用してください。
                        </p>

                        {/* サイズ選択 */}
                        <div className="mb-4">
                          <label className="block text-xs sm:text-sm font-bold mb-2 text-white">
                            サイズを選択
                          </label>
                          <div className="flex flex-wrap gap-2 sm:gap-3">
                            {SIZE_PRESETS.map((size) => {
                              const IconComponent = size.icon
                              return (
                                <button
                                  key={size.id}
                                  type="button"
                                  onClick={() => setSelectedSize(size)}
                                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all text-xs sm:text-sm font-medium ${
                                    selectedSize.id === size.id
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                  }`}
                                >
                                  <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                  <span>{size.label}</span>
                                  <span className="text-[10px] sm:text-xs opacity-70">{size.ratio}</span>
                      </button>
                    )
                  })}
                        </div>
                          
                          <div className="mt-3 flex items-center justify-center">
                            <div className="bg-gray-800 rounded-lg p-3 sm:p-4 flex flex-col items-center">
                              {(() => {
                                const displayWidth = selectedSize.width
                                const displayHeight = selectedSize.height
                                const previewWidth = displayWidth > displayHeight ? 80 : 80 * displayWidth / displayHeight
                                const previewHeight = displayHeight > displayWidth ? 80 : 80 * displayHeight / displayWidth
                                return (
                                  <>
                                    <div 
                                      className="bg-gray-700 rounded border border-gray-600"
                                      style={{
                                        width: `${previewWidth}px`,
                                        height: `${previewHeight}px`,
                                      }}
                                    />
                                    <p className="text-xs sm:text-sm font-bold text-white mt-2">{displayWidth}×{displayHeight}</p>
                                    <p className="text-[10px] sm:text-xs text-gray-400">ASPECT RATIO PREVIEW</p>
                                  </>
                                )
                              })()}
                      </div>
                </div>
              </div>

                        {/* 生成枚数 */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs sm:text-sm font-bold text-white">生成枚数</label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-lg sm:text-xl font-bold text-blue-400">{generateCount}枚</span>
                              <span className="text-[10px] sm:text-xs text-gray-400">最大10枚</span>
                    </div>
                    </div>
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {[3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setGenerateCount(num)}
                                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl font-bold text-xs sm:text-sm transition-all ${
                                  generateCount === num
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                  </div>
                </div>

                        {/* ロゴ・人物写真アップロード */}
                        <div className="mb-4">
                          <label className="text-xs sm:text-sm font-bold mb-2 block text-white">ロゴ / 人物写真（任意）</label>
                          <p className="text-[10px] sm:text-xs text-gray-400 mb-2 sm:mb-3">アップロードした画像をバナーに反映します（AIが画像内に合成します）。</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {/* ロゴアップロード */}
                            <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700">
                              <p className="text-xs sm:text-sm font-bold mb-2 sm:mb-3">ロゴ</p>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600 shrink-0">
                                  {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                                  ) : (
                                    <span className="text-[10px] sm:text-xs text-gray-500 font-bold">LOGO</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 truncate">{logoFile ? logoFile.name : '未設定'}</p>
                                  <label className="cursor-pointer">
                                    <span className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-[10px] sm:text-xs font-medium transition-colors inline-flex items-center gap-1">
                                      <Upload className="w-3 h-3" />
                                      アップロード
                                    </span>
                                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                  </label>
                                </div>
                              </div>
                            </div>
                            
                            {/* 人物写真アップロード */}
                            <div className="bg-gray-800 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700">
                              <p className="text-xs sm:text-sm font-bold mb-2 sm:mb-3">人物写真</p>
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gray-700 rounded-lg flex items-center justify-center overflow-hidden border border-gray-600 shrink-0">
                                  {personPreview ? (
                                    <img src={personPreview} alt="Person" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] sm:text-xs text-gray-400 mb-1.5 truncate">{personFile ? personFile.name : '未設定'}</p>
                                  <label className="cursor-pointer">
                                    <span className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-[10px] sm:text-xs font-medium transition-colors inline-flex items-center gap-1">
                                      <Upload className="w-3 h-3" />
                                      アップロード
                      </span>
                                    <input type="file" accept="image/*" onChange={handlePersonUpload} className="hidden" />
                      </label>
                    </div>
                  </div>
                              <p className="text-[8px] sm:text-[10px] text-gray-500 mt-2">※ 人物写真は1名（1枚）のみ対応です</p>
                            </div>
                  </div>
                </div>

                        {/* カスタムプロンプト（任意） */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs sm:text-sm font-bold text-white">詳細な生成指示（任意）</label>
                            <button
                              type="button"
                              onClick={() => setShowCustomPrompt(!showCustomPrompt)}
                              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                            >
                              {showCustomPrompt ? '閉じる' : '開く'}
                            </button>
                          </div>
                          
                          {showCustomPrompt && (
                <textarea
                              value={customPrompt}
                              onChange={(e) => setCustomPrompt(e.target.value)}
                              placeholder="例：背景はグラデーションで、テキストは中央配置、ロゴは左上に配置してください…"
                              rows={4}
                              className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg sm:rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            />
                          )}
              </div>
            </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* エラー */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-xl bg-red-900/30 border border-red-500/50 text-red-300 text-sm font-bold"
                  >
                    {error}
                  </motion.div>
                )}
              </div>

              {/* フッター（ナビゲーション） */}
              <div className="px-6 sm:px-10 pb-8 sm:pb-10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  {step > 1 && (
              <button
                      type="button"
                      onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
                      className="h-12 sm:h-14 px-6 rounded-xl bg-gray-800 text-gray-300 font-bold text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 border border-gray-700"
              >
                      <ArrowLeft className="w-4 h-4" />
                戻る
              </button>
                  )}

                  <div className="flex flex-col gap-3">
              <button
                      type="button"
                      onClick={() => {
                        if (step < 3) {
                          setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)
                        } else {
                          handleGenerate()
                        }
                      }}
                      disabled={!canProceed || loading}
                      className="flex-1 h-12 sm:h-14 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    生成中...
                  </>
                      ) : step < 3 ? (
                        <>
                          次へ
                          <ArrowRight className="w-5 h-5" />
                  </>
                ) : (
                  <>
                          記事を生成する
                          <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>

                    {/* バナー生成ボタン（Step 3のみ表示） */}
                    {step === 3 && (
                      <button
                        type="button"
                        onClick={handleGenerateBanner}
                        disabled={!articleTitle.trim() || isGeneratingBanner}
                        className="h-12 sm:h-14 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm sm:text-base shadow-xl shadow-purple-500/30 hover:shadow-2xl hover:shadow-purple-500/40 hover:translate-y-[-2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-3"
                      >
                        {isGeneratingBanner ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            バナー生成中...
                          </>
                        ) : (
                          <>
                            <ImageIcon className="w-5 h-5" />
                            記事バナーを生成する
                          </>
                        )}
                      </button>
                    )}
                  </div>
            </div>
      </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成されたバナー一覧（ドヤバナーAIと同じ） */}
      {generatedBanners.length > 0 && (
        <div className="w-full overflow-x-hidden px-3 sm:px-4 md:px-8 lg:px-12 py-8 sm:py-10 md:py-14 space-y-6 md:space-y-8 bg-gradient-to-b from-transparent via-gray-900/50 to-gray-900">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-2 md:px-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white">
                  🎉 バナー生成完了！
                </h2>
                <p className="text-sm text-gray-400">{generatedBanners.length}枚のバナーが生成されました</p>
              </div>
            </div>
            {/* 一括ダウンロードボタン */}
            <button
              onClick={() => {
                generatedBanners.forEach((banner, idx) => {
                  setTimeout(() => {
                    handleDownloadBanner(banner)
                  }, idx * 500)
                })
                toast.success('全画像をダウンロード中...')
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/30"
            >
              <Download className="w-4 h-4" />
              全てダウンロード
            </button>
          </div>
          
          {/* バナーグリッド */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {generatedBanners.map((banner, idx) => (
              <motion.div
                key={banner.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="group relative bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-500 transition-all shadow-lg hover:shadow-xl"
              >
                {/* 画像 - 選択したサイズのアスペクト比に合わせる */}
                <div 
                  className="relative cursor-pointer"
                  style={{
                    aspectRatio: `${selectedSize.width} / ${selectedSize.height}`,
                  }}
                  onClick={() => {
                    setZoomImage({ url: banner.imageUrl, title: `バナー ${idx + 1}` })
                  }}
                >
                  <img
                    src={banner.imageUrl}
                    alt={`Generated banner ${idx + 1}`}
                    className="w-full h-full object-contain bg-gray-900"
                  />
                  {/* オーバーレイ（ホバー時） */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center gap-2">
                      <Maximize2 className="w-8 h-8 text-white" />
                      <span className="text-white font-bold text-sm">拡大表示</span>
                    </div>
                  </div>
                  {/* バナー番号 */}
                  <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded-md text-xs font-bold text-white">
                    #{idx + 1}
                  </div>
                </div>
                
                {/* アクションボタン */}
                <div className="p-3 sm:p-4 space-y-3">
                  {/* ダウンロードボタン（メイン） */}
                  <button
                    onClick={() => handleDownloadBanner(banner)}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/30"
                  >
                    <Download className="w-5 h-5" />
                    ダウンロード
                  </button>
                  
                  {/* サブアクション */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setZoomImage({ url: banner.imageUrl, title: `バナー ${idx + 1}` })}
                      className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Maximize2 className="w-4 h-4" />
                      拡大
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* モバイル用一括ダウンロード */}
          <div className="sm:hidden px-2">
            <button
              onClick={() => {
                generatedBanners.forEach((banner, idx) => {
                  setTimeout(() => {
                    handleDownloadBanner(banner)
                  }, idx * 500)
                })
                toast.success('全画像をダウンロード中...')
              }}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              全てダウンロード ({generatedBanners.length}枚)
            </button>
          </div>
        </div>
      )}

      <Toaster position="top-right" />

      {/* 画像拡大モーダル（ドヤバナーAIと同じ） */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={() => setZoomImage(null)}
          >
            {/* 閉じるボタン */}
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-4 right-4 z-[110] p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              aria-label="閉じる"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* タイトル */}
            <div className="absolute top-4 left-4 z-[110]">
              <h3 className="text-white text-lg font-bold drop-shadow-lg">{zoomImage.title}</h3>
            </div>

            {/* 画像コンテナ */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative max-w-[95vw] max-h-[90vh] p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={zoomImage.url}
                alt={zoomImage.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
              
              {/* 下部の操作ヒント */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                <p className="text-white/60 text-xs bg-black/50 px-3 py-1 rounded-full">
                  クリックまたは × で閉じる
                </p>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🎨 生成中モーダル（ドヤバナーAIと同じ） */}
      <AnimatePresence>
        {showGenerationModal && selectedTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
          >
            {/* 背景オーバーレイ（グラデーション） */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-blue-900/95 via-purple-900/95 to-black/95 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
            
            {/* パーティクルアニメーション背景 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(typeof window !== 'undefined' && window.innerWidth < 640 ? 10 : 20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 sm:w-2 h-1.5 sm:h-2 bg-white/20 rounded-full"
                  initial={{ 
                    x: typeof window !== 'undefined' ? Math.random() * window.innerWidth : 0, 
                    y: typeof window !== 'undefined' ? window.innerHeight + 100 : 800,
                    scale: Math.random() * 0.5 + 0.5
                  }}
                  animate={{ 
                    y: -100,
                    transition: {
                      duration: Math.random() * 10 + 10,
                      repeat: Infinity,
                      ease: "linear",
                      delay: Math.random() * 5
                    }
                  }}
                />
              ))}
      </div>

            {/* メインコンテンツ */}
            <motion.div
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="relative z-10 w-[calc(100%-16px)] sm:w-[calc(100%-32px)] max-w-sm sm:max-w-lg md:max-w-2xl lg:max-w-4xl mx-2 sm:mx-auto p-3 sm:p-5 md:p-6 lg:p-8 rounded-xl sm:rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto"
            >
              {!generationComplete ? (
                /* 生成中の表示 */
                <>
                  {/* ヘッダー */}
                  <div className="text-center mb-3 sm:mb-4 md:mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-2 sm:mb-3"
                    >
                      <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 p-0.5">
                        <div className="w-full h-full rounded-full bg-black/50 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white" />
                        </div>
                      </div>
                    </motion.div>
                    <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-1">
                      🎨 バナーを生成中...
                    </h2>
                    <motion.p 
                      key={loadingMessage}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-blue-200 text-xs sm:text-sm md:text-base"
                    >
                      {loadingMessage}
                    </motion.p>
                  </div>

                  {/* プログレスバー */}
                  <div className="mb-3 sm:mb-4 md:mb-6">
                    <div className="flex justify-between text-[10px] sm:text-xs text-white/70 mb-1">
                      <span>進捗</span>
                      <span>{Math.round(generationProgress)}%</span>
                    </div>
                    <div className="h-1.5 sm:h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  {/* 入力内容と参考画像 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* 参考画像 */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-white/80 font-semibold flex items-center gap-1 text-xs sm:text-sm">
                        <ImageIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        参考スタイル
                      </h3>
                      {selectedTemplate.imageUrl ? (
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-white/30 shadow-lg">
                          <img
                            src={selectedTemplate.imageUrl}
                            alt={selectedTemplate.title}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                          <div className="absolute bottom-1.5 sm:bottom-2 left-1.5 sm:left-2 right-1.5 sm:right-2">
                            <p className="text-white font-bold text-xs sm:text-sm drop-shadow-lg truncate">
                              {selectedTemplate.title}
                            </p>
                          </div>
                          {/* パルスアニメーション */}
                          <motion.div
                            className="absolute inset-0 border-2 border-blue-400 rounded-lg"
                            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.02, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </div>
                      ) : (
                        <div className="relative aspect-video rounded-lg overflow-hidden border border-white/30 shadow-lg bg-gray-800 flex items-center justify-center">
                          <Sparkles className="w-8 h-8 text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* 入力内容 */}
                    <div className="space-y-1.5 sm:space-y-2">
                      <h3 className="text-white/80 font-semibold flex items-center gap-1 text-xs sm:text-sm">
                        <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                        生成設定
                      </h3>
                      <div className="space-y-1.5 sm:space-y-2 bg-white/5 rounded-lg p-2 sm:p-3 border border-white/10">
                        <div>
                          <p className="text-white/50 text-[9px] sm:text-[10px]">記事タイトル</p>
                          <p className="text-white font-medium text-xs sm:text-sm truncate">{articleTitle}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          <div>
                            <p className="text-white/50 text-[9px] sm:text-[10px]">サイズ</p>
                            <p className="text-white font-medium text-[10px] sm:text-xs">
                              {`${selectedSize.width}×${selectedSize.height}`}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/50 text-[9px] sm:text-[10px]">枚数</p>
                            <p className="text-white font-medium text-[10px] sm:text-xs">{generateCount}枚</p>
                          </div>
                        </div>
                        {(logoPreview || personPreview) && (
                          <div className="flex gap-1.5 sm:gap-2 pt-1.5 border-t border-white/10">
                            {logoPreview && (
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden bg-white/10">
                                  <img src={logoPreview} alt="ロゴ" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-white/70 text-[9px] sm:text-xs">ロゴ</span>
                              </div>
                            )}
                            {personPreview && (
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded overflow-hidden bg-white/10">
                                  <img src={personPreview} alt="人物" className="w-full h-full object-cover" />
                                </div>
                                <span className="text-white/70 text-[9px] sm:text-xs">人物</span>
                              </div>
                            )}
                          </div>
                        )}
                        {customPrompt && (
                          <div className="pt-1.5 border-t border-white/10">
                            <p className="text-white/50 text-[9px] sm:text-[10px] flex items-center gap-1">
                              <span className="px-1 py-0.5 bg-purple-600 text-[6px] sm:text-[7px] font-bold rounded">ENT</span>
                              詳細指示
                            </p>
                            <p className="text-white/80 text-[9px] sm:text-[10px] line-clamp-2">{customPrompt}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ヒント */}
                  <div className="mt-3 sm:mt-4 p-2 sm:p-3 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-white/60 text-[9px] sm:text-[10px] text-center">
                      💡 AIが選択したテンプレートを分析し、記事タイトルを反映したバナーを生成しています
                    </p>
                  </div>
                </>
              ) : (
                /* 生成完了の表示 */
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 10, stiffness: 200 }}
                    className="mb-4 sm:mb-6"
                  >
                    <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center mx-auto shadow-2xl">
                      <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" />
                    </div>
                  </motion.div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3">
                    🎉 生成完了！
                  </h2>
                  <p className="text-blue-200 text-sm sm:text-base md:text-lg">
                    {generatedBanners.length}枚のバナーが生成されました
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
