'use client'

import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { personaBrowserStorage } from '@/lib/persona/browser-storage'
import { savePersonaRecord, savePersonaImage, savedPersonaPath } from '@/lib/persona/history-records'
import { readPersonaImageResponse, validPersonaImageResponse, personaImageError, PersonaImageResponseError } from '@/lib/persona/image-response'
import { includedPersonaImages, personaSceneIntent } from '@/lib/persona/image-entitlements'
import { isPersonaDisplayData, hasValidPersonaImages } from '@/lib/persona/display-data'
import PersonaUsagePanel from '@/components/persona/PersonaUsagePanel'
import PersonaBannerGenerator from '@/components/persona/PersonaBannerGenerator'
import { PersonaCopyFallback, PersonaExportFailure, type PersonaManualCopy } from '@/components/persona/PersonaOutputRecovery'
import { isPaidPlan } from '@/lib/unified-plan'
import { TrialNote } from '@/components/TrialCallout'
import { SUPPORT_CONTACT_URL } from '@/lib/pricing'
import ShellLoading from '@/components/shell/ShellLoading'
import { useOneButton } from '@/components/one-button/context'
import { OneButtonBar } from '@/components/one-button/OneButtonBar'
import { EmptyState, FirstSteps, ToolHero, ToolNextStep, type NextStepView } from '@/components/ds'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Image as ImageIcon,
  Download,
  Clipboard,
  ChevronRight,
  ChevronDown,
  Check,
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
  X,
  AlertCircle,
  RefreshCw,
  Play,
  Camera,
  Music,
  Mic,
  Headphones,
} from 'lucide-react'
import { ShellCostBadge } from '@/components/shell/power'
import { personaUserMessage } from '@/components/persona/user-message'
import { useDoyaPrefill } from '@/components/agent-router/useDoyaPrefill'


// ムード → 色
const MOOD_COLORS: Record<string, string> = {
  '穏やか': 'bg-green-100 text-green-700',
  'リラックス': 'bg-blue-100 text-blue-700',
  '集中': 'bg-orange-100 text-orange-700',
  '幸せ': 'bg-pink-100 text-pink-700',
  '解放感': 'bg-sky-100 text-sky-700',
  '普通': 'bg-gray-100 text-gray-600',
  '活力': 'bg-yellow-100 text-yellow-700',
  '充実': 'bg-brand-50 text-brand-600',
}

