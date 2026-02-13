'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Image as ImageIcon,
  Download,
  Clipboard,
  ChevronRight,
  ChevronDown,
  Target,
  Check,
  AlertTriangle,
  Clock,
  BookOpen,
  Sun,
  Cloud,
  CloudRain,
  Search,
  MessageCircle,
  Shield,
  Route,
  Briefcase,
  FileText,
  Lightbulb,
  Heart,
  TrendingUp,
  Zap,
  Award,
  User,
} from 'lucide-react'

// バナーサイズオプション
const BANNER_SIZES = [
  { key: 'google-responsive', label: 'Google レスポンシブ (1200×628)', width: 1200, height: 628 },
  { key: 'google-square', label: 'Google スクエア (1200×1200)', width: 1200, height: 1200 },
  { key: 'meta-feed', label: 'Meta フィード (1080×1080)', width: 1080, height: 1080 },
  { key: 'meta-story', label: 'Meta ストーリー (1080×1920)', width: 1080, height: 1920 },
  { key: 'twitter', label: 'Twitter/X (1200×675)', width: 1200, height: 675 },
  { key: 'youtube', label: 'YouTube サムネイル (1280×720)', width: 1280, height: 720 },
]

// ムード → 色
const MOOD_COLORS: Record<string, string> = {
  '穏やか': 'bg-green-100 text-green-700',
  'リラックス': 'bg-blue-100 text-blue-700',
  '集中': 'bg-orange-100 text-orange-700',
  '幸せ': 'bg-pink-100 text-pink-700',
  '解放感': 'bg-sky-100 text-sky-700',
  '普通': 'bg-gray-100 text-gray-600',
  '活力': 'bg-yellow-100 text-yellow-700',
  '充実': 'bg-purple-100 text-purple-700',
}

// プラットフォームロゴ
const PLATFORM_LOGOS: Record<string, { color: string; bg: string; icon: string }> = {
  'linkedin': { color: '#0A66C2', bg: 'bg-[#0A66C2]', icon: 'in' },
  'twitter': { color: '#000000', bg: 'bg-black', icon: '𝕏' },
  'x': { color: '#000000', bg: 'bg-black', icon: '𝕏' },
  'note': { color: '#41C9B4', bg: 'bg-[#41C9B4]', icon: 'n' },
  'youtube': { color: '#FF0000', bg: 'bg-[#FF0000]', icon: '▶' },
  'instagram': { color: '#E4405F', bg: 'bg-gradient-to-br from-[#833AB4] via-[#E4405F] to-[#FCAF45]', icon: '📷' },
  'facebook': { color: '#1877F2', bg: 'bg-[#1877F2]', icon: 'f' },
  'tiktok': { color: '#000000', bg: 'bg-black', icon: '♪' },
  'google': { color: '#4285F4', bg: 'bg-[#4285F4]', icon: 'G' },
  'slack': { color: '#4A154B', bg: 'bg-[#4A154B]', icon: '#' },
  'qiita': { color: '#55C500', bg: 'bg-[#55C500]', icon: 'Q' },
  'zenn': { color: '#3EA8FF', bg: 'bg-[#3EA8FF]', icon: 'Z' },
  'hatena': { color: '#00A4DE', bg: 'bg-[#00A4DE]', icon: 'B!' },
  'reddit': { color: '#FF4500', bg: 'bg-[#FF4500]', icon: 'r' },
  'pinterest': { color: '#BD081C', bg: 'bg-[#BD081C]', icon: 'P' },
  'wantedly': { color: '#21BDDB', bg: 'bg-[#21BDDB]', icon: 'W' },
  'newspicks': { color: '#FFC800', bg: 'bg-[#FFC800]', icon: 'NP' },
  'voicy': { color: '#FF6B00', bg: 'bg-[#FF6B00]', icon: '🎙' },
  'podcast': { color: '#9933CC', bg: 'bg-[#9933CC]', icon: '🎧' },
}

function getPlatformLogo(source: string) {
  const lower = source.toLowerCase()
  for (const [key, val] of Object.entries(PLATFORM_LOGOS)) {
    if (lower.includes(key)) return val
  }
  return null
}

// 天気アイコン
function WeatherIcon({ weather }: { weather: string }) {
  if (weather?.includes('雨')) return <CloudRain className="w-4 h-4" />
  if (weather?.includes('曇')) return <Cloud className="w-4 h-4" />
  return <Sun className="w-4 h-4" />
}

interface ScheduleItem {
  time: string
  activity: string
  detail: string
  mood: string
  imagePrompt?: string
}

interface DiaryData {
  title: string
  content: string
  weather: string
  imageScenes: string[]
}

interface PersonaData {
  name: string
  age: number
  gender: string
  occupation: string
  income: string
  location: string
  familyStructure: string
  lifestyle: string
  industry?: string
  companySize?: string
  challenges: string[]
  goals: string[]
  mediaUsage: string[]
  purchaseMotivation: string[]
  objections: string[]
  personalityTraits: string[]
  dayInLife: string
  quote: string
  painPoints?: Array<{ point: string; episode: string; imagePrompt?: string }>
  alternativeMethods?: Array<{ method: string; dissatisfaction: string }>
  informationGathering?: Array<{ source: string; behavior: string }>
  triggerEvents?: string[]
  resonatingMessages?: string[]
  innerVoice?: string[]
  schedule?: ScheduleItem[]
  diary?: DiaryData
}

interface DeepDiveData {
  objectionAnalysis?: Array<{ objection: string; reassurance: string }>
  adoptionStory?: {
    trigger: string
    competitors: string[]
    consultedPeople: string
    trialActivities: string
    decidingFactor: string
    timeline: Array<{ phase: string; description: string; imagePrompt?: string }>
  }
  dayWithService?: string
}

interface SummaryData {
  oneLiner?: string
  topChallenges?: Array<{ rank: number; challenge: string; episode: string }>
  alternativesDissatisfaction?: Array<{ alternative: string; dissatisfaction: string }>
  customerJourney?: Array<{ phase: string; description: string }>
  decidingFactors?: string[]
  catchphrases?: string[]
  contentIdeas?: Array<{ title: string; description: string }>
}