// プラットフォームロゴ
// 文字で表せない媒体は lucide のアイコンにする（絵文字を使わない。UX 点検 FIX-PLAN 15）
const PLATFORM_LOGOS: Record<string, { color: string; bg: string; icon: ReactNode }> = {
  'linkedin': { color: '#0A66C2', bg: 'bg-[#0A66C2]', icon: 'in' },
  'twitter': { color: '#000000', bg: 'bg-black', icon: '𝕏' },
  'x': { color: '#000000', bg: 'bg-black', icon: '𝕏' },
  'note': { color: '#41C9B4', bg: 'bg-[#41C9B4]', icon: 'n' },
  'youtube': { color: '#FF0000', bg: 'bg-[#FF0000]', icon: <Play className="h-4 w-4" aria-hidden /> },
  'instagram': { color: '#E4405F', bg: 'bg-gradient-to-br from-[#833AB4] via-[#E4405F] to-[#FCAF45]', icon: <Camera className="h-4 w-4" aria-hidden /> },
  'facebook': { color: '#1877F2', bg: 'bg-[#1877F2]', icon: 'f' },
  'tiktok': { color: '#000000', bg: 'bg-black', icon: <Music className="h-4 w-4" aria-hidden /> },
  'google': { color: '#4285F4', bg: 'bg-[#4285F4]', icon: 'G' },
  'slack': { color: '#4A154B', bg: 'bg-[#4A154B]', icon: '#' },
  'qiita': { color: '#55C500', bg: 'bg-[#55C500]', icon: 'Q' },
  'zenn': { color: '#3EA8FF', bg: 'bg-[#3EA8FF]', icon: 'Z' },
  'hatena': { color: '#00A4DE', bg: 'bg-[#00A4DE]', icon: 'B!' },
  'reddit': { color: '#FF4500', bg: 'bg-[#FF4500]', icon: 'r' },
  'pinterest': { color: '#BD081C', bg: 'bg-[#BD081C]', icon: 'P' },
  'wantedly': { color: '#21BDDB', bg: 'bg-[#21BDDB]', icon: 'W' },
  'newspicks': { color: '#FFC800', bg: 'bg-[#FFC800]', icon: 'NP' },
  'voicy': { color: '#FF6B00', bg: 'bg-[#FF6B00]', icon: <Mic className="h-4 w-4" aria-hidden /> },
  'podcast': { color: '#9933CC', bg: 'bg-[#9933CC]', icon: <Headphones className="h-4 w-4" aria-hidden /> },
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

interface GeneratedData {
  persona: PersonaData
  deepDive?: DeepDiveData
  summary?: SummaryData
  creatives?: any
  marketingChecklist?: any[]
}

// ローディング中のフェーズ・候補アニメーション（コンポーネント外で定義）
const LOADING_PHASES = [
  { label: 'サイトを分析中', icon: 'search', detail: 'HTML構造・メタ情報・コンテンツを解析しています...' },
  { label: 'ターゲット層を推定中', icon: 'target', detail: '業界・サービス特性から理想的な顧客像を推定しています...' },
  { label: 'ペルソナ候補を生成中', icon: 'groups', detail: '複数のペルソナパターンを検討しています...' },
  { label: '課題・ペインポイントを深掘り中', icon: 'bar_chart', detail: 'リアルなエピソードと心理を構築しています...' },
  { label: '行動パターンを分析中', icon: 'psychology', detail: '情報収集行動・購買心理を設計しています...' },
  { label: '導入ストーリーを構築中', icon: 'menu_book', detail: '認知〜導入までのカスタマージャーニーを作成しています...' },
  { label: '最終ペルソナを選定中', icon: 'auto_awesome', detail: '最もリアルなペルソナを選定・仕上げています...' },
]

const FAKE_CANDIDATES = [
  { name: '田中 美咲', age: 32, gender: '女性', occupation: 'マーケティングマネージャー', trait: '効率重視・データドリブン' },
  { name: '鈴木 健太', age: 28, gender: '男性', occupation: 'Webディレクター', trait: '好奇心旺盛・トレンド敏感' },
  { name: '佐藤 由美', age: 41, gender: '女性', occupation: '経営企画部長', trait: '戦略的思考・ROI意識' },
  { name: '山田 翔太', age: 35, gender: '男性', occupation: '事業開発リーダー', trait: '挑戦的・スピード重視' },
  { name: '高橋 あかり', age: 29, gender: '女性', occupation: 'コンテンツプランナー', trait: '共感力・ストーリー志向' },
  { name: '伊藤 大輔', age: 45, gender: '男性', occupation: '取締役COO', trait: '合理的判断・長期視点' },
  { name: '渡辺 さくら', age: 37, gender: '女性', occupation: 'ブランドマネージャー', trait: '感性豊か・ユーザー中心' },
  { name: '中村 拓也', age: 33, gender: '男性', occupation: 'プロダクトマネージャー', trait: '仮説思考・実行力' },
]

class PersonaQuotaError extends Error {}

function personaQuotaAction(data: { upgradeUrl?: unknown; contactUrl?: unknown } | null): 'pricing' | 'contact' | null {
  if (data?.contactUrl === SUPPORT_CONTACT_URL) return 'contact'
  if (data?.upgradeUrl === '/persona/pricing') return 'pricing'
  return null
}

/** API エラーをユーザーフレンドリーなメッセージに変換 */
function toFriendlyError(e: unknown, res?: Response | null): string {
  // ネットワークエラー（fetch 自体が失敗）
  if (e instanceof TypeError && /fetch|network/i.test(e.message)) {
    return '通信が切れました。通信を確かめて、もう一度お試しください。'
  }
  // HTTP ステータスに基づくメッセージ
  if (res) {
    if (res.status === 429) {
      return e instanceof PersonaQuotaError ? personaUserMessage(e, '今日の上限に達しました。明日もう一度お試しください。') : '回数の上限に達しました。少し待って、もう一度お試しください。'
    }
    if (res.status >= 500) {
      return 'うまく作れませんでした。少し待って、もう一度お試しください。'
    }
  }
  // その他 — 日本語の利用者向けの文だけを出す（英語・内部の言葉は決まった文にする。UX 点検 FIX-PLAN 17）
  return personaUserMessage(e, 'ペルソナを作れませんでした。少し待って、もう一度お試しください。')
}

export type PersonaRestoredRecord = {
  id: string
  data: unknown
  sourceUrl?: string | null
  timestamp: number
  portrait?: string
  bannerImage?: string
  sceneImages?: Record<string, string>
}

export default function PersonaTool({ initialRecord }: { initialRecord?: PersonaRestoredRecord } = {}) {
  const { data: session, status } = useSession()
  const userId = session?.user?.id
  if (status === 'loading') return <ShellLoading />
  if (status !== 'authenticated' || !userId) return <p role="status" className="p-6">ペルソナを利用するにはログインしてください。</p>
  return <AccountPersonaTool key={`${userId}:${initialRecord?.id || ''}`} userId={userId} plan={session.user.plan} initialRecord={initialRecord} />
}

function AccountPersonaTool({ userId, plan, initialRecord }: { userId: string; plan?: string | null; initialRecord?: PersonaRestoredRecord }) {
  // 新しい見た目（チェックリスト §5.1）のときだけ、ヒーロー・空状態を出し、見出しの二重と画面いっぱいの高さを外す
  const accountStorage = useMemo(() => personaBrowserStorage(userId), [userId])
  const textRequest = useRef<symbol | null>(null)
  const generationAttempt = useRef<{ input: string; key: string } | null>(null)
  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; textRequest.current = null }
  }, [])

  const [url, setUrl] = useState('')
  const [serviceName, setServiceName] = useState('')
  const [additionalInfo, setAdditionalInfo] = useState('')
  // ドヤAIの「頼む」から来たときは、読み取った値を入れた状態で開く（押すのは本人）
  useDoyaPrefill((read) => { const u = read('url', 'url'), s = read('service'); if (u) setUrl(u); if (s) setServiceName(s) })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const oneButton = useOneButton()
  const [error, setError] = useState('')
  const [errorAction, setErrorAction] = useState<'generate' | 'modify' | null>(null)
  const [quotaNotice, setQuotaNotice] = useState<'text' | 'image' | null>(null)
  const [quotaAction, setQuotaAction] = useState<'pricing' | 'contact' | null>(null)
  const [accessWarning, setAccessWarning] = useState('')
  const [generatedData, updateGeneratedData] = useState<GeneratedData | null>(null)
  const currentPersona = useRef<GeneratedData | null>(null)
  const currentRecordId = useRef<string | null>(null)
  const currentServerRecord = useRef(false)
  const imageAttempts = useRef<Record<string, { projectId: string; intent: string; key: string }>>({})
  // Only a text generation requested in this mounted screen may start automatic images.
  const autoGenerateFor = useRef<GeneratedData | null>(null)
  const imageRequests = useRef<Record<string, symbol>>({})
  const scenePrompts = useRef<Record<string, string>>({})
  const scenePending = useRef<Set<string>>(new Set())
  const setGeneratedData = useCallback((data: GeneratedData | null) => {
    currentPersona.current = data
    currentRecordId.current = null
    currentServerRecord.current = false
    setAccessWarning('')
    setCopied(null)
    setCopyFallback(null)
    setExportError('')
    copyAttempt.current += 1
    setErrorAction(null)
    setQuotaNotice(null)
    imageAttempts.current = {}
    imageRequests.current = {}
    scenePrompts.current = {}
    scenePending.current = new Set()
    setSceneErrors({})
    updateGeneratedData(data)
    setPortraitLoading(false)
    setSceneLoading({})
  }, [])
  useEffect(() => () => { currentPersona.current = null; imageRequests.current = {} }, [])
  const [portraitImage, setPortraitImage] = useState<string | null>(null)
  const [portraitLoading, setPortraitLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFallback, setCopyFallback] = useState<PersonaManualCopy | null>(null)
  const copyAttempt = useRef(0)
  const [portraitError, setPortraitError] = useState('')
  const [modificationInput, setModificationInput] = useState('')
  const [modifying, setModifying] = useState(false)
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({})
  const [sceneErrors, setSceneErrors] = useState<Record<string, string>>({})
  const [sceneLoading, setSceneLoading] = useState<Record<string, boolean>>({})
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [loadingPhase, setLoadingPhase] = useState(0)
  const [candidateIdx, setCandidateIdx] = useState(0)
  const portraitAutoTriggered = useRef(false)
  const sceneAutoTriggered = useRef(false)
  const [imageGenerationRequest, setImageGenerationRequest] = useState(0)
  const [bannerUsageRevision, setBannerUsageRevision] = useState(0)
  const requestMissingImages = () => {
    if (!alive.current || !generatedData || currentPersona.current !== generatedData || textRequest.current || portraitLoading || Object.values(sceneLoading).some(Boolean) || autoGenerateFor.current === generatedData) return
    autoGenerateFor.current = generatedData
    portraitAutoTriggered.current = false
    sceneAutoTriggered.current = false
    setImageGenerationRequest(value => value + 1)
  }
  const resumeRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading) { setLoadingPhase(0); setCandidateIdx(0); return }
    // ローディングUIにスクロール
    setTimeout(() => {
      loadingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    const phaseInterval = setInterval(() => {
      setLoadingPhase(prev => prev < LOADING_PHASES.length - 1 ? prev + 1 : prev)
    }, 4500)
    const candidateInterval = setInterval(() => {
      setCandidateIdx(prev => (prev + 1) % FAKE_CANDIDATES.length)
    }, 2000)
    return () => { clearInterval(phaseInterval); clearInterval(candidateInterval) }
  }, [loading])

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
    if (initialRecord) {
      if (!isPersonaDisplayData(initialRecord.data) || !hasValidPersonaImages(initialRecord)) {
        setError('保存されたペルソナの形式を読み込めませんでした。元の履歴は削除していません。')
        return
      }
      autoGenerateFor.current = null
      setGeneratedData(initialRecord.data as GeneratedData)
      currentRecordId.current = initialRecord.id
      currentServerRecord.current = true
      let restoredUrl = initialRecord.sourceUrl || ''
      if (initialRecord.sourceUrl == null) {
        try {
          const rows = JSON.parse(accountStorage.getItem('doya_persona_history') || '[]')
          const cached = Array.isArray(rows) ? rows.find(row => row?.id === initialRecord.id) : null
          if (typeof cached?.url === 'string') restoredUrl = cached.url
        } catch { /* Server restoration remains usable when browser storage is unavailable. */ }
      }
      setUrl(restoredUrl)
      setPortraitImage(initialRecord.portrait || null)
      setSceneImages(initialRecord.sceneImages || {})
      return
    }
    try {
      const stored = accountStorage.getItem('doya_persona_last')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.serverStored === true) {
          const path = savedPersonaPath(parsed)
          if (path) window.location.replace(path)
          else setError('保存済み履歴の情報が無効です。履歴一覧から開き直してください。')
          return
        }
        if (parsed.data) {
          if (!isPersonaDisplayData(parsed.data) || !hasValidPersonaImages(parsed)) throw new Error('Invalid saved persona')
          autoGenerateFor.current = null
          setGeneratedData(parsed.data)
          currentRecordId.current = typeof parsed.id === 'string' ? parsed.id : null
          if (typeof parsed.url === 'string') setUrl(parsed.url)
          setPortraitImage(parsed.portrait || null)
          if (parsed.sceneImages) setSceneImages(parsed.sceneImages)
        }
      }
    } catch { setError('このブラウザの保存データを読み込めませんでした。') }
  }, [accountStorage, setGeneratedData, initialRecord])

  // A deletion in another tab must invalidate displayed data and late responses here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      // Removing a browser copy does not delete a server-owned project.
      if (currentServerRecord.current) return
      if (event.storageArea !== window.localStorage) return
      const historyChanged = accountStorage.isKey(event.key, 'doya_persona_history')
      const lastChanged = accountStorage.isKey(event.key, 'doya_persona_last')
      if (event.key !== null && !historyChanged && !lastChanged) return
      try {
        const id = currentRecordId.current
        let removed = event.key === null || (historyChanged && event.newValue === null)
        if (!removed && id && historyChanged) {
          const rows = JSON.parse(event.newValue || '[]')
          removed = Array.isArray(rows) && !rows.some(row => row?.id === id)
        }
        if (!removed && lastChanged && event.newValue === null) {
          const old = JSON.parse(event.oldValue || 'null')
          removed = Boolean(old && (id ? old.id === id : currentPersona.current && JSON.stringify(old.data) === JSON.stringify(currentPersona.current)))
        }
        if (!removed) return
        textRequest.current = null
        autoGenerateFor.current = null
        setGeneratedData(null)
        setPortraitImage(null)
        setSceneImages({})
        setUrl('')
        setModificationInput('')
        setLoading(false)
        setModifying(false)
        setError('別のタブで履歴が削除されたため、表示をクリアしました。')
      } catch { /* A malformed event must not erase the displayed unsaved work. */ }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [accountStorage, setGeneratedData, initialRecord])

  useEffect(() => {
    const controller = new AbortController()
    let pending = false
    const verifySavedAccess = async () => {
      const id = currentRecordId.current
      const version = currentPersona.current
      if (pending || document.hidden || !currentServerRecord.current || !id || !version || textRequest.current) return
      pending = true
      const isCurrent = () => !controller.signal.aborted && currentServerRecord.current && currentRecordId.current === id && currentPersona.current === version && !textRequest.current
      try {
        const response = await fetch(`/api/persona/projects/${id}`, {
          method: 'HEAD', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        })
        if (!isCurrent()) return
        if (response.status === 401 || response.status === 404) {
          autoGenerateFor.current = null
          setGeneratedData(null)
          setPortraitImage(null)
          setSceneImages({})
          setUrl('')
          setModificationInput('')
          setError(response.status === 401 ? '再度ログインしてください。' : '保存済み履歴が削除されたため、表示をクリアしました。')
          return
        }
        if (!response.ok) throw new Error('Access unconfirmed')
        setAccessWarning('')
      } catch {
        if (isCurrent()) setAccessWarning('保存済み履歴の状態を確認できませんでした。通信が回復すると再確認します。')
      } finally { pending = false }
    }
    const onSavedStorage = (event: StorageEvent) => {
      if (event.key === null || accountStorage.isKey(event.key, 'doya_persona_history') || accountStorage.isKey(event.key, 'doya_persona_last')) void verifySavedAccess()
    }
    window.addEventListener('focus', verifySavedAccess)
    window.addEventListener('storage', onSavedStorage)
    document.addEventListener('visibilitychange', verifySavedAccess)
    const timer = window.setInterval(verifySavedAccess, 60000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', verifySavedAccess)
      window.removeEventListener('storage', onSavedStorage)
      document.removeEventListener('visibilitychange', verifySavedAccess)
    }
  }, [accountStorage, setGeneratedData])

  // ペルソナ生成後にポートレートを自動生成
  useEffect(() => {
    if (autoGenerateFor.current === generatedData && generatedData?.persona && !portraitImage && !portraitLoading && !portraitAutoTriggered.current) {
      portraitAutoTriggered.current = true
      const timer = setTimeout(() => {
        handleGeneratePortrait()
      }, 500)
      return () => clearTimeout(timer)
    }
    if (!generatedData) {
      portraitAutoTriggered.current = false
    }
  }, [generatedData, portraitImage, portraitLoading, imageGenerationRequest])

  // シーン画像は自動では作らない。利用者が各場面の「画像を作る」を押したときだけ作る（原価を抑えるため）。

  const handleGenerate = async () => {
    if (!alive.current || textRequest.current) return
    if (!url.trim()) {
      setErrorAction(null)
      setError('URLを入力してください')
      return
    }

    const input = JSON.stringify({ url, serviceName, additionalInfo })
    if (generationAttempt.current?.input !== input) generationAttempt.current = { input, key: crypto.randomUUID() }
    const requestKey = generationAttempt.current.key
    const request = Symbol('generate')
    textRequest.current = request
    const isCurrent = () => alive.current && textRequest.current === request
    setLoading(true)
    setErrorAction(null)
    setError('')
    setQuotaNotice(null)
    setPortraitError('')
    setGeneratedData(null)
    setPortraitImage(null)
    setSceneImages({})
    sceneAutoTriggered.current = false
    portraitAutoTriggered.current = false

    let res: Response | null = null
    try {
      res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, serviceName, additionalInfo, requestKey }),
      })

      const raw = await res.text()
      let data: any = null
      try {
        data = raw ? JSON.parse(raw) : null
      } catch {
        data = null
      }

      if (!res.ok) {
        if (isCurrent() && data?.code === 'REQUEST_CONFLICT') generationAttempt.current = null
        if (isCurrent() && data?.code === 'DAILY_LIMIT_REACHED') { setQuotaNotice('text'); setQuotaAction(personaQuotaAction(data)) }
        // サーバーの応答の本文はそのまま出さない（UX 点検 FIX-PLAN 17）
        const msg = personaUserMessage(data && (data.error || data.message), 'ペルソナを作れませんでした。少し待って、もう一度お試しください。')
        throw data?.code === 'DAILY_LIMIT_REACHED' ? new PersonaQuotaError(msg) : new Error(msg)
      }

      if (!isPersonaDisplayData(data?.data)) {
        throw new Error('ペルソナを受け取れませんでした。もう一度お試しください。')
      }

      if (!isCurrent()) return
      generationAttempt.current = null
      autoGenerateFor.current = data.data
      setGeneratedData(data.data)

      try {
        const record = { id: typeof data.projectId === 'string' ? data.projectId : crypto.randomUUID(), serverStored: typeof data.projectId === 'string', data: data.data, url, timestamp: Date.now() }
        currentRecordId.current = record.id
        currentServerRecord.current = record.serverStored
        savePersonaRecord(accountStorage, record)
      } catch { setError(typeof data.projectId === 'string' ? '生成は完了し、結果は保存しましたが、このブラウザには残せませんでした。保存した履歴から開き直せます。' : '生成は完了しましたが、履歴に残せませんでした。閉じる前に結果をダウンロードしてください。') }
    } catch (e) {
      if (isCurrent()) { setError(toFriendlyError(e, res)); setErrorAction(e instanceof PersonaQuotaError ? null : 'generate') }
    } finally {
      if (isCurrent()) { textRequest.current = null; setLoading(false) }
    }
  }

  const handleGeneratePortrait = async () => {
    if (!generatedData?.persona || currentPersona.current !== generatedData) return
    const recordId = currentRecordId.current
    if (!recordId) { setPortraitError('この履歴にはサーバーの保存情報がありません。新しくペルソナを生成してください。'); return }
    const pendingImages = scenePending.current
    if (pendingImages.has('portrait')) return
    pendingImages.add('portrait')
    const intent = portraitImage ? 'regenerate' : 'included'
    if (imageAttempts.current.portrait?.projectId !== recordId || imageAttempts.current.portrait?.intent !== intent) {
      imageAttempts.current.portrait = { projectId: recordId, intent, key: crypto.randomUUID() }
    }
    const attempt = imageAttempts.current.portrait
    const request = Symbol('portrait')
    imageRequests.current.portrait = request
    const isCurrent = () => currentPersona.current === generatedData && imageRequests.current.portrait === request

    setPortraitLoading(true)
    setPortraitError('')
    let res: Response | null = null
    try {
      const reply = await readPersonaImageResponse('/api/persona/portrait', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: recordId, slotKey: 'portrait', intent, requestKey: attempt.key }),
      })

      res = reply.res
      const data = reply.data

      if (!isCurrent()) return
      if (!res.ok || !data) {
        if (data?.code === 'REQUEST_CONFLICT') delete imageAttempts.current.portrait
        if (data?.code === 'DAILY_LIMIT_REACHED') { setQuotaNotice('image'); setQuotaAction(personaQuotaAction(data)) }
        const message = '本日の画像の上限に達しました。利用枠をご確認ください。'
        throw data?.code === 'DAILY_LIMIT_REACHED' ? new PersonaQuotaError(message) : new Error(message)
      }

      if (validPersonaImageResponse(data)) {
        if (intent !== 'included') setQuotaNotice(current => current === 'image' ? null : current)
        delete imageAttempts.current.portrait
        setPortraitImage(data.image)
        try {
          savePersonaImage(accountStorage, recordId, generatedData, { portrait: data.image })
        } catch { setPortraitError('画像は保存しましたが、このブラウザには残せませんでした。保存した履歴から開き直せます。') }
      } else {
        throw new PersonaImageResponseError('画像の保存先を確かめられませんでした。もう一度お試しください。')
      }
    } catch (e) {
      if (isCurrent()) setPortraitError(e instanceof PersonaQuotaError ? e.message : personaImageError(e, res))
    } finally {
      pendingImages.delete('portrait')
      if (isCurrent()) setPortraitLoading(false)
    }
  }

  const handleGenerateScene = useCallback(async (scenePrompt: string, sceneKey: string) => {
    if (!generatedData?.persona || currentPersona.current !== generatedData) return
    const recordId = currentRecordId.current
    if (!recordId) { setSceneErrors(prev => ({ ...prev, [sceneKey]: 'この履歴にはサーバーの保存情報がありません。新しくペルソナを生成してください。' })); return }
    const intent = personaSceneIntent(generatedData, sceneKey, Boolean(sceneImages[sceneKey]), isPaidPlan(plan))
    if (imageAttempts.current[sceneKey]?.projectId !== recordId || imageAttempts.current[sceneKey]?.intent !== intent) {
      imageAttempts.current[sceneKey] = { projectId: recordId, intent, key: crypto.randomUUID() }
    }
    const attempt = imageAttempts.current[sceneKey]
    const requestKey = `scene:${sceneKey}`
    const pendingImages = scenePending.current
    if (pendingImages.has(requestKey)) return
    pendingImages.add(requestKey)
    scenePrompts.current[sceneKey] = scenePrompt
    setSceneErrors(prev => ({ ...prev, [sceneKey]: '' }))
    const request = Symbol(requestKey)
    imageRequests.current[requestKey] = request
    const isCurrent = () => currentPersona.current === generatedData && imageRequests.current[requestKey] === request
    setSceneLoading(prev => ({ ...prev, [sceneKey]: true }))
    let res: Response | null = null
    try {
      const reply = await readPersonaImageResponse('/api/persona/scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: recordId, slotKey: sceneKey, intent, requestKey: attempt.key }),
      })

      res = reply.res
      const data = reply.data

      if (!isCurrent()) return
      if (!res.ok) {
        if (data?.code === 'REQUEST_CONFLICT') delete imageAttempts.current[sceneKey]
        if (data?.code === 'DAILY_LIMIT_REACHED') { setQuotaNotice('image'); setQuotaAction(personaQuotaAction(data)) }
        // サーバーの文面はそのまま出さない。コードごとに決まった文面を出す。
        const message = data?.code === 'NOT_INCLUDED' ? 'この画像は無料プランの付属枠に含まれません。追加枠で作れます。'
          : '本日の画像の上限に達しました。利用枠をご確認ください。'
        throw data?.code === 'DAILY_LIMIT_REACHED' || data?.code === 'NOT_INCLUDED' ? new PersonaQuotaError(message) : new Error(message)
      }
      if (!validPersonaImageResponse(data)) throw new PersonaImageResponseError('画像の保存先を確かめられませんでした。もう一度お試しください。')
      if (data.image) {
        if (intent !== 'included') setQuotaNotice(current => current === 'image' ? null : current)
        delete imageAttempts.current[sceneKey]
        setSceneImages(prev => isCurrent() ? { ...prev, [sceneKey]: data.image } : prev)
        try {
          savePersonaImage(accountStorage, recordId, generatedData, { sceneImages: { [sceneKey]: data.image } })
        } catch { setError('画像は保存しましたが、このブラウザには残せませんでした。保存した履歴から開き直せます。') }
      }
    } catch (e) {
      if (isCurrent()) setSceneErrors(prev => isCurrent() ? { ...prev, [sceneKey]: (e instanceof PersonaQuotaError ? e.message : personaImageError(e, res)) } : prev)
    } finally {
      pendingImages.delete(requestKey)
      if (isCurrent()) {
        setSceneLoading(prev => isCurrent() ? { ...prev, [sceneKey]: false } : prev)
      }
    }
  }, [generatedData, accountStorage, sceneImages, plan])

  // ペルソナ変更
  const handleModify = async () => {
    if (!alive.current || textRequest.current || !generatedData || currentPersona.current !== generatedData || !modificationInput.trim() || modifying) return
    const input = JSON.stringify({ existingPersona: generatedData, modifications: modificationInput })
    if (generationAttempt.current?.input !== input) generationAttempt.current = { input, key: crypto.randomUUID() }
    const requestKey = generationAttempt.current.key
    const request = Symbol('modify')
    textRequest.current = request
    const isCurrent = () => alive.current && textRequest.current === request

    setModifying(true)
    setErrorAction(null)
    setError('')
    setQuotaNotice(null)
    setPortraitError('')

    let res: Response | null = null
    try {
      res = await fetch('/api/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          existingPersona: generatedData,
          modifications: modificationInput,
          requestKey,
        }),
      })

      const raw = await res.text()
      let data: any = null
      try { data = raw ? JSON.parse(raw) : null } catch { data = null }

      if (!res.ok) {
        if (isCurrent() && data?.code === 'REQUEST_CONFLICT') generationAttempt.current = null
        if (isCurrent() && data?.code === 'DAILY_LIMIT_REACHED') { setQuotaNotice('text'); setQuotaAction(personaQuotaAction(data)) }
        const msg = personaUserMessage(data && (data.error || data.message), 'ペルソナを変えられませんでした。少し待って、もう一度お試しください。')
        throw data?.code === 'DAILY_LIMIT_REACHED' ? new PersonaQuotaError(msg) : new Error(msg)
      }

      if (!isPersonaDisplayData(data?.data)) {
        throw new Error('変えたペルソナを受け取れませんでした。もう一度お試しください。')
      }

      if (!isCurrent() || currentPersona.current !== generatedData) return
      generationAttempt.current = null
      // 画像リセット・再生成
      setPortraitImage(null)
      setSceneImages({})
      portraitAutoTriggered.current = false
      sceneAutoTriggered.current = false

      autoGenerateFor.current = data.data
      setGeneratedData(data.data)
      setModificationInput('')

      try {
        const record = { id: typeof data.projectId === 'string' ? data.projectId : crypto.randomUUID(), serverStored: typeof data.projectId === 'string', data: data.data, url, timestamp: Date.now() }
        currentRecordId.current = record.id
        currentServerRecord.current = record.serverStored
        savePersonaRecord(accountStorage, record)
      } catch { setError(typeof data.projectId === 'string' ? '変更は完了し、結果は保存しましたが、このブラウザには残せませんでした。保存した履歴から開き直せます。' : '変更は完了しましたが、履歴に残せませんでした。閉じる前に結果をダウンロードしてください。') }
    } catch (e) {
      if (isCurrent()) { setError(toFriendlyError(e, res)); setErrorAction(e instanceof PersonaQuotaError ? null : 'modify') }
    } finally {
      if (isCurrent()) { textRequest.current = null; setModifying(false) }
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    const target = currentPersona.current
    const attempt = ++copyAttempt.current
    const isCurrent = () => alive.current && currentPersona.current === target && copyAttempt.current === attempt
    setCopied(null)
    try {
      await navigator.clipboard.writeText(text)
      if (!isCurrent()) return
      setCopyFallback(null)
      setCopied(id)
      setTimeout(() => { if (isCurrent()) setCopied(null) }, 2000)
    } catch {
      if (isCurrent()) setCopyFallback({ id, text })
    }
  }

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.click()
  }

  // PDF / PNG エクスポート
  const handleExport = async (format: 'pdf' | 'png') => {
    if (!resumeRef.current || exporting) return
    const el = resumeRef.current
    const target = currentPersona.current
    setExporting(true)
    setExportError('')

    try {
      const html2canvas = (await import('html2canvas')).default

      // エクスポート中はUI要素を非表示
      el.classList.add('exporting')

      // 少し待ってDOMを更新
      await new Promise(r => setTimeout(r, 100))

      // キャプチャ
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 896,
      })

      // エクスポートクラスを除去
      el.classList.remove('exporting')
      if (!alive.current || currentPersona.current !== target) return

      if (format === 'png') {
        const dataUrl = canvas.toDataURL('image/png')
        downloadImage(dataUrl, `persona-${persona?.name || 'export'}.png`)
      } else {
        const { jsPDF } = await import('jspdf')
        if (!alive.current || currentPersona.current !== target) return

        const pdfWidthMm = 210  // A4 mm
        const pdfHeightMm = 297 // A4 mm

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

        // キャンバスをページ単位でスライスして貼り付け
        const canvasW = canvas.width
        const canvasH = canvas.height
        const scale = pdfWidthMm / canvasW // mm per pixel
        const pageHeightPx = Math.floor(pdfHeightMm / scale) // 1ページ分のピクセル高さ
        const totalPages = Math.ceil(canvasH / pageHeightPx)

        for (let p = 0; p < totalPages; p++) {
          if (p > 0) pdf.addPage()

          const srcY = p * pageHeightPx
          const sliceH = Math.min(pageHeightPx, canvasH - srcY)

          // スライス用キャンバス
          const sliceCanvas = document.createElement('canvas')
          sliceCanvas.width = canvasW
          sliceCanvas.height = sliceH
          const ctx = sliceCanvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvasW, sliceH)
            ctx.drawImage(canvas, 0, srcY, canvasW, sliceH, 0, 0, canvasW, sliceH)
          }

          const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)
          const sliceHeightMm = sliceH * scale

          pdf.addImage(sliceData, 'JPEG', 0, 0, pdfWidthMm, sliceHeightMm)
        }

        pdf.save(`persona-${persona?.name || 'export'}.pdf`)
      }
    } catch (e) {
      console.error('Export error:')
      if (alive.current && currentPersona.current === target) {
        const label = format === 'png' ? 'PNG' : 'PDF'
        setExportError(`${label}を書き出せませんでした。もう一度「${label}書き出し」を押してください。`)
      }
    } finally {
      // 念のためクラスも除去
      el.classList.remove('exporting')
      if (alive.current) setExporting(false)
    }
  }

  // シーン画像プレースホルダー
  const SceneImageSlot = ({ sceneKey, className = '' }: { sceneKey: string; className?: string }) => {
    const img = sceneImages[sceneKey]
    const isLoading = sceneLoading[sceneKey]
    let scenePrompt = scenePrompts.current[sceneKey] || null
    if (!scenePrompt && img && generatedData) {
      try { scenePrompt = includedPersonaImages(generatedData).find(slot => slot.kind === 'scene' && slot.key === sceneKey)?.prompt || null }
      catch { /* Older saved data can show an image without a regenerable prompt. */ }
    }

    if (img) {
      return (
        <div className={`relative rounded-lg overflow-hidden shadow-md ${className}`}>
          <img src={img} alt="" className="w-full h-full object-cover object-center" />
          {sceneErrors[sceneKey] && (
            <p role="alert" className="absolute inset-x-2 top-2 max-h-[50%] overflow-y-auto rounded bg-red-50 p-2 text-xs text-red-700 shadow export-hide">
              {sceneErrors[sceneKey]}
            </p>
          )}
          {scenePrompt && (
            <button type="button" onClick={() => void handleGenerateScene(scenePrompt, sceneKey)} disabled={isLoading}
              className="absolute bottom-2 right-2 rounded bg-white/95 px-2 py-1 text-xs font-bold text-brand-700 shadow disabled:opacity-60 export-hide">
              {isLoading ? '再生成中...' : '再生成（追加枠1枚）'}
            </button>
          )}
        </div>
      )
    }
    if (isLoading) {
      return (
        <div className={`rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 border border-brand-50 flex items-center justify-center export-hide ${className}`}>
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-2" />
            <p className="text-brand-300 text-xs">画像生成中...</p>
          </div>
        </div>
      )
    }
    if (sceneErrors[sceneKey]) {
      return (
        <div className={`rounded-lg border border-red-200 bg-red-50 p-3 flex flex-col items-center justify-center gap-2 export-hide ${className}`}>
          <p role="alert" className="text-xs text-red-700">{sceneErrors[sceneKey]}</p>
          {quotaNotice !== 'image' && <button type="button" className="rounded bg-white px-3 py-2 text-sm text-brand-600 border border-brand-100" onClick={() => {
            const prompt = scenePrompts.current[sceneKey]
            if (prompt) void handleGenerateScene(prompt, sceneKey)
          }}>この画像をもう一度作る</button>}
        </div>
      )
    }
    // まだ画像が無い場面は、押したときだけ作る。付属枠の外は追加枠を1枚使う。
    let slotPrompt: string | null = null
    try { slotPrompt = generatedData ? includedPersonaImages(generatedData).find(slot => slot.kind === 'scene' && slot.key === sceneKey)?.prompt || null : null }
    catch { slotPrompt = null }
    if (!slotPrompt) return null
    const extra = personaSceneIntent(generatedData, sceneKey, false, isPaidPlan(plan)) === 'extra'
    return (
      <div className={`rounded-lg border border-dashed border-brand-100 bg-brand-50/60 p-3 flex flex-col items-center justify-center gap-2 export-hide ${className}`}>
        <p className="text-xs text-gray-600">この場面の画像はまだありません。</p>
        <button type="button" onClick={() => void handleGenerateScene(slotPrompt!, sceneKey)}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white hover:bg-brand-600">
          {extra ? '画像を作る（追加枠1枚）' : '画像を作る'}
        </button>
      </div>
    )
  }

  const persona = generatedData?.persona

  // 次にやること帯（新しい見た目だけ。ds/next-step）。作成中 → 上限 → エラー → できた → まだ の順に決める
  const scrollTo = (el: HTMLElement | null) => el?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  const nextStep: NextStepView = (() => {
    if (loading) return { key: 'working', state: 'working' }
    if (quotaNotice && quotaAction) return { key: 'limit', state: 'error', href: quotaAction === 'contact' ? SUPPORT_CONTACT_URL : '/persona/pricing', actionLabel: quotaAction === 'contact' ? '問い合わせる' : undefined }
    if (error && errorAction && quotaNotice !== 'text') return { key: 'error', state: 'error', onClick: () => void (errorAction === 'modify' ? handleModify() : handleGenerate()), disabled: modifying }
    if (generatedData && persona) return { key: 'done', state: 'done', onClick: () => scrollTo(resumeRef.current) }
    return { key: 'empty', state: 'empty', onClick: () => document.getElementById('persona-url')?.focus() }
  })()

  return (
    <div className="">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {oneButton ? (
          <div className="mb-6">
            <OneButtonBar
              eyebrow="ドヤペルソナAI"
              cta={loading ? 'ペルソナを作っています。このまま待ってね' : 'サイトの URL を入れたら、押してね'}
              label="ペルソナを生成"
              scope="入れた URL のサイトを読み、人物像と似顔絵を1分ほどで作ります。"
              onRun={handleGenerate}
              disabled={loading || !url.trim()}
              disabledReason="サイトの URL を入れると押せます。"
              running={loading}
            />
          </div>
        ) : null}
        <PersonaUsagePanel refreshKey={`${loading}-${modifying}-${portraitLoading}-${Object.keys(sceneImages).length}-${Object.values(sceneLoading).filter(Boolean).length}-${bannerUsageRevision}`} />
        {quotaNotice && (
          <div role="alert" className="mb-6 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            <p className="font-bold">{quotaNotice === 'text' ? '本日のペルソナ生成・文章変更の枠に達しました。' : '本日の追加画像・再生成の枠に達しました。'}</p>
            <p className="mt-1">枠は毎日0時（日本時間）にリセットされます。{quotaAction === 'pricing' ? '追加で使う場合はプランをご確認ください。' : quotaAction === 'contact' ? '追加の利用枠をご希望の場合はご相談ください。' : ''}</p>
            {quotaAction && <a href={quotaAction === 'contact' ? SUPPORT_CONTACT_URL : '/persona/pricing'} className="mt-2 inline-block font-bold text-brand-600 underline underline-offset-2">{quotaAction === 'contact' ? '追加の利用枠を相談する' : 'プランと利用枠を確認する'}</a>}
            {quotaAction === 'pricing' && <TrialNote className="mt-2" />}
          </div>
        )}
        {/* Header */}
        <div className="mb-6 space-y-4">
            {/* 見出しは枠（ToolFrame）の h1 が出す。ここはツール名ではなく「何ができるか」を書く（同じ見出しの二重をやめる。F-9） */}
            <ToolHero
              title={<>サイトのURLから、<wbr />お客さまの人物像を描きます</>}
              lead={<>URLを入れるだけで、年齢・仕事・悩み・<wbr />1日の過ごし方まで、具体的なペルソナにまとめます。<wbr />似顔絵と履歴書の形で、チームに共有できます。</>}
              tool="persona"
            />
            <FirstSteps
              id="persona"
              steps={[
                { title: 'サイトのURLを入れる', body: '自社の商品やサービスのページのURLです。' },
                { title: '必要なら詳しい情報を足す', body: '「詳細設定」から、サービス名やターゲットの補足を入れられます。' },
                { title: '「ペルソナを生成」を押す', body: '1分ほどで、人物像と似顔絵ができます。' },
              ]}
            />
            <ToolNextStep tool="persona" view={nextStep} />
            <div className="flex justify-end">
              <a
                href={`/api/stripe/portal?returnTo=${encodeURIComponent('/persona')}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
              >
                <Shield className="w-3.5 h-3.5" />
                プラン管理・解約
              </a>
            </div>
          </div>

        {/* Input Section */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-800 mb-2">
              サイトURL <span className="text-brand-500">*</span>
            </label>
            <input
              id="persona-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400 text-base"
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
                      maxLength={200}
                      placeholder="例: ドヤマーケ"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">追加情報（任意）</label>
                    <textarea
                      value={additionalInfo}
                      onChange={(e) => setAdditionalInfo(e.target.value)}
                      maxLength={8000}
                      placeholder="ターゲット層や商品の特徴など、補足情報があれば入力してください"
                      rows={3}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:border-brand-400 resize-none"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleGenerate}
            disabled={loading || !url.trim()}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-bold text-base hover:from-brand-400 hover:to-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-400/25"
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
            <ShellCostBadge action="persona.generate" />
          </button>

          {accessWarning && <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{accessWarning}</p>}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {errorAction && quotaNotice !== 'text' && (
                  <button
                    onClick={errorAction === 'modify' ? handleModify : handleGenerate}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {errorAction === 'modify' ? 'もう一度変える' : 'もう一度作る'}
                  </button>
                )}
              </div>
              <button
                onClick={() => setError('')}
                className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                aria-label="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ===== Loading Animation ===== */}
        {loading && (
          <motion.div
            ref={loadingRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* フェーズ表示 */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-50 flex items-center justify-center text-brand-500">
                  <span className="material-symbols-outlined text-xl">{LOADING_PHASES[loadingPhase].icon}</span>
                </div>
                <div className="flex-1">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={loadingPhase}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-sm font-bold text-gray-900"
                    >
                      {LOADING_PHASES[loadingPhase].label}
                    </motion.p>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={`d-${loadingPhase}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-xs text-gray-500 mt-0.5"
                    >
                      {LOADING_PHASES[loadingPhase].detail}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>

              {/* プログレスバー */}
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${Math.min(((loadingPhase + 1) / LOADING_PHASES.length) * 100, 95)}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                />
              </div>

              {/* フェーズステップ */}
              <div className="flex justify-between mt-3">
                {LOADING_PHASES.map((phase, i) => (
                  <div key={i} className="flex flex-col items-center" style={{ width: `${100 / LOADING_PHASES.length}%` }}>
                    <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                      i < loadingPhase ? 'bg-brand-400' : i === loadingPhase ? 'bg-brand-400 ring-2 ring-brand-100' : 'bg-gray-200'
                    }`} />
                  </div>
                ))}
              </div>
            </div>

            {/* ペルソナ候補カード */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-brand-200 border-t-brand-500 rounded-full animate-spin inline-block" />
                ペルソナ候補を検証中...
              </p>

              <div className="space-y-2">
                {[0, 1, 2].map((offset) => {
                  const idx = (candidateIdx + offset) % FAKE_CANDIDATES.length
                  const candidate = FAKE_CANDIDATES[idx]
                  const isActive = offset === 0

                  return (
                    <motion.div
                      key={`${candidateIdx}-${offset}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: isActive ? 1 : 0.4, x: 0 }}
                      transition={{ delay: offset * 0.1, duration: 0.4 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                        isActive
                          ? 'border-brand-200 bg-brand-50/50 shadow-sm'
                          : 'border-gray-100 bg-gray-50/50'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        isActive ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {candidate.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                            {candidate.name}
                          </span>
                          <span className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-300'}`}>
                            {candidate.age}歳・{candidate.gender}
                          </span>
                        </div>
                        <p className={`text-xs mt-0.5 ${isActive ? 'text-gray-600' : 'text-gray-300'}`}>
                          {candidate.occupation} ─ {candidate.trait}
                        </p>
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="px-2 py-0.5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex-shrink-0"
                        >
                          検証中
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== 空の状態 ===== */}
        {!initialRecord && !loading && !generatedData && (
          <EmptyState
            title="まだペルソナがありません"
            description={<>上の欄にサイトのURLを入れて、<wbr />「ペルソナを生成」を押してください。<wbr />作ったペルソナは「生成履歴」にたまります。</>}
            art="/persona/empty-personas.webp"
          />
        )}

        {/* ===== Results ===== */}
        {generatedData && persona && (
          <div className="space-y-6">
            <PersonaBannerGenerator
              key={currentRecordId.current || 'unsaved'}
              projectId={currentServerRecord.current ? currentRecordId.current : null}
              isPaid={isPaidPlan(plan)}
              catchphrases={generatedData.summary?.catchphrases || []}
              initialImage={initialRecord?.id === currentRecordId.current ? initialRecord.bannerImage : undefined}
              onUsageChanged={() => setBannerUsageRevision(value => value + 1)}
            />
            {autoGenerateFor.current !== generatedData && !portraitImage && (
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4 export-hide">
                <p className="text-sm text-gray-700">履歴の閲覧では画像を自動で作りません。似顔絵が無い場合は、ボタンを押すと作ります。場面の画像は、各場面の「画像を作る」から作れます。</p>
                <button type="button" onClick={requestMissingImages} disabled={loading || modifying || portraitLoading || Object.values(sceneLoading).some(Boolean)} className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">似顔絵を作る</button>
              </div>
            )}
            {/* ペルソナ変更入力エリア */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-500" />
                ペルソナを変更する
              </h3>
              <div className="flex gap-2">
                <textarea
                  value={modificationInput}
                  onChange={(e) => setModificationInput(e.target.value)}
                  maxLength={8000}
                  placeholder="例: 年齢を45歳にして / BtoB向けに変更して / 女性のペルソナにして / もっと具体的なエピソードを追加して"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400/50 resize-none bg-gray-50"
                  rows={2}
                  disabled={modifying}
                />
                <button
                  onClick={handleModify}
                  disabled={modifying || !modificationInput.trim()}
                  className="px-5 py-2 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap self-end"
                >
                  {modifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      変更中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      変更を適用
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ========================================== */}
            {/* ペルソナ履歴書                              */}
            {/* ========================================== */}
            {persona && (
              <div className="space-y-0">
                {/* エクスポートボタン */}
                <div className="max-w-4xl mx-auto mb-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleExport('png')}
                      disabled={exporting}
                      className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      <ImageIcon className="w-4 h-4" />
                      {exporting ? '書き出し中...' : 'PNG書き出し'}
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      disabled={exporting}
                      className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-bold hover:bg-brand-400 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      <Download className="w-4 h-4" />
                      {exporting ? '書き出し中...' : 'PDF書き出し'}
                    </button>
                  </div>
                  {exportError ? <PersonaExportFailure message={exportError} /> : null}
                </div>

                <div ref={resumeRef}>
                {/* ======= 履歴書本体 ======= */}
                <div
                  className="bg-white rounded-t-lg shadow-2xl overflow-hidden max-w-4xl mx-auto text-gray-900"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                >
                  {/* タイトル + 日付 */}
                  <div className="px-8 pt-6 pb-4 flex items-end justify-between">
                    <h2 className="text-2xl font-bold tracking-widest">ペルソナ履歴書</h2>
                    <p className="text-xs text-gray-500">
                      {new Date().getFullYear()}年{new Date().getMonth() + 1}月{new Date().getDate()}日 現在
                    </p>
                  </div>

                  {/* 名前 + 基本情報 + 写真 */}
                  <div className="mx-8 border border-gray-400">
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
                            <div
                              className="w-full h-full"
                              style={{
                                backgroundImage: `url(${portraitImage})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }}
                              role="img"
                              aria-label="Persona"
                            />
                          ) : portraitLoading ? (
                            <div className="text-center export-hide">
                              <div className="w-5 h-5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin mx-auto mb-1" />
                              <p className="text-gray-400 text-[10px]">生成中</p>
                            </div>
                          ) : (
                            <div className="text-center text-gray-300 text-xs leading-relaxed">
                              <p className="material-symbols-outlined text-3xl mb-1">person</p>
                              <p>写真</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap justify-center gap-1 export-hide">
                          {portraitImage ? (
                            <>
                              <button
                                onClick={() => downloadImage(portraitImage, `persona-${persona.name}.png`)}
                                className="px-2 py-1 rounded bg-brand-500 text-white text-[10px] font-bold hover:bg-brand-400 inline-flex items-center gap-1"
                              >
                                <Download className="w-2.5 h-2.5" />
                                保存
                              </button>
                              <button type="button" onClick={handleGeneratePortrait} disabled={portraitLoading}
                                aria-label="ポートレートを再生成します。追加画像枠を1枚使用します"
                                className="rounded border border-brand-200 px-2 py-1 text-[10px] font-bold text-brand-600 disabled:opacity-60">
                                {portraitLoading ? '再生成中...' : '再生成（1枚）'}
                              </button>
                            </>
                          ) : !portraitLoading ? (
                            <button
                              onClick={handleGeneratePortrait}
                              disabled={portraitLoading}
                              className="px-2 py-1 rounded bg-brand-500 text-white text-[10px] font-bold hover:bg-brand-400 disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <ImageIcon className="w-2.5 h-2.5" />
                              写真を生成
                            </button>
                          ) : null}
                        </div>
                        {portraitError && (
                          <div className="mt-1 flex items-center justify-center gap-1">
                            <p className="text-red-500 text-[10px] text-center">{portraitError}</p>
                            <button
                              onClick={() => setPortraitError('')}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              aria-label="閉じる"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 基本属性テーブル */}
                  <div className="mx-8 mt-6 border border-gray-400">
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
                    <div className="mx-8 mt-6 border border-gray-400">
                      <div className="flex">
                        <div className="bg-gray-100 border-r border-gray-300 px-3 py-2 font-bold text-xs w-[100px] flex items-center justify-center whitespace-nowrap">座右の銘</div>
                        <div className="px-3 py-2 text-sm italic flex-1">&ldquo;{persona.quote}&rdquo;</div>
                      </div>
                    </div>
                  )}

                  {/* 課題・目標 */}
                  <div className="mx-8 mt-6 grid grid-cols-2 gap-0 border border-gray-400">
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
                    <div className="mx-8 mt-6 grid grid-cols-2 gap-0 border border-gray-400">
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
                  <div className="mx-8 mt-6 border border-gray-400">
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
                                <span key={i} className="px-2 py-0.5 bg-brand-50 text-brand-600 border border-brand-100 rounded text-xs">{t}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="h-8" />
                </div>

                {/* ======= 一日のスケジュール ======= */}
                {persona.schedule && persona.schedule.length > 0 && (
                  <div
                    className="bg-gradient-to-b from-white to-amber-50/50 max-w-4xl mx-auto shadow-2xl overflow-hidden text-gray-900"
                    style={{ fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif' }}
                  >
                    <div className="bg-gradient-to-r from-amber-600 to-orange-500 px-8 py-4 flex items-center gap-3">
                      <Clock className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">一日のスケジュール</h3>
                    </div>

                    <div className="px-8 py-8">
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
                    <div className="bg-gradient-to-r from-emerald-700 to-teal-600 px-8 py-4 flex items-center gap-3">
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
                    <div className="bg-gradient-to-r from-red-600 to-rose-500 px-8 py-4 flex items-center gap-3">
                      <Zap className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">課題・ペインポイント</h3>
                    </div>
                    <div className="px-8 py-6 space-y-5">
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
                    <div className="bg-gradient-to-r from-orange-600 to-amber-500 px-8 py-4 flex items-center gap-3">
                      <Search className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">サービスを知る前の代替手段と不満</h3>
                    </div>
                    <div className="px-8 py-6">
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
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-500 px-8 py-4 flex items-center gap-3">
                      <Lightbulb className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">行動・心理分析</h3>
                    </div>
                    <div className="px-8 py-6 space-y-5">
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
                          <h4 className="text-sm font-bold text-brand-600 mb-2 flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            響くメッセージ・訴求ポイント
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {persona.resonatingMessages.map((rm, i) => (
                              <div key={i} className="flex items-start gap-2 px-3 py-2 bg-brand-50 rounded-lg border border-brand-50">
                                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-300" aria-hidden />
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
                    <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-8 py-4 flex items-center gap-3">
                      <Shield className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">深掘りインタビュー</h3>
                    </div>
                    <div className="px-8 py-6 space-y-6">
                      {generatedData.deepDive.objectionAnalysis.map((oa, i) => (
                        <div key={i} className="space-y-3">
                          {/* Q: インタビュアー */}
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">Q</div>
                            <div className="flex-1 bg-brand-50 rounded-2xl rounded-tl-sm px-4 py-3 border border-brand-50">
                              <p className="text-xs text-brand-400 font-bold mb-1">質問 {i + 1}</p>
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
                                <div
                                  className="w-full h-full"
                                  style={{
                                    backgroundImage: `url(${portraitImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                  }}
                                />
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
                    <div className="bg-gradient-to-r from-teal-600 to-cyan-500 px-8 py-4 flex items-center gap-3">
                      <Route className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">導入ストーリー ─ {persona.name}の場合</h3>
                    </div>

                    {/* ストーリー概要（履歴書風テーブル） */}
                    <div className="px-8 pt-5">
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
                      <div className="px-8 py-6">
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
                            const storyColors = ['bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-brand-400', 'bg-brand-400']
                            const bgColors = ['bg-teal-50', 'bg-cyan-50', 'bg-blue-50', 'bg-indigo-50', 'bg-brand-50', 'bg-brand-50']
                            const borderColors = ['border-teal-200', 'border-cyan-200', 'border-blue-200', 'border-indigo-200', 'border-brand-100', 'border-brand-100']

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
                    <div className="bg-gradient-to-r from-sky-600 to-blue-500 px-8 py-4 flex items-center gap-3">
                      <Briefcase className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">利用シーン ─ サービスを使うある1日</h3>
                    </div>
                    <div className="px-8 py-6">
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
                    <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-8 py-4 flex items-center gap-3">
                      <Award className="w-5 h-5 text-white" />
                      <h3 className="text-white font-bold text-base tracking-wider">ペルソナシート ─ 最終まとめ</h3>
                    </div>
                    <div className="px-8 py-6 space-y-6">
                      {/* ヒーロー画像 + 1行サマリー */}
                      <div className="relative rounded-xl overflow-hidden">
                        <SceneImageSlot sceneKey="summary-hero" className="w-full h-48 sm:h-56" />
                        {generatedData.summary.oneLiner && (
                          <div className="mt-3 bg-gradient-to-r from-brand-50 to-brand-100 rounded-lg border border-brand-100 p-4 text-center">
                            <p className="text-xs text-brand-400 font-bold mb-1">ペルソナ概要</p>
                            <p className="text-base font-bold text-gray-900">{generatedData.summary.oneLiner}</p>
                          </div>
                        )}
                      </div>

                      {/* 基本情報（表形式） */}
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-brand-400" />
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
                                  i === 0 ? 'bg-blue-50' : i === 1 ? 'bg-green-50' : i === 2 ? 'bg-yellow-50' : 'bg-brand-50'
                                }`}>
                                  <p className={`text-xs font-bold mb-1 ${
                                    i === 0 ? 'text-blue-700' : i === 1 ? 'text-green-700' : i === 2 ? 'text-yellow-700' : 'text-brand-600'
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
                              <div key={i}>
                                <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-brand-50 to-brand-100 rounded-lg border border-brand-50">
                                  <span className="text-brand-400 font-bold text-xs">{i + 1}.</span>
                                  <span className="text-sm font-medium text-gray-800 flex-1">{cp}</span>
                                  <button
                                    onClick={() => copyToClipboard(cp, `summary-cp-${i}`)}
                                    className="p-1 hover:bg-brand-50 rounded text-gray-400 hover:text-brand-500 transition-colors export-hide"
                                    title="コピー"
                                    aria-label={copied === `summary-cp-${i}` ? 'コピーしました' : 'キャッチコピーをコピー'}
                                  >
                                    {copied === `summary-cp-${i}` ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                                {copyFallback?.id === `summary-cp-${i}` ? <PersonaCopyFallback value={copyFallback} /> : null}
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
                </div>{/* /resumeRef */}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