interface CreativesData {
  catchphrases: string[]
  lpStructure: {
    hero: string
    problem: string
    solution: string
    benefits: string[]
    cta: string
  }
  adCopy: {
    google: string[]
    meta: string[]
  }
  emailDraft: {
    subject: string
    body: string
  }
}

interface GeneratedData {
  persona: PersonaData
  deepDive?: DeepDiveData
  summary?: SummaryData
  creatives: CreativesData
  marketingChecklist?: any[]
}

export default function PersonaPage() {
  const [url, setUrl] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null)
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [bannerImage, setBannerImage] = useState<string | null>(null)
  const [bannerLoading, setBannerLoading] = useState(false)
  const [selectedBannerSize, setSelectedBannerSize] = useState(BANNER_SIZES[0].key)
  const [selectedCatchphrase, setSelectedCatchphrase] = useState('')
  const [activeTab, setActiveTab] = useState<'persona' | 'creatives'>('persona')
  const [copied, setCopied] = useState<string | null>(null)
  const [portraitError, setPortraitError] = useState('')
  const [bannerError, setBannerError] = useState('')
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({})
  const [sceneLoading, setSceneLoading] = useState<Record<string, boolean>>({})
  const portraitAutoTriggered = useRef(false)
  const sceneAutoTriggered = useRef(false)

  // 手書きフォント読み込み
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Klee+One&family=Zen+Kurenaido&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [])

  // ローカルストレージから履歴読み込み
  useEffect(() => {
    const stored = localStorage.getItem('doya_persona_last')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.data) {
          setGeneratedData(parsed.data)
          setPortraitImage(parsed.portrait || null)
          if (parsed.sceneImages) setSceneImages(parsed.sceneImages)
        }
      } catch {}
    }
  }, [])

  // ペルソナ生成後にポートレートを自動生成
  useEffect(() => {
    if (generatedData?.persona && !portraitImage && !portraitLoading && !portraitAutoTriggered.current) {
      portraitAutoTriggered.current = true
      const timer = setTimeout(() => {
        handleGeneratePortrait()
      }, 500)
      return () => clearTimeout(timer)
    }
    if (!generatedData) {
      portraitAutoTriggered.current = false
    }
  }, [generatedData, portraitImage, portraitLoading])

  // シーン画像の自動生成
  useEffect(() => {
    if (!generatedData?.persona || sceneAutoTriggered.current) return
    const schedule = generatedData.persona.schedule
    const diary = generatedData.persona.diary
    const painPoints = generatedData.persona.painPoints
    const adoptionTimeline = generatedData.deepDive?.adoptionStory?.timeline
    if (!schedule && !diary && !painPoints && !adoptionTimeline) return

    sceneAutoTriggered.current = true
    let delay = 1500

    // スケジュール画像
    if (schedule) {
      schedule.forEach((item, idx) => {
        if (item.imagePrompt) {
          const key = `schedule-${idx}`
          if (!sceneImages[key]) {
            setTimeout(() => handleGenerateScene(item.imagePrompt!, key), delay)
            delay += 3000
          }
        }
      })
    }

    // 日記画像
    if (diary?.imageScenes) {
      diary.imageScenes.forEach((scene, idx) => {
        const key = `diary-${idx}`
        if (!sceneImages[key]) {
          setTimeout(() => handleGenerateScene(scene, key), delay)
          delay += 3000
        }
      })
    }

    // ペインポイント画像
    if (painPoints) {
      painPoints.forEach((pp, idx) => {
        if (pp.imagePrompt) {
          const key = `painpoint-${idx}`
          if (!sceneImages[key]) {
            setTimeout(() => handleGenerateScene(pp.imagePrompt!, key), delay)
            delay += 3000
          }
        }
      })
    }

    // 導入ストーリー画像
    if (adoptionTimeline) {
      adoptionTimeline.forEach((step, idx) => {
        if (step.imagePrompt) {
          const key = `adoption-${idx}`
          if (!sceneImages[key]) {
            setTimeout(() => handleGenerateScene(step.imagePrompt!, key), delay)
            delay += 3000
          }
        }
      })
    }

    // まとめセクション用ヒーロー画像
    if (generatedData.summary) {
      const key = 'summary-hero'
      if (!sceneImages[key]) {
        const heroPrompt = `Professional portrait photo of a ${generatedData.persona.age}-year-old Japanese ${generatedData.persona.gender === '男性' ? 'man' : 'woman'} who works as ${generatedData.persona.occupation}, confident and professional, standing in a modern office, warm lighting, editorial magazine style`
        setTimeout(() => handleGenerateScene(heroPrompt, key), delay)
        delay += 3000
      }
    }
  }, [generatedData])

  const handleGenerate = async () => {
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    setLoading(true)
    setError('')
    setPortraitError('')
    setBannerError('')
    setGeneratedData(null)
    setPortraitImage(null)
    setBannerImage(null)
    setSceneImages({})
    sceneAutoTriggered.current = false
    portraitAutoTriggered.current = false

    try {
      const res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, serviceName, additionalInfo }),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        const msg =
          (data && (data.error || data.message)) ||
          (raw && raw.slice(0, 200)) ||
          'ペルソナ生成に失敗しました'
        throw new Error(msg)
      }

      if (!data?.data || !data?.data?.persona) {
        throw new Error('ペルソナデータの取得に失敗しました。もう一度お試しください。')
      }

      setGeneratedData(data.data)

      localStorage.setItem('doya_persona_last', JSON.stringify({ data: data.data, url, timestamp: Date.now() }))

      const history = JSON.parse(localStorage.getItem('doya_persona_history') || '[]')
      history.unshift({ data: data.data, url, timestamp: Date.now() })
      localStorage.setItem('doya_persona_history', JSON.stringify(history.slice(0, 20)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGeneratePortrait = async () => {
    if (!generatedData?.persona) return

    setPortraitLoading(true)
    setPortraitError('')
    try {
      const res = await fetch('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: generatedData.persona }),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok || !data) {
        throw new Error(data?.error || 'ポートレート生成に失敗しました')
      }

      if (data.success && data.image) {
        setPortraitImage(data.image)
        const stored = JSON.parse(localStorage.getItem('doya_persona_last') || '{}')
        stored.portrait = data.image
        localStorage.setItem('doya_persona_last', JSON.stringify(stored))
      } else {
        throw new Error(data.error || 'ポートレート画像の取得に失敗しました')
      }
    } catch (e) {
      setPortraitError(e instanceof Error ? e.message : 'ポートレート生成エラー')
    } finally {
      setPortraitLoading(false)
    }
  }

  const handleGenerateScene = useCallback(async (scenePrompt: string, sceneKey: string) => {
    setSceneLoading(prev => ({ ...prev, [sceneKey]: true }))
    try {
      const res = await fetch('/api/persona/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenePrompt,
          persona: generatedData?.persona
            ? {
                age: generatedData.persona.age,
                gender: generatedData.persona.gender,
                occupation: generatedData.persona.occupation,
                name: generatedData.persona.name,
                personalityTraits: generatedData.persona.personalityTraits,
                lifestyle: generatedData.persona.lifestyle,
              }
            : undefined,
        }),
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = null }

      if (data?.success && data?.image) {
        setSceneImages(prev => {
          const updated = { ...prev, [sceneKey]: data.image }
          try {
            const stored = JSON.parse(localStorage.getItem('doya_persona_last') || '{}')
            stored.sceneImages = updated
            localStorage.setItem('doya_persona_last', JSON.stringify(stored))
          } catch {}
          return updated
        })
      }
    } catch (e) {
      console.error('Scene generation error:', e)
    } finally {
      setSceneLoading(prev => ({ ...prev, [sceneKey]: false }))
    }
  }, [generatedData])

  const handleGenerateBanner = async () => {
    if (!generatedData?.persona || !selectedCatchphrase) {
      setBannerError('キャッチコピーを選択してください')
      return
    }

    setBannerLoading(true)
    setBannerError('')
    try {
      const res = await fetch('/api/persona/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          persona: generatedData.persona,
          serviceName,
          catchphrase: selectedCatchphrase,
          sizeKey: selectedBannerSize,
        }),
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = null }

      if (!res.ok || !data) {
        throw new Error(data?.error || 'バナー生成に失敗しました')
      }

      if (data.success && data.image) {
        setBannerImage(data.image)
      } else {
        throw new Error(data.error || 'バナー画像の取得に失敗しました')
      }
    } catch (e) {
      setBannerError(e instanceof Error ? e.message : 'バナー生成エラー')
    } finally {
      setBannerLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }

  // シーン画像プレースホルダー
  const SceneImageSlot = ({ sceneKey, className = '' }: { sceneKey: string; className?: string }) => {
    const img = sceneImages[sceneKey]
    const isLoading = sceneLoading[sceneKey]

    if (img) {
      return (
        <div className={`rounded-lg overflow-hidden shadow-md ${className}`}>
          <img src={img} alt="" className="w-full h-full object-cover object-center" />
        </div>
      )
    }
    if (isLoading) {
      return (
        <div className={`rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 flex items-center justify-center ${className}`}>
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-purple-400 text-xs">画像生成中...</p>
          </div>
        </div>
      )
    }
    return null
  }

  const persona = generatedData?.persona

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-purple-50/30">
      <div className="max-w-6xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-gray-900 mb-1 flex items-center gap-3">
            <Target className="w-8 h-8 text-purple-600" />
            ドヤペルソナAI
          </h1>
          <p className="text-gray-500 text-sm">URLからマーケティングペルソナを自動生成</p>
        </div>

        {/* Input Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-800 mb-2">
              サイトURL <span className="text-purple-600">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-base"
            />
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-4"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            詳細設定（任意）
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">サービス名（任意）</label>
                    <input
                      type="text"
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="例: ドヤマーケ"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">追加情報（任意）</label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      placeholder="ターゲット層や商品の特徴など、補足情報があれば入力してください"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-base hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                ペルソナを生成
              </>
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ===== Results ===== */}
        {generatedData && (
          <div className="space-y-6">
            {/* Tabs: ペルソナ履歴書 / クリエイティブ */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              {[
                { key: 'persona', label: 'ペルソナ履歴書', icon: Target },
                { key: 'creatives', label: 'クリエイティブ', icon: Sparkles },
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all ${
                      activeTab === tab.key
                        ? 'bg-purple-600 text-white shadow-lg'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-white/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* ========================================== */}
            {/* ペルソナ履歴書タブ                          */}
            {/* ========================================== */}
            {activeTab === 'persona' && persona && (
              <div className="space-y-0">
                {/* ======= 履歴書本体 ======= */}
                <div
                  className="bg-white rounded-t-lg shadow-2xl overflow-hidden max-w-4xl mx-auto text-gray-900"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                >
                  {/* タイトル + 日付 */}
                  <div className="px-6 pt-5 pb-3 flex items-end justify-between">
                    <h2 className="text-2xl font-bold tracking-widest">ペルソナ履歴書</h2>
                    <p className="text-xs text-gray-500">
                      {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在
                    </p>
                  </div>

                  {/* 名前 + 基本情報 + 写真 */}
                  <div className="mx-6 border border-gray-400">
                    <div className="flex">
                      <div className="flex-1 min-w-0">
                        <div className="border-b border-gray-300 px-3 py-1">
                          <p className="text-[10px] text-gray-400">ふりがな</p>
                        </div>
                        <div className="border-b border-gray-400 px-3 py-2">
                          <p className="text-xl font-bold">{persona.name}</p>
                        </div>
                        <div className="border-b border-gray-400 px-3 py-2 flex items-center gap-4 text-sm">
                          <span>{persona.age}歳</span>
                          <span className="text-gray-300">|</span>
                          <span>{persona.gender}</span>
                        </div>
                        <div className="border-b border-gray-300 px-3 py-1">
                          <p className="text-[10px] text-gray-400">現住所</p>
                        </div>
                        <div className="border-b border-gray-400 px-3 py-2 text-sm">{persona.location}</div>
                        <div className="border-b border-gray-300 px-3 py-1">
                          <p className="text-[10px] text-gray-400">職業</p>
                        </div>
                        <div className="px-3 py-2 text-sm">{persona.occupation}</div>
                      </div>
                      {/* 写真欄 */}
                      <div className="w-[130px] flex-shrink-0 border-l border-gray-400 flex flex-col items-center justify-center p-2 bg-gray-50">
                        <div className="w-[105px] h-[140px] border border-gray-300 bg-white overflow-hidden flex items-center justify-center">
                          {portraitImage ? (
                            <img src={portraitImage} alt="Persona" className="w-full h-full object-cover object-center" />
                          ) : portraitLoading ? (
                            <div className="text-center">
                              <div className="w-5 h-5 border-2 border-gray-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-1" />
                              <p className="text-gray-400 text-[10px]">生成中</p>
                            </div>
                          ) : (
                            <div className="text-center text-gray-300 text-xs leading-relaxed">
                              <p className="text-3xl mb-1">👤</p>
                              <p>写真</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2">
                          {portraitImage ? (
                            <button
                              onClick={() => downloadImage(portraitImage, `persona-${persona.name}.png`)}
                              className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 inline-flex items-center gap-1"
                            >
                              <Download className="w-2.5 h-2.5" />
                              保存
                            </button>
                          ) : !portraitLoading ? (
                            <button
                              onClick={handleGeneratePortrait}
                              disabled={portraitLoading}
                              className="px-2 py-1 rounded bg-purple-600 text-white text-[10px] font-bold hover:bg-purple-500 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <ImageIcon className="w-2.5 h-2.5" />
                              写真を生成
                            </button>
                          ) : null}
                        </div>
                        {portraitError && (
                          <p className="mt-1 text-red-500 text-[10px] text-center">{portraitError}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 基本属性テーブル */}
                  <div className="mx-6 mt-4 border border-gray-400">
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap">年収</td>
                          <td className="border border-gray-300 px-3 py-2">{persona.income}</td>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap">家族構成</td>
                          <td className="border border-gray-300 px-3 py-2">{persona.familyStructure}</td>
                        </tr>
                        {(persona.industry || persona.companySize) && (
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">業界</td>
                          <td className="border border-gray-300 px-3 py-2">{persona.industry || '—'}</td>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">会社規模</td>
                          <td className="border border-gray-300 px-3 py-2">{persona.companySize || '—'}</td>
                        </tr>
                        )}
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">ライフスタイル</td>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2">{persona.lifestyle}</td>
                        </tr>
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap">一日の過ごし方</td>
                          <td colSpan={3} className="border border-gray-300 px-3 py-2">{persona.dayInLife}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 座右の銘 */}
                  {persona.quote && (
                    <div className="mx-6 mt-4 border border-gray-400">
                      <div className="flex">
                        <div className="bg-gray-100 border-r border-gray-300 px-3 py-2 font-bold text-xs w-[100px] flex items-center justify-center whitespace-nowrap">座右の銘</div>
                        <div className="px-3 py-2 text-sm italic flex-1">&ldquo;{persona.quote}&rdquo;</div>
                      </div>
                    </div>
                  )}

                  {/* 課題・目標 */}
                  <div className="mx-6 mt-4 grid grid-cols-2 gap-0 border border-gray-400">
                    <div className="border-r border-gray-400">
                      <div className="bg-red-50 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center text-red-700">課題・悩み</div>
                      <div className="px-3 py-2">
                        {persona.challenges?.map((c, i) => (
                          <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-100 last:border-b-0">
                            <span className="text-red-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="bg-green-50 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center text-green-700">目標・願望</div>
                      <div className="px-3 py-2">
                        {persona.goals?.map((g, i) => (
                          <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-100 last:border-b-0">
                            <span className="text-green-500 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                            <span>{g}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 購買動機 / 懸念 */}
                  {(persona.purchaseMotivation?.length > 0 || persona.objections?.length > 0) && (
                    <div className="mx-6 mt-4 grid grid-cols-2 gap-0 border border-gray-400">
                      <div className="border-r border-gray-400">
                        <div className="bg-blue-50 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center text-blue-700">購買動機</div>
                        <div className="px-3 py-2">
                          {persona.purchaseMotivation?.map((m, i) => (
                            <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-100 last:border-b-0">
                              <span className="text-blue-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                              <span>{m}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="bg-orange-50 border-b border-gray-400 px-3 py-1.5 font-bold text-xs text-center text-orange-700">懸念・反論</div>
                        <div className="px-3 py-2">
                          {persona.objections?.map((o, i) => (
                            <div key={i} className="flex items-start gap-2 py-1 text-sm border-b border-gray-100 last:border-b-0">
                              <span className="text-orange-400 mt-0.5 flex-shrink-0 text-xs">{i + 1}.</span>
                              <span>{o}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* メディア / 性格 */}
                  <div className="mx-6 mt-4 border border-gray-400">
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-[100px] text-center whitespace-nowrap align-top">メディア利用</td>
                          <td className="border border-gray-300 px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {persona.mediaUsage?.map((m, i) => (
                                <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs">{m}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center whitespace-nowrap align-top">性格特性</td>
                          <td className="border border-gray-300 px-3 py-2">
                            <div className="flex flex-wrap gap-1.5">
                              {persona.personalityTraits?.map((t, i) => (
                                <span key={i} className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs">{t}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="h-6" />
                </div>

                {/* ======= 一日のスケジュール ======= */}
                {persona.schedule && persona.schedule.length > 0 && (
                  <div
                    className="bg-gradient-to-b from-white to-amber-50/50 max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-6 py-3 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">一日のスケジュール</h3>
                    </div>

                    <div className="px-6 py-6">
                      <div className="relative">
                        <div className="absolute left-[52px] top-0 bottom-0 w-0.5 bg-amber-200" />

                        {persona.schedule.map((item, idx) => {
                          const sceneKey = `schedule-${idx}`
                          const hasImage = !!item.imagePrompt
                          const moodColor = MOOD_COLORS[item.mood] || MOOD_COLORS['普通']

                          return (
                            <div key={idx} className="relative flex items-start gap-4 mb-6 last:mb-0">
                              <div className="w-[44px] flex-shrink-0 text-right">
                                <span className="text-sm font-bold text-amber-700">{item.time}</span>
                              </div>
                              <div className="relative z-10 w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow mt-1 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-bold text-sm text-gray-900">{item.activity}</h4>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${moodColor}`}>{item.mood}</span>
                                  </div>
                                  <p className="text-gray-600 text-xs leading-relaxed">{item.detail}</p>

                                  {hasImage && (
                                    <div className="mt-3">
                                      <SceneImageSlot sceneKey={sceneKey} className="w-full h-40 sm:h-48" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ======= 日記セクション ======= */}
                {persona.diary && (
                  <div
                    className="bg-amber-50 max-w-4xl mx-auto shadow-2xl overflow-hidden"
                    style={{ fontFamily: '"Klee One", "Zen Kurenaido", "Noto Sans JP", cursive, sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-3 flex items-center gap-3">
                      <BookOpen className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">ペルソナの日記</h3>
                    </div>

                    <div className="mx-4 sm:mx-8 my-6 bg-white rounded-lg shadow-lg border border-amber-200 overflow-hidden">
                      <div className="bg-gradient-to-r from-amber-100 to-yellow-50 px-5 py-3 border-b border-amber-200 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <WeatherIcon weather={persona.diary.weather || ''} />
                          <span className="text-amber-700 text-sm">{persona.diary.weather}</span>
                        </div>
                        <span className="text-amber-500 text-xs">
                          {new Date().getFullYear()}/{new Date().getMonth() + 1}/{new Date().getDate()}
                        </span>
                      </div>

                      <div className="px-5 pt-4 pb-2">
                        <h4 className="text-lg font-bold text-gray-800" style={{ fontFamily: '"Klee One", cursive' }}>
                          {persona.diary.title}
                        </h4>
                      </div>

                      {persona.diary.imageScenes?.[0] && (
                        <div className="px-5 pb-3">
                          <SceneImageSlot sceneKey="diary-0" className="w-full h-44 sm:h-56" />
                        </div>
                      )}

                      <div
                        className="px-5 pb-4 text-gray-700 text-[15px] leading-[2rem]"
                        style={{
                          fontFamily: '"Klee One", "Zen Kurenaido", cursive',
                          backgroundImage: 'repeating-linear-gradient(transparent, transparent 1.9rem, #e8dfd0 1.9rem, #e8dfd0 2rem)',
                          backgroundPosition: '0 0.5rem',
                        }}
                      >
                        {persona.diary.content}
                      </div>

                      {persona.diary.imageScenes?.[1] && (
                        <div className="px-5 pb-4">
                          <SceneImageSlot sceneKey="diary-1" className="w-full h-44 sm:h-56" />
                        </div>
                      )}

                      <div className="px-5 pb-4 flex justify-end">
                        <p className="text-amber-400 text-sm italic" style={{ fontFamily: '"Klee One", cursive' }}>
                          — {persona.name}
                        </p>
                      </div>
                    </div>

                    <div className="h-4" />
                  </div>
                )}

                {/* ======= 課題・ペインポイント（深掘り）+ 画像付き ======= */}
                {persona.painPoints && persona.painPoints.length > 0 && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-red-600 to-rose-500 px-6 py-3 flex items-center gap-3">
                      <Zap className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">課題・ペインポイント</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                      {persona.painPoints.map((pp, i) => {
                        const sceneKey = `painpoint-${i}`
                        const hasImage = !!pp.imagePrompt
                        return (
                          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden bg-gradient-to-br from-white to-red-50/30">
                            <div className="flex items-start gap-4 p-4">
                              <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm text-gray-900 mb-1">{pp.point}</h4>
                                <p className="text-xs text-gray-600 leading-relaxed">{pp.episode}</p>
                              </div>
                            </div>
                            {hasImage && (
                              <div className="px-4 pb-4">
                                <SceneImageSlot sceneKey={sceneKey} className="w-full h-40 sm:h-48" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* ======= 代替手段と不満 ======= */}
                {persona.alternativeMethods && persona.alternativeMethods.length > 0 && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-6 py-3 flex items-center gap-3">
                      <Search className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">サービスを知る前の代替手段と不満</h3>
                    </div>
                    <div className="px-6 py-4">
                      <table className="w-full text-sm border-collapse border border-gray-300">
                        <thead>
                          <tr>
                            <th className="bg-orange-50 border border-gray-300 px-3 py-2 text-xs font-bold text-orange-700 w-1/3">代替手段</th>
                            <th className="bg-orange-50 border border-gray-300 px-3 py-2 text-xs font-bold text-orange-700">不満・課題</th>
                          </tr>
                        </thead>
                        <tbody>
                          {persona.alternativeMethods.map((am, i) => (
                            <tr key={i}>
                              <td className="border border-gray-300 px-3 py-2 font-medium">{am.method}</td>
                              <td className="border border-gray-300 px-3 py-2 text-gray-600">{am.dissatisfaction}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ======= 情報収集行動（ロゴ付き）+ 導入きっかけ + 響くメッセージ + 心の声 ======= */}
                {(persona.informationGathering || persona.triggerEvents || persona.resonatingMessages || persona.innerVoice) && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-6 py-3 flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">行動・心理分析</h3>
                    </div>
                    <div className="px-6 py-4 space-y-4">
                      {/* 情報収集行動（ロゴ付き） */}
                      {persona.informationGathering && persona.informationGathering.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-blue-700 mb-3 flex items-center gap-2">
                            <Search className="w-4 h-4" />
                            情報収集行動
                          </h4>
                          <div className="space-y-2">
                            {persona.informationGathering.map((ig, i) => {
                              const logo = getPlatformLogo(ig.source)
                              return (
                                <div key={i} className="flex items-start gap-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 hover:shadow-sm transition-shadow">
                                  {/* プラットフォームロゴ */}
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm ${logo ? logo.bg : 'bg-gray-500'}`}>
                                    {logo ? logo.icon : ig.source.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-gray-900">{ig.source}</p>
                                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ig.behavior}</p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* 導入検討きっかけ */}
                      {persona.triggerEvents && persona.triggerEvents.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-indigo-700 mb-2 flex items-center gap-2">
                            <Zap className="w-4 h-4" />
                            導入を検討するきっかけ
                          </h4>
                          <div className="space-y-1.5">
                            {persona.triggerEvents.map((te, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
                                <span className="text-indigo-500 font-bold text-xs mt-0.5">{i + 1}.</span>
                                <span className="text-sm text-gray-800">{te}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 響くメッセージ */}
                      {persona.resonatingMessages && persona.resonatingMessages.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-purple-700 mb-2 flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            響くメッセージ・訴求ポイント
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {persona.resonatingMessages.map((rm, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                                <span className="text-purple-400 mt-0.5">✦</span>
                                <span className="text-sm text-gray-800">{rm}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 心の声 */}
                      {persona.innerVoice && persona.innerVoice.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4" />
                            心の声
                          </h4>
                          <div className="space-y-1.5">
                            {persona.innerVoice.map((iv, i) => (
                              <div key={i} className="px-4 py-2 bg-emerald-50 rounded-lg border-l-4 border-emerald-400 text-sm text-gray-700 italic">
                                &ldquo;{iv}&rdquo;
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ======= 深掘りインタビュー（Q&A形式） ======= */}
                {generatedData?.deepDive?.objectionAnalysis && generatedData.deepDive.objectionAnalysis.length > 0 && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-violet-700 to-purple-600 px-6 py-3 flex items-center gap-3">
                      <Shield className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">深掘りインタビュー</h3>
                    </div>
                    <div className="px-6 py-5 space-y-5">
                      {generatedData.deepDive.objectionAnalysis.map((oa, i) => (
                        <div key={i} className="space-y-3">
                          {/* Q: インタビュアー */}
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">Q</div>
                            <div className="flex-1 bg-violet-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-violet-100">
                              <p className="text-xs text-violet-500 font-bold mb-1">質問 {i + 1}</p>
                              <p className="text-sm text-gray-800">「{oa.objection}」という不安について、詳しく教えてください。</p>
                            </div>
                          </div>
                          {/* A: ペルソナ */}
                          <div className="flex items-start gap-3 pl-6">
                            <div className="flex-1 bg-gray-50 rounded-2xl rounded-tr-sm px-4 py-3 border border-gray-200">
                              <p className="text-xs text-gray-400 font-bold mb-1">{persona.name}の回答</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{oa.reassurance}</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {portraitImage ? (
                                <img src={portraitImage} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <User className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                          {i < generatedData.deepDive!.objectionAnalysis!.length - 1 && (
                            <div className="border-b border-gray-100 mx-8" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ======= 導入ストーリー（ストーリー風デザイン + 画像） ======= */}
                {generatedData?.deepDive?.adoptionStory && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-6 py-3 flex items-center gap-3">
                      <Route className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">導入ストーリー ─ {persona.name}の場合</h3>
                    </div>

                    {/* ストーリー概要（履歴書風テーブル） */}
                    <div className="px-6 pt-4">
                      <div className="border border-gray-300">
                        <table className="w-full text-sm border-collapse">
                          <tbody>
                            <tr>
                              <td className="bg-teal-50 border border-gray-300 px-3 py-2 font-bold text-xs text-teal-700 w-[140px] whitespace-nowrap">知ったきっかけ</td>
                              <td className="border border-gray-300 px-3 py-2">{generatedData.deepDive.adoptionStory.trigger}</td>
                            </tr>
                            <tr>
                              <td className="bg-teal-50 border border-gray-300 px-3 py-2 font-bold text-xs text-teal-700 whitespace-nowrap">比較検討した競合</td>
                              <td className="border border-gray-300 px-3 py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {generatedData.deepDive.adoptionStory.competitors?.map((c, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs border border-gray-200">{c}</span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                            <tr>
                              <td className="bg-teal-50 border border-gray-300 px-3 py-2 font-bold text-xs text-teal-700 whitespace-nowrap">社内相談相手</td>
                              <td className="border border-gray-300 px-3 py-2">{generatedData.deepDive.adoptionStory.consultedPeople}</td>
                            </tr>
                            <tr>
                              <td className="bg-teal-50 border border-gray-300 px-3 py-2 font-bold text-xs text-teal-700 whitespace-nowrap">トライアル内容</td>
                              <td className="border border-gray-300 px-3 py-2">{generatedData.deepDive.adoptionStory.trialActivities}</td>
                            </tr>
                            <tr>
                              <td className="bg-teal-50 border border-gray-300 px-3 py-2 font-bold text-xs text-teal-700 whitespace-nowrap">最終的な決め手</td>
                              <td className="border border-gray-300 px-3 py-2 font-medium text-teal-800">{generatedData.deepDive.adoptionStory.decidingFactor}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ストーリー風タイムライン */}
                    {generatedData.deepDive.adoptionStory.timeline && (
                      <div className="px-6 py-5">
                        <h4 className="text-sm font-bold text-teal-700 mb-4 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" />
                          {persona.name}の導入ストーリー
                        </h4>
                        <div className="relative space-y-0">
                          {/* 縦線 */}
                          <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gradient-to-b from-teal-400 via-teal-300 to-teal-200" />

                          {generatedData.deepDive.adoptionStory.timeline.map((step, i) => {
                            const sceneKey = `adoption-${i}`
                            const hasImage = !!step.imagePrompt
                            const storyColors = ['bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500']
                            const bgColors = ['bg-teal-50', 'bg-cyan-50', 'bg-blue-50', 'bg-indigo-50', 'bg-violet-50', 'bg-purple-50']
                            const borderColors = ['border-teal-200', 'border-cyan-200', 'border-blue-200', 'border-indigo-200', 'border-violet-200', 'border-purple-200']

                            return (
                              <div key={i} className="relative flex items-start gap-4 pb-6 last:pb-0">
                                {/* ステップ番号 */}
                                <div className={`relative z-10 w-10 h-10 rounded-full ${storyColors[i % 6]} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md`}>
                                  {i + 1}
                                </div>
                                {/* カード */}
                                <div className={`flex-1 ${bgColors[i % 6]} rounded-xl border ${borderColors[i % 6]} p-4 shadow-sm`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2 py-0.5 bg-white/80 rounded-full text-xs font-bold text-gray-600 border border-gray-200">
                                      Chapter {i + 1}
                                    </span>
                                    <h5 className="font-bold text-sm text-gray-900">{step.phase}</h5>
                                  </div>
                                  <p className="text-sm text-gray-700 leading-relaxed">{step.description}</p>

                                  {/* 画像 */}
                                  {hasImage && (
                                    <div className="mt-3">
                                      <SceneImageSlot sceneKey={sceneKey} className="w-full h-40 sm:h-48 rounded-lg" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ======= 利用シーン（ある1日） ======= */}
                {generatedData?.deepDive?.dayWithService && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-6 py-3 flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">利用シーン ─ サービスを使うある1日</h3>
                    </div>
                    <div className="px-6 py-4">
                      <div className="bg-sky-50 rounded-lg border border-sky-200 p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                        {generatedData.deepDive.dayWithService}
                      </div>
                    </div>
                  </div>
                )}

                {/* ======= まとめ ─ ペルソナシート最終版（画像付き） ======= */}
                {generatedData?.summary && (
                  <div
                    className="bg-white max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900 rounded-b-lg"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-purple-700 to-pink-600 px-6 py-3 flex items-center gap-3">
                      <Award className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">ペルソナシート ─ 最終まとめ</h3>
                    </div>
                    <div className="px-6 py-5 space-y-5">
                      {/* ヒーロー画像 + 1行サマリー */}
                      <div className="relative rounded-xl overflow-hidden">
                        <SceneImageSlot sceneKey="summary-hero" className="w-full h-48 sm:h-56" />
                        {generatedData.summary.oneLiner && (
                          <div className="mt-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-4 text-center">
                            <p className="text-xs text-purple-500 font-bold mb-1">ペルソナ概要</p>
                            <p className="text-base font-bold text-gray-900">{generatedData.summary.oneLiner}</p>
                          </div>
                        )}
                      </div>

                      {/* 基本情報（表形式） */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          基本情報
                        </h4>
                        <table className="w-full text-sm border-collapse border border-gray-300">
                          <tbody>
                            <tr>
                              <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-24 text-center">名前</td>
                              <td className="border border-gray-300 px-3 py-2">{persona.name}</td>
                              <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs w-24 text-center">年齢</td>
                              <td className="border border-gray-300 px-3 py-2">{persona.age}歳 / {persona.gender}</td>
                            </tr>
                            <tr>
                              <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center">役職</td>
                              <td className="border border-gray-300 px-3 py-2">{persona.occupation}</td>
                              <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center">業界</td>
                              <td className="border border-gray-300 px-3 py-2">{persona.industry || '—'}</td>
                            </tr>
                            <tr>
                              <td className="bg-gray-100 border border-gray-300 px-3 py-2 font-bold text-xs text-center">会社規模</td>
                              <td colSpan={3} className="border border-gray-300 px-3 py-2">{persona.companySize || '—'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 課題TOP3 */}
                      {generatedData.summary.topChallenges && generatedData.summary.topChallenges.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-red-500" />
                            課題TOP3（優先度順）
                          </h4>
                          {generatedData.summary.topChallenges.map((tc, i) => (
                            <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                                i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : 'bg-yellow-500'
                              }`}>{tc.rank || i + 1}</div>
                              <div className="flex-1 bg-gray-50 rounded-lg border border-gray-200 p-3">
                                <p className="font-bold text-sm text-gray-900">{tc.challenge}</p>
                                <p className="text-xs text-gray-500 mt-1">{tc.episode}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 代替手段と不満 */}
                      {generatedData.summary.alternativesDissatisfaction && generatedData.summary.alternativesDissatisfaction.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Search className="w-4 h-4 text-orange-500" />
                            現在の代替手段と不満点
                          </h4>
                          <table className="w-full text-sm border-collapse border border-gray-300">
                            <thead>
                              <tr>
                                <th className="bg-orange-50 border border-gray-300 px-3 py-1.5 text-xs font-bold text-orange-700 w-1/3">代替手段</th>
                                <th className="bg-orange-50 border border-gray-300 px-3 py-1.5 text-xs font-bold text-orange-700">不満点</th>
                              </tr>
                            </thead>
                            <tbody>
                              {generatedData.summary.alternativesDissatisfaction.map((ad, i) => (
                                <tr key={i}>
                                  <td className="border border-gray-300 px-3 py-2 font-medium">{ad.alternative}</td>
                                  <td className="border border-gray-300 px-3 py-2 text-gray-600">{ad.dissatisfaction}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* カスタマージャーニー */}
                      {generatedData.summary.customerJourney && generatedData.summary.customerJourney.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Route className="w-4 h-4 text-teal-500" />
                            カスタマージャーニー
                          </h4>
                          <div className="flex flex-col sm:flex-row gap-0">
                            {generatedData.summary.customerJourney.map((cj, i) => (
                              <div key={i} className="flex-1 relative">
                                <div className={`p-3 border border-gray-200 ${
                                  i === 0 ? 'rounded-t-lg sm:rounded-l-lg sm:rounded-tr-none' :
                                  i === generatedData.summary!.customerJourney!.length - 1 ? 'rounded-b-lg sm:rounded-r-lg sm:rounded-bl-none' : ''
                                } ${
                                  i === 0 ? 'bg-blue-50' : i === 1 ? 'bg-green-50' : i === 2 ? 'bg-yellow-50' : 'bg-purple-50'
                                }`}>
                                  <p className={`text-xs font-bold mb-1 ${
                                    i === 0 ? 'text-blue-700' : i === 1 ? 'text-green-700' : i === 2 ? 'text-yellow-700' : 'text-purple-700'
                                  }`}>{cj.phase}</p>
                                  <p className="text-xs text-gray-700">{cj.description}</p>
                                </div>
                                {i < (generatedData.summary?.customerJourney?.length || 0) - 1 && (
                                  <div className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-5 h-5 bg-white rounded-full border border-gray-300 items-center justify-center">
                                    <ChevronRight className="w-3 h-3 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 導入の決め手 */}
                      {generatedData.summary.decidingFactors && generatedData.summary.decidingFactors.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-500" />
                            導入の決め手になるポイント
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {generatedData.summary.decidingFactors.map((df, i) => (
                              <div key={i} className="bg-green-50 rounded-lg border border-green-200 p-3 text-center">
                                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold mx-auto mb-1.5">{i + 1}</div>
                                <p className="text-sm font-medium text-gray-800">{df}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* キャッチコピー候補 */}
                      {generatedData.summary.catchphrases && generatedData.summary.catchphrases.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-pink-500" />
                            響くキャッチコピー候補5選
                          </h4>
                          <div className="space-y-1.5">
                            {generatedData.summary.catchphrases.map((cp, i) => (
                              <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                                <span className="text-purple-500 font-bold text-xs">{i + 1}.</span>
                                <span className="text-sm font-medium text-gray-800 flex-1">{cp}</span>
                                <button
                                  onClick={() => copyToClipboard(cp, `summary-cp-${i}`)}
                                  className="p-1 hover:bg-purple-100 rounded text-gray-400 hover:text-purple-600 transition-colors"
                                  title="コピー"
                                >
                                  {copied === `summary-cp-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* コンテンツ企画案 */}
                      {generatedData.summary.contentIdeas && generatedData.summary.contentIdeas.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-500" />
                            このペルソナに届くコンテンツ企画案
                          </h4>
                          {generatedData.summary.contentIdeas.map((ci, i) => (
                            <div key={i} className="flex items-start gap-3 mb-2 last:mb-0">
                              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                              <div className="flex-1 bg-amber-50 rounded-lg border border-amber-200 p-3">
                                <p className="font-bold text-sm text-gray-900">{ci.title}</p>
                                <p className="text-xs text-gray-500 mt-1">{ci.description}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* フッター余白 */}
                <div className="max-w-4xl mx-auto h-2" />
              </div>
            )}

            {/* ========================================== */}
            {/* クリエイティブタブ                          */}
            {/* ========================================== */}
            {activeTab === 'creatives' && generatedData.creatives && (
              <div className="space-y-6">
                {/* キャッチコピー + バナー */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    キャッチコピー候補
                    <span className="text-xs text-gray-400 font-normal">（クリックで選択 → バナー生成）</span>
                  </h3>
                  <div className="space-y-2 mb-5">
                    {generatedData.creatives.catchphrases?.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedCatchphrase(c)}
                        className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                          selectedCatchphrase === c
                            ? 'bg-purple-50 border-purple-400 text-purple-800'
                            : 'bg-gray-50 border-gray-200 text-gray-800 hover:border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        <span className="font-medium text-sm">{c}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(c, `catch-${i}`) }}
                            className="p-1 hover:bg-gray-200 rounded"
                            title="コピー"
                          >
                            {copied === `catch-${i}` ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4 text-gray-400" />}
                          </button>
                          {selectedCatchphrase === c && <ChevronRight className="w-4 h-4 text-purple-500" />}
                        </div>
                      </button>
                    ))}
                  </div>

                  {selectedCatchphrase && (
                    <div className="border-t border-gray-200 pt-5">
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-purple-600" />
                        バナー画像生成
                      </h4>
                      <div className="flex flex-wrap gap-3 mb-4">
                        <select
                          value={selectedBannerSize}
                          onChange={(e) => setSelectedBannerSize(e.target.value)}
                          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                        >
                          {BANNER_SIZES.map((size) => (
                            <option key={size.key} value={size.key}>{size.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={handleGenerateBanner}
                          disabled={bannerLoading}
                          className="px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 flex items-center gap-2"
                        >
                          {bannerLoading ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              生成中...
                            </>
                          ) : (
                            <>
                              <ImageIcon className="w-4 h-4" />
                              バナー生成
                            </>
                          )}
                        </button>
                      </div>

                      {bannerError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-500 text-xs flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{bannerError}</span>
                        </div>
                      )}

                      {bannerImage && (
                        <div className="mt-4">
                          <img src={bannerImage} alt="Generated Banner" className="max-w-full h-auto rounded-lg border border-gray-200" />
                          <button
                            onClick={() => downloadImage(bannerImage, `banner-${selectedBannerSize}.png`)}
                            className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 flex items-center gap-2 text-sm font-bold"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* LP構成案 */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-4">LP構成案</h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-purple-500">
                      <p className="text-xs text-purple-600 font-bold mb-1">ヒーローセクション</p>
                      <p className="text-gray-800 text-sm">{generatedData.creatives.lpStructure?.hero}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-red-500">
                      <p className="text-xs text-red-500 font-bold mb-1">課題提起</p>
                      <p className="text-gray-800 text-sm">{generatedData.creatives.lpStructure?.problem}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
                      <p className="text-xs text-green-600 font-bold mb-1">解決策</p>
                      <p className="text-gray-800 text-sm">{generatedData.creatives.lpStructure?.solution}</p>
                    </div>
                    {generatedData.creatives.lpStructure?.benefits && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-blue-600 font-bold mb-2">ベネフィット</p>
                        <ul className="space-y-1">
                          {generatedData.creatives.lpStructure.benefits.map((b, i) => (
                            <li key={i} className="text-gray-700 text-sm">✓ {b}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {generatedData.creatives.lpStructure?.cta && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500 mb-1">CTA</p>
                        <p className="text-lg font-bold text-gray-900">{generatedData.creatives.lpStructure.cta}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 広告コピー */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-3">Google検索広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.google?.map((ad, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `google-${i}`)}
                            className="mt-2 text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1"
                          >
                            {copied === `google-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Clipboard className="w-3 h-3" />}
                            コピー
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-3">Meta/SNS広告</h3>
                    <div className="space-y-2">
                      {generatedData.creatives.adCopy?.meta?.map((ad, i) => (
                        <div key={i} className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 text-sm">{ad}</p>
                          <button
                            onClick={() => copyToClipboard(ad, `meta-${i}`)}
                            className="mt-2 text-xs text-gray-400 hover:text-purple-600 flex items-center gap-1"
                          >
                            {copied === `meta-${i}` ? <Check className="w-3 h-3 text-green-500" /> : <Clipboard className="w-3 h-3" />}
                            コピー
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
