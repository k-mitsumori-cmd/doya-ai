'use client'

import { useMemo, useRef, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Sparkles, Loader2, ArrowRight, Wand2, LogIn, 
  Download, Clock, Zap, Layout, X, Image as ImageIcon, 
  User, Building2, Video, Mail, Gift, Megaphone, Target,
  ChevronDown, Check, Star, Eye, Copy, 
  Play, Crown, ArrowUpRight, Palette,
  MessageSquare, Send, RotateCcw, Pencil
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getGuestUsage, getUserUsage, incrementUserUsage, setGuestUsage } from '@/lib/pricing'
// AIバナーコーチ機能は廃止

// ========================================
// 定数
// ========================================
const CATEGORIES = [
  { value: 'telecom', label: '通信', icon: '📱', color: '#3B82F6', bg: 'from-blue-500/20 to-cyan-500/20' },
  { value: 'marketing', label: 'マーケ', icon: '📊', color: '#8B5CF6', bg: 'from-violet-500/20 to-purple-500/20' },
  { value: 'ec', label: 'EC', icon: '🛒', color: '#F97316', bg: 'from-orange-500/20 to-amber-500/20' },
  { value: 'recruit', label: '採用', icon: '👥', color: '#22C55E', bg: 'from-green-500/20 to-emerald-500/20' },
  { value: 'beauty', label: '美容', icon: '💄', color: '#EC4899', bg: 'from-pink-500/20 to-rose-500/20' },
  { value: 'food', label: '飲食', icon: '🍽️', color: '#EF4444', bg: 'from-red-500/20 to-orange-500/20' },
  { value: 'realestate', label: '不動産', icon: '🏠', color: '#14B8A6', bg: 'from-teal-500/20 to-cyan-500/20' },
  { value: 'education', label: '教育', icon: '📚', color: '#6366F1', bg: 'from-indigo-500/20 to-blue-500/20' },
  { value: 'finance', label: '金融', icon: '💰', color: '#EAB308', bg: 'from-yellow-500/20 to-amber-500/20' },
  { value: 'health', label: '医療', icon: '🏥', color: '#06B6D4', bg: 'from-cyan-500/20 to-teal-500/20' },
  { value: 'it', label: 'IT', icon: '💻', color: '#A855F7', bg: 'from-purple-500/20 to-violet-500/20' },
  { value: 'other', label: 'その他', icon: '✨', color: '#64748B', bg: 'from-slate-500/20 to-gray-500/20' },
]

const PURPOSES = [
  { value: 'sns_ad', label: 'SNS広告', icon: Target, desc: 'FB/IG/X', hot: true },
  { value: 'youtube', label: 'YouTube', icon: Play, desc: 'サムネイル', hot: true },
  { value: 'display', label: 'ディスプレイ', icon: Layout, desc: 'GDN/YDA', hot: false },
  { value: 'webinar', label: 'ウェビナー', icon: Video, desc: 'セミナー', hot: false },
  { value: 'lp_hero', label: 'LP', icon: Megaphone, desc: 'ヒーロー', hot: false },
  { value: 'email', label: 'メール', icon: Mail, desc: 'ヘッダー', hot: false },
  { value: 'campaign', label: 'セール', icon: Gift, desc: 'キャンペーン', hot: false },
]

const SIZE_PRESETS: Record<string, Array<{ value: string; label: string; ratio: string }>> = {
  default: [
    { value: '1080x1080', label: 'スクエア', ratio: '1:1' },
    { value: '1200x628', label: '横長', ratio: '1.91:1' },
    { value: '1080x1920', label: '縦長', ratio: '9:16' },
  ],
  sns_ad: [
    { value: '1080x1080', label: 'フィード', ratio: '1:1' },
    { value: '1200x628', label: 'リンク', ratio: '1.91:1' },
    { value: '1080x1920', label: 'ストーリー', ratio: '9:16' },
  ],
  youtube: [
    { value: '1280x720', label: 'HD標準', ratio: '16:9' },
    { value: '1920x1080', label: 'フルHD', ratio: '16:9' },
  ],
  display: [
    { value: '300x250', label: 'レクタングル', ratio: '300×250' },
    { value: '728x90', label: 'リーダーボード', ratio: '728×90' },
    { value: '320x50', label: 'モバイル', ratio: '320×50' },
  ],
  webinar: [
    { value: '1920x1080', label: 'FHD', ratio: '16:9' },
    { value: '1200x628', label: 'OGP', ratio: '1.91:1' },
  ],
  lp_hero: [
    { value: '1920x600', label: 'ワイド', ratio: '1920×600' },
    { value: '1200x800', label: '標準', ratio: '3:2' },
  ],
  email: [
    { value: '600x200', label: 'ヘッダー', ratio: '600×200' },
    { value: '600x300', label: 'バナー', ratio: '600×300' },
  ],
  campaign: [
    { value: '1200x628', label: '横長', ratio: '1.91:1' },
    { value: '1080x1080', label: 'スクエア', ratio: '1:1' },
  ],
}

type SampleScenario = { purpose: string; category: string; keyword: string }

// サンプル入力（用途/業種/キーワードも含めて押すたびに切り替え）
const SAMPLE_SCENARIOS: SampleScenario[] = [
  { purpose: 'sns_ad', category: 'marketing', keyword: '広告費ムダ打ち0へ。CV改善の無料診断、今だけ受付中' },
  { purpose: 'sns_ad', category: 'beauty', keyword: '【本日限定】新規¥0体験あり たった30分で印象UP' },
  { purpose: 'display', category: 'ec', keyword: '決算セール MAX70%OFF 本日限り！' },
  { purpose: 'display', category: 'food', keyword: '初回限定 20%OFF。人気No.1セットを今だけ' },
  { purpose: 'webinar', category: 'it', keyword: '【参加無料】生成AI活用ロードマップ（Q&A付き）' },
  { purpose: 'webinar', category: 'finance', keyword: '【無料セミナー】家計見直しで月1万円を生み出す方法' },
  { purpose: 'lp_hero', category: 'it', keyword: '業務効率を10倍に。次世代AIプラットフォーム' },
  { purpose: 'lp_hero', category: 'health', keyword: '予約から問診まで一括管理。現場をもっとラクに' },
  { purpose: 'email', category: 'ec', keyword: '本日23:59まで：会員様限定クーポン配布中' },
  { purpose: 'campaign', category: 'telecom', keyword: '乗り換えで最大2万円キャッシュバック 月額990円〜' },
  { purpose: 'youtube', category: 'it', keyword: '【保存版】AIで作業が10倍速くなる“最短ルート”' },
]

// A/B/Cパターンの工夫点・特徴
const BANNER_INSIGHTS: Record<string, { 
  type: string
  title: string
  features: string[]
  color: string
  icon: string
}[]> = {
  default: [
    {
      type: 'A',
      title: 'ベネフィット訴求',
      features: [
        'ユーザーメリットを前面に',
        'ポジティブな明るいデザイン',
        '価値提案を強調したコピー',
      ],
      color: 'from-blue-500 to-cyan-500',
      icon: '💡',
    },
    {
      type: 'B',
      title: '緊急性・限定訴求',
      features: [
        '「今だけ」「限定」の訴求',
        '赤・黄のアクセントカラー',
        '行動を促すダイナミックデザイン',
      ],
      color: 'from-amber-500 to-orange-500',
      icon: '⚡',
    },
    {
      type: 'C',
      title: '信頼性・実績訴求',
      features: [
        '「No.1」「〇万人利用」など実績',
        '落ち着いたプロフェッショナルカラー',
        '安心感を与えるレイアウト',
      ],
      color: 'from-emerald-500 to-teal-500',
      icon: '🏆',
    },
  ],
  youtube: [
    {
      type: 'A',
      title: '衝撃・驚きフック',
      features: [
        '「衝撃」「まさか」の好奇心喚起',
        'ドラマチックな表情エリア',
        '赤・黄の強調ハイライト',
      ],
      color: 'from-red-500 to-pink-500',
      icon: '😱',
    },
    {
      type: 'B',
      title: '教育・価値提供',
      features: [
        '「〜の方法」「完全解説」の学び訴求',
        'ナンバリング（3つ、5選）で具体性',
        '青・緑の信頼感カラー',
      ],
      color: 'from-blue-500 to-violet-500',
      icon: '📚',
    },
    {
      type: 'C',
      title: '体験・ストーリー',
      features: [
        '「〜した結果」「密着」の物語性',
        '個人的で共感しやすいテイスト',
        '暖かみのあるカラー',
      ],
      color: 'from-orange-500 to-amber-500',
      icon: '📖',
    },
  ],
}

const GENERATION_PHASES = [
  { label: 'AIが分析中...', icon: '🔍', subtext: 'キーワードとカテゴリを解析' },
  { label: 'デザイン設計中...', icon: '📐', subtext: 'レイアウトを最適化' },
  { label: 'A案を生成中', icon: '🎨', subtext: 'ベネフィット訴求デザイン' },
  { label: 'B案を生成中', icon: '⚡', subtext: '緊急性・限定訴求デザイン' },
  { label: 'C案を生成中', icon: '🏆', subtext: '信頼性・実績訴求デザイン' },
  { label: '最終調整中...', icon: '✨', subtext: 'クオリティチェック' },
]

// 生成中に表示するTips
const GENERATION_TIPS = [
  { icon: '💡', text: 'A/B/Cの3案を比較して、最もパフォーマンスの良いバナーを選びましょう' },
  { icon: '🎯', text: 'CTAボタンの色や文言を変えると、クリック率が大きく変わります' },
  { icon: '📊', text: '同じキーワードでも、訴求タイプによって反応が異なります' },
  { icon: '🔥', text: '緊急性のある文言は、即座のアクションを促します' },
  { icon: '⭐', text: '実績や数字を入れると、信頼性がアップします' },
  { icon: '🎨', text: 'バナーの色は、ターゲット層によって最適なものが変わります' },
  { icon: '📱', text: 'モバイルでの見え方も確認しましょう' },
  { icon: '🚀', text: '生成されたバナーは、さらに修正指示で調整できます' },
]

// 生成中のアニメーション用アイコン
const FLOATING_ICONS = ['🎨', '✨', '🚀', '💫', '🌟', '💎', '🎯', '⚡']

// ========================================
// ヘルパー
// ========================================
async function imageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max)
}

function safeNumber(v: string, fallback: number) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function uniqStrings(items: string[]) {
  return Array.from(new Set(items.map((s) => String(s || '').trim()).filter(Boolean)))
}

function normalizeHexClient(v: string): string | null {
  const s = String(v || '').trim()
  const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (!m) return null
  const raw = m[1]
  const hex = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw
  return `#${hex.toUpperCase()}`
}

const OVERLAY_FONT_FAMILY_CSS =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", Helvetica, Arial'
const OVERLAY_FONT_FAMILY_CANVAS =
  'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", Helvetica, Arial'

function computeOverlayMetrics(
  w: number,
  h: number,
  fontScale: number,
  position: 'bottom' | 'center'
) {
  const width = Math.max(1, Math.round(w))
  const height = Math.max(1, Math.round(h))

  const padding = Math.round(width * 0.045)
  const panelW = width - padding * 2
  const panelH = Math.round(height * 0.28)
  const panelX = padding
  const panelY =
    position === 'center'
      ? Math.round((height - panelH) * 0.55)
      : height - padding - panelH

  const radius = Math.round(width * 0.03)
  const baseFont = clamp(Math.round(height * 0.06 * fontScale), 12, Math.round(height * 0.2))
  const subFont = clamp(Math.round(baseFont * 0.55), 10, Math.round(height * 0.16))
  const ctaFont = clamp(Math.round(baseFont * 0.58), 10, Math.round(height * 0.16))

  const textPadX = Math.round(panelW * 0.06)
  const textPadTop = Math.round(panelH * 0.14)
  const textX = panelX + textPadX
  const maxTextWidth = panelW * 0.88

  return {
    width,
    height,
    padding,
    panelW,
    panelH,
    panelX,
    panelY,
    radius,
    baseFont,
    subFont,
    ctaFont,
    textPadX,
    textPadTop,
    textX,
    maxTextWidth,
  }
}

function buildDefaultOverlay(keyword: string, purpose: string) {
  const k = keyword.trim()
  const headline = k.length > 0 ? k : '訴求メッセージを入力してください'
  const cta =
    purpose === 'youtube'
      ? '今すぐ見る'
      : purpose === 'webinar'
        ? '無料で参加'
        : purpose === 'campaign'
          ? '今すぐチェック'
          : '詳しくはこちら'
  return { headline, subhead: '', cta }
}

function createCopyVariants(headline: string, purpose: string) {
  const base = headline.trim()
  const head = base.length ? base : '今すぐ成果を出す'
  const variants =
    purpose === 'youtube'
      ? [
          `【衝撃】${head}`,
          `知らないと損… ${head}`,
          `これで変わる：${head}`,
          `最短で理解：${head}`,
          `今すぐ使える ${head}`,
        ]
      : [
          `${head}`,
          `まずは無料で ${head}`,
          `今だけ：${head}`,
          `最短ルートで ${head}`,
          `迷ったらこれ：${head}`,
        ]
  return Array.from(new Set(variants)).slice(0, 5)
}

function buildHighCtrSampleCopy(category: string, purpose: string) {
  // 業種×用途で「クリック率が上がりやすい型」を当てる（最初の1手を速くする）
  const isYouTube = purpose === 'youtube'
  const isCampaign = purpose === 'campaign'
  const isWebinar = purpose === 'webinar'
  const isLp = purpose === 'lp_hero'

  switch (category) {
    case 'telecom':
      return isYouTube
        ? '【暴露】格安SIMで通信費が半額になる理由'
        : isCampaign
          ? '【本日限定】乗り換えで最大2万円還元｜月額990円〜'
          : '月額990円〜｜乗り換えで最大2万円還元（今だけ）'
    case 'ec':
      return isYouTube
        ? '【検証】Amazonより安い？ガチで買ってみた'
        : '【本日限定】MAX70%OFF｜送料無料で今すぐお得に'
    case 'marketing':
      return isWebinar
        ? '【無料ウェビナー】売上を伸ばす広告改善 “即効” 5施策'
        : isLp
          ? '売上を最短で伸ばす。成果直結の広告運用をはじめよう'
          : '【無料診断】広告費のムダを削減してCVを増やす'
    case 'recruit':
      return isYouTube
        ? '【転職】年収が上がる人が必ずやってること'
        : '【未経験OK】月給30万〜｜面談だけでもOK（今週）'
    case 'beauty':
      return isCampaign
        ? '【初回限定】毛穴・くすみ対策｜今だけ特別価格'
        : '【初回限定】肌が変わる。人気No.1ケアを体験'
    case 'food':
      return isCampaign
        ? '【期間限定】人気メニューが今だけ20%OFF（本日）'
        : '【限定】今週だけの特別メニュー｜クーポン配布中'
    case 'realestate':
      return '【来場特典】理想の住まいが見つかる｜今週末見学会'
    case 'education':
      return isWebinar
        ? '【無料説明会】3ヶ月でスキル習得｜学習ロードマップ公開'
        : '最短で伸びる。無料体験で学習効果を実感'
    case 'finance':
      return '【今だけ】手数料を見直して“毎月のムダ”を削減'
    case 'health':
      return '【予約受付中】検査・相談をスムーズに｜まずは無料相談'
    case 'it':
      return isYouTube
        ? '【神機能】仕事が10倍速くなるAI活用術'
        : '業務効率を10倍に。AIでムダ時間を削減'
    default:
      return isYouTube ? '【必見】知らないと損する最新テクニック' : '【今だけ】まずは無料でお試し｜成果を最短で'
  }
}

function buildHighCtrSampleCopies(category: string, purpose: string) {
  const base = buildHighCtrSampleCopy(category, purpose)
  const isYouTube = purpose === 'youtube'
  const isCampaign = purpose === 'campaign'
  const isWebinar = purpose === 'webinar'

  const core = isYouTube
    ? [
        base,
        `【衝撃】${base.replace(/^【[^】]+】/, '')}`,
        `【暴露】${base.replace(/^【[^】]+】/, '')}`,
        `【神回】${base.replace(/^【[^】]+】/, '')}`,
        `知らないと損… ${base.replace(/^【[^】]+】/, '')}`,
        `結論：${base.replace(/^【[^】]+】/, '')}`,
        `【保存版】${base.replace(/^【[^】]+】/, '')}`,
        `【3分で】${base.replace(/^【[^】]+】/, '')}`,
      ]
    : [
        base,
        `【今だけ】${base.replace(/^【[^】]+】/, '')}`,
        `【無料】${base.replace(/^【[^】]+】/, '')}`,
        `まずは無料で：${base.replace(/^【[^】]+】/, '')}`,
        `最短で成果：${base.replace(/^【[^】]+】/, '')}`,
        `失敗しない：${base.replace(/^【[^】]+】/, '')}`,
        `【実績】${base.replace(/^【[^】]+】/, '')}`,
        `迷ったらこれ：${base.replace(/^【[^】]+】/, '')}`,
        `今すぐチェック：${base.replace(/^【[^】]+】/, '')}`,
      ]

  const boosts = [
    ...(isCampaign ? ['【本日限定】', '【期間限定】', '【数量限定】', '今だけ'] : []),
    ...(isWebinar ? ['【無料ウェビナー】', '【限定公開】', '【資料付き】'] : []),
  ]

  const boosted = core.flatMap((s) => {
    const out = [s]
    for (const b of boosts) out.push(`${b}${s.replace(/^【[^】]+】/, '')}`)
    return out
  })

  return uniqStrings(boosted).slice(0, 24)
}

// ========================================
// メインコンポーネント
// ========================================
export default function BannerDashboard() {
  const { data: session } = useSession()
  
  // State
  const [purpose, setPurpose] = useState('sns_ad')
  const [category, setCategory] = useState('')
  const [keyword, setKeyword] = useState('')
  const [size, setSize] = useState('1080x1080')
  const [useCustomSize, setUseCustomSize] = useState(false)
  const [customWidth, setCustomWidth] = useState('1080')
  const [customHeight, setCustomHeight] = useState('1080')
  const [companyName, setCompanyName] = useState('')
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [personImage, setPersonImage] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  // const [showCoach, setShowCoach] = useState(false) // removed
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [selectedBanner, setSelectedBanner] = useState<number | null>(null)
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  
  // 修正機能
  const [refineInstruction, setRefineInstruction] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [showRefineInput, setShowRefineInput] = useState(false)
  const [refineHistory, setRefineHistory] = useState<{ instruction: string; image: string }[]>([])
  
  // テキストオーバーレイ機能
  const [showTextOverlay, setShowTextOverlay] = useState(false)
  const [overlayHeadline, setOverlayHeadline] = useState('')
  const [overlaySubhead, setOverlaySubhead] = useState('')
  const [overlayCta, setOverlayCta] = useState('')
  const [overlayTextColor, setOverlayTextColor] = useState('#FFFFFF')
  const [overlayBgColor, setOverlayBgColor] = useState('#111827') // gray-900
  const [overlayBgOpacity, setOverlayBgOpacity] = useState(82)
  const [overlayPosition, setOverlayPosition] = useState<'bottom' | 'center'>('bottom')
  const [overlayFontScale, setOverlayFontScale] = useState(1)
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tipIndex, setTipIndex] = useState(0)
  
  const [guestUsageCount, setGuestUsageCount] = useState(0)
  const [isSuggestingCopy, setIsSuggestingCopy] = useState(false)

  // AIサンプル（押すたびに切り替え）
  const [aiSamplePool, setAiSamplePool] = useState<string[]>([])
  const [aiSampleIndex, setAiSampleIndex] = useState(0)
  const [aiSampleKey, setAiSampleKey] = useState('')

  // サンプル入力（用途/業種/キーワードまで押すたびに切り替え）
  const [sampleScenarioIndex, setSampleScenarioIndex] = useState(-1)
  const sampleScenarioIndexRef = useRef(-1)
  const sampleCopyIndexRef = useRef<Record<string, number>>({})
  const [sampleCopyIndex, setSampleCopyIndex] = useState(0)
  const [sampleCopyTotal, setSampleCopyTotal] = useState(0)

  // 使用カラー（任意・手動指定）
  const [useCustomColors, setUseCustomColors] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [colorDraft, setColorDraft] = useState('#8B5CF6')

  // テキストレイヤー：プレビューの計測（DLと比率を揃える）
  const overlayPreviewRef = useRef<HTMLDivElement | null>(null)
  const overlayImgRef = useRef<HTMLImageElement | null>(null)
  const [overlayPreviewBox, setOverlayPreviewBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  
  const isGuest = !session
  const bannerPlan = session ? String((session.user as any)?.bannerPlan || (session.user as any)?.plan || 'FREE').toUpperCase() : 'GUEST'
  const isProUser = !isGuest && (bannerPlan === 'PRO')
  const currentSizes = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
  const guestRemaining = BANNER_PRICING.guestLimit - guestUsageCount
  const [userUsageCount, setUserUsageCount] = useState(0)
  const userDailyLimit = isProUser ? BANNER_PRICING.proLimit : BANNER_PRICING.freeLimit
  const userRemaining = Math.max(0, userDailyLimit - userUsageCount)
  const remainingCount = isGuest ? guestRemaining : userRemaining
  
  // カスタムサイズの場合は入力値を使用
  const effectiveSize = useCustomSize ? `${customWidth}x${customHeight}` : size
  const isValidCustomSize = !useCustomSize || (
    parseInt(customWidth) >= 100 && parseInt(customWidth) <= 4096 &&
    parseInt(customHeight) >= 100 && parseInt(customHeight) <= 4096
  )
  const canGenerate = category && keyword.trim() && remainingCount > 0 && isValidCustomSize

  const sizeInfo = useMemo(() => {
    const [wStr, hStr] = effectiveSize.split('x')
    const w = safeNumber(wStr, 1080)
    const h = safeNumber(hStr, 1080)
    return { w, h, ratio: w / h }
  }, [effectiveSize])

  const overlayPreviewMetrics = useMemo(() => {
    const w = overlayPreviewBox.w || 640
    const h = overlayPreviewBox.h || Math.round(w / (sizeInfo.ratio || 1))
    return computeOverlayMetrics(w, h, overlayFontScale, overlayPosition)
  }, [overlayPreviewBox.w, overlayPreviewBox.h, overlayFontScale, overlayPosition, sizeInfo.ratio])

  // Effects
  useEffect(() => {
    if (isGuest && typeof window !== 'undefined') {
      const usage = getGuestUsage('banner')
      const today = new Date().toISOString().split('T')[0]
      setGuestUsageCount(usage.date === today ? usage.count : 0)
    }
  }, [isGuest])

  useEffect(() => {
    if (!isGuest && typeof window !== 'undefined') {
      const usage = getUserUsage('banner')
      const today = new Date().toISOString().split('T')[0]
      setUserUsageCount(usage.date === today ? usage.count : 0)
    }
  }, [isGuest])

  useEffect(() => {
    const sizes = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
    setSize(sizes[0].value)
  }, [purpose])

  useEffect(() => {
    // 条件が変わったらローテーション候補をリセット
    setAiSamplePool([])
    setAiSampleIndex(0)
    setAiSampleKey(`${category}|${purpose}`)
    // 「サンプル入力」も業種×用途でカウントをリセット
    if (category) {
      const poolLen = buildHighCtrSampleCopies(category, purpose).length
      setSampleCopyTotal(poolLen)
      setSampleCopyIndex(0)
    } else {
      setSampleCopyTotal(0)
      setSampleCopyIndex(0)
    }
  }, [category, purpose])

  useEffect(() => {
    if (!isGenerating) {
      setProgress(0)
      setPhaseIndex(0)
      setGenerationStartedAt(null)
      setElapsedSec(0)
      return
    }
    // 経過時間の追跡（秒数は表示しないが、メッセージ切替に使う）
    const start = Date.now()
    setGenerationStartedAt(start)
    const tick = setInterval(() => setElapsedSec(Math.floor((Date.now() - start) / 1000)), 1000)
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100
        const increment = Math.random() * 3 + 1
        // 生成中は85%で止める（完了時にのみ100%へ到達させる）
        return Math.min(prev + increment, 85)
      })
    }, 500)
    return () => {
      clearInterval(interval)
      clearInterval(tick)
    }
  }, [isGenerating])

  useEffect(() => {
    if (!isGenerating) return
    const phaseInterval = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % GENERATION_PHASES.length)
    }, 6000)
    return () => clearInterval(phaseInterval)
  }, [isGenerating])

  useEffect(() => {
    if (!isGenerating) return
    const t = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % GENERATION_TIPS.length)
    }, 5200)
    return () => clearInterval(t)
  }, [isGenerating])

  // 生成結果が入ったらテキストレイヤー初期値をセット（独自機能）
  useEffect(() => {
    if (generatedBanners.length === 0) return
    const d = buildDefaultOverlay(keyword, purpose)
    setOverlayHeadline(d.headline)
    setOverlaySubhead(d.subhead)
    setOverlayCta(d.cta)
    // ベースはOFF（自動でONにしない）
  }, [generatedBanners.length, keyword, purpose])

  // プレビュー領域（画像そのもの）のサイズを追跡
  useEffect(() => {
    const el = overlayImgRef.current || overlayPreviewRef.current
    if (!el || typeof ResizeObserver === 'undefined') return

    const update = () => {
      const target = overlayImgRef.current || overlayPreviewRef.current
      setOverlayPreviewBox({ w: target?.clientWidth || 0, h: target?.clientHeight || 0 })
    }
    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [selectedBanner, showTextOverlay, generatedBanners.length])

  // Handlers
  const handleSample = () => {
    // 業種を選択中なら「いまの業種に合わせたキャッチコピー」だけ切り替える
    if (category) {
      const key = `${category}|${purpose}`
      const pool = buildHighCtrSampleCopies(category, purpose)
      const current = sampleCopyIndexRef.current[key] ?? -1
      const next = (current + 1) % Math.max(1, pool.length)
      sampleCopyIndexRef.current[key] = next
      setSampleCopyIndex(next)
      setSampleCopyTotal(pool.length)
      setKeyword(pool[next] || pool[0] || '')

      const label = CATEGORIES.find((c) => c.value === category)?.label || category
      toast.success(`キャッチコピーを「${label}」向けサンプルにしました（${next + 1}/${pool.length}）`, { icon: '🔁' })
      return
    }

    // 業種未選択の場合は「用途/業種/キーワード」をまとめてセット（導線として残す）
    const pool = SAMPLE_SCENARIOS
    sampleScenarioIndexRef.current = (sampleScenarioIndexRef.current + 1) % pool.length
    const next = sampleScenarioIndexRef.current
    setSampleScenarioIndex(next)
    const s = pool[next]!
    setPurpose(s.purpose)
    setCategory(s.category)
    setKeyword(s.keyword)
    toast.success(`サンプルを切り替えました（${next + 1}/${pool.length}）`, { icon: '🔁' })
  }

  const handleGenerate = async () => {
    if (!canGenerate) return

    // 上限に達している場合は上位利用へ誘導
    if (remainingCount <= 0) {
      toast.error('本日の上限に達しました。上位利用をご希望の場合はリンクからご相談ください。', { duration: 6000 })
      try {
        if (HIGH_USAGE_CONTACT_URL) window.open(HIGH_USAGE_CONTACT_URL, HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : '_self')
      } catch {}
      return
    }
    
    setError('')
    setIsGenerating(true)
    // テキストレイヤーはベースOFF（必要な時だけユーザーがON）
    setShowTextOverlay(false)
    setGeneratedBanners([])
    setSelectedBanner(null)

    try {
      const response = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          keyword: keyword.trim(),
          size: effectiveSize,
          purpose,
          companyName: companyName.trim() || undefined,
          logoImage: logoImage || undefined,
          personImage: personImage || undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          brandColors: useCustomColors
            ? uniqStrings(customColors.map((c) => normalizeHexClient(c) || '').filter(Boolean)).slice(0, 8)
            : undefined,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || '生成に失敗しました')
      
      setProgress(100)
      await new Promise(r => setTimeout(r, 500))
      setGeneratedBanners(data.banners || [])
      
      if (isGuest) {
        const newCount = guestUsageCount + 1
        setGuestUsageCount(newCount)
        setGuestUsage('banner', newCount)
      } else {
        const newCount = incrementUserUsage('banner')
        setUserUsageCount(newCount)
      }
      
      // 部分的にエラーがあった場合は警告表示
      if (data.error) {
        setError(data.error)
        toast.error('一部のバナー生成に失敗しました', { 
          icon: '⚠️',
          duration: 5000,
        })
      } else {
        toast.success('バナーが完成しました！', { icon: '🎉' })
      }
    } catch (err: any) {
      setError(err.message)
      toast.error('生成に失敗しました', { icon: '❌', duration: 5000 })
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadWithTextOverlay = async (imageUrl: string) => {
    try {
      const canvas = compositeCanvasRef.current || document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvasの初期化に失敗しました')

      const img = new Image()
      img.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        img.src = imageUrl
      })

      // 画像サイズ
      canvas.width = img.naturalWidth || sizeInfo.w
      canvas.height = img.naturalHeight || sizeInfo.h
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      // テキストレイヤー
      const padding = Math.round(canvas.width * 0.045)
      const panelW = canvas.width - padding * 2
      const panelH = Math.round(canvas.height * 0.28)
      const panelX = padding
      const panelY = overlayPosition === 'center'
        ? Math.round((canvas.height - panelH) * 0.55)
        : canvas.height - padding - panelH

      const opacity = clamp(overlayBgOpacity, 0, 100) / 100
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.fillStyle = overlayBgColor
      const r = Math.round(canvas.width * 0.03)
      // rounded rect
      ctx.beginPath()
      ctx.moveTo(panelX + r, panelY)
      ctx.arcTo(panelX + panelW, panelY, panelX + panelW, panelY + panelH, r)
      ctx.arcTo(panelX + panelW, panelY + panelH, panelX, panelY + panelH, r)
      ctx.arcTo(panelX, panelY + panelH, panelX, panelY, r)
      ctx.arcTo(panelX, panelY, panelX + panelW, panelY, r)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      const baseFont = Math.round(canvas.height * 0.06 * overlayFontScale)
      const subFont = Math.round(baseFont * 0.55)
      const ctaFont = Math.round(baseFont * 0.58)

      ctx.fillStyle = overlayTextColor
      ctx.textBaseline = 'top'
      ctx.font = `900 ${baseFont}px ${OVERLAY_FONT_FAMILY_CANVAS}`

      const textX = panelX + Math.round(panelW * 0.06)
      let y = panelY + Math.round(panelH * 0.14)

      // headline（自動改行：2行まで）
      const headline = overlayHeadline.trim()
      const maxWidth = panelW * 0.88
      const lines: string[] = []
      if (headline) {
        const words = headline.split('')
        let line = ''
        for (const ch of words) {
          const test = line + ch
          if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line)
            line = ch
          } else {
            line = test
          }
          if (lines.length >= 2) break
        }
        if (lines.length < 2 && line) lines.push(line)
      }
      for (const line of lines) {
        ctx.fillText(line, textX, y)
        y += Math.round(baseFont * 1.1)
      }

      // subhead
      const sub = overlaySubhead.trim()
      if (sub) {
        ctx.globalAlpha = 0.92
        ctx.font = `700 ${subFont}px ${OVERLAY_FONT_FAMILY_CANVAS}`
        ctx.fillText(sub, textX, y + Math.round(baseFont * 0.12))
        ctx.globalAlpha = 1
      }

      // CTA pill
      const cta = overlayCta.trim()
      if (cta) {
        const pillPaddingX = Math.round(panelW * 0.04)
        const pillPaddingY = Math.round(panelH * 0.08)
        ctx.font = `900 ${ctaFont}px ${OVERLAY_FONT_FAMILY_CANVAS}`
        const tw = ctx.measureText(cta).width
        const pillW = Math.round(tw + pillPaddingX * 2)
        const pillH = Math.round(ctaFont + pillPaddingY * 1.6)
        const pillX = panelX + panelW - pillW - Math.round(panelW * 0.06)
        const pillY = panelY + panelH - pillH - Math.round(panelH * 0.14)
        ctx.save()
        ctx.fillStyle = overlayTextColor
        ctx.globalAlpha = 0.12
        // rounded rect for CTA
        const pr = Math.round(pillH / 2)
        ctx.beginPath()
        ctx.moveTo(pillX + pr, pillY)
        ctx.arcTo(pillX + pillW, pillY, pillX + pillW, pillY + pillH, pr)
        ctx.arcTo(pillX + pillW, pillY + pillH, pillX, pillY + pillH, pr)
        ctx.arcTo(pillX, pillY + pillH, pillX, pillY, pr)
        ctx.arcTo(pillX, pillY, pillX + pillW, pillY, pr)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
        ctx.fillStyle = overlayTextColor
        ctx.fillText(cta, pillX + pillPaddingX, pillY + Math.round(pillPaddingY * 0.6))
      }

      const out = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = out
      link.download = `doya-banner-text-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success('テキスト入りでダウンロードしました', { icon: '⬇️' })
    } catch (e: any) {
      toast.error(e?.message || '合成に失敗しました')
    }
  }

  const handleSmartCopySample = async () => {
    if (!category) {
      toast.error('先に「業種」を選択してください', { icon: '👆' })
      return
    }

    const key = `${category}|${purpose}`

    // 既に候補がある場合は「押すたびに切り替え」
    if (aiSamplePool.length > 1 && aiSampleKey === key) {
      const next = (aiSampleIndex + 1) % aiSamplePool.length
      setAiSampleIndex(next)
      setKeyword(aiSamplePool[next])
      toast.success(`サンプルを切り替えました（${next + 1}/${aiSamplePool.length}）`, { icon: '🔁' })
      return
    }

    // 候補が1つしかない場合でも、テンプレ候補を足して「切り替え可能」にする
    if (aiSamplePool.length === 1 && aiSampleKey === key) {
      const expanded = uniqStrings([
        ...aiSamplePool,
        ...buildHighCtrSampleCopies(category, purpose),
      ]).slice(0, 12)
      const next = expanded.length > 1 ? 1 : 0
      setAiSamplePool(expanded)
      setAiSampleIndex(next)
      setKeyword(expanded[next] || expanded[0] || '')
      toast.success(`サンプルを切り替えました（${next + 1}/${expanded.length}）`, { icon: '🔁' })
      return
    }

    try {
      // AIバナーコーチ機能は廃止したため、サンプルはローカル生成のみ
      setIsSuggestingCopy(true)
      const base = keyword.trim()
      const local = buildHighCtrSampleCopies(category, purpose)
      const boosts = base
        ? uniqStrings([
            base,
            `【今だけ】${base.replace(/^【[^】]+】/, '')}`,
            `【無料】${base.replace(/^【[^】]+】/, '')}`,
            `まずは無料で：${base.replace(/^【[^】]+】/, '')}`,
            `失敗しない：${base.replace(/^【[^】]+】/, '')}`,
            `今すぐチェック：${base.replace(/^【[^】]+】/, '')}`,
          ])
        : []
      const pool = uniqStrings([...boosts, ...local]).slice(0, 18)

      setAiSampleKey(key)
      setAiSamplePool(pool)
      setAiSampleIndex(0)
      setKeyword(pool[0])
      toast.success(`クリック率を意識したサンプルを入力しました（1/${pool.length}）`, { icon: '✅' })
    } catch (e: any) {
      const pool = buildHighCtrSampleCopies(category, purpose)
      setAiSampleKey(key)
      setAiSamplePool(pool)
      setAiSampleIndex(0)
      setKeyword(pool[0])
      toast.error(e?.message || 'サンプル生成に失敗したため、テンプレサンプルに切り替えました', { icon: '⚠️' })
    } finally {
      setIsSuggestingCopy(false)
    }
  }

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a')
    link.href = url
    link.download = `doya-banner-${['A', 'B', 'C'][index]}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロード開始')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'person') => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error('5MB以下の画像を選択してください')
      return
    }
    try {
      const base64 = await imageToBase64(file)
      if (type === 'logo') setLogoImage(base64)
      else setPersonImage(base64)
      toast.success('画像をアップロードしました')
    } catch {
      toast.error('アップロードに失敗しました')
    }
  }

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (referenceImages.length >= 2) {
      toast.error('参考画像は最大2枚までです')
      return
    }

    const toAdd = files.slice(0, 2 - referenceImages.length)
    try {
      const converted = await Promise.all(
        toAdd.map(async (file) => {
          if (file.size > 5 * 1024 * 1024) throw new Error('5MB以下の画像を選択してください')
          return await imageToBase64(file)
        })
      )
      setReferenceImages((prev) => [...prev, ...converted])
      toast.success('参考画像を追加しました', { icon: '🖼️' })
    } catch (err: any) {
      toast.error(err?.message || '参考画像の追加に失敗しました')
    } finally {
      e.target.value = ''
    }
  }

  // 画像修正ハンドラー（外部から指示文を渡して実行もできる）
  const handleRefine = async (overrideInstruction?: string) => {
    if (selectedBanner === null) return
    const instruction = (overrideInstruction ?? refineInstruction).trim()
    if (!instruction) return

    const originalImage = generatedBanners[selectedBanner]
    
    setIsRefining(true)
    try {
      const response = await fetch('/api/banner/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalImage,
          instruction,
          category,
          size: effectiveSize,
        }),
      })

      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || '修正に失敗しました')
      }

      // 履歴に追加
      setRefineHistory(prev => [...prev, { 
        instruction, 
        image: originalImage 
      }])
      
      // バナーを更新
      const newBanners = [...generatedBanners]
      newBanners[selectedBanner] = data.refinedImage
      setGeneratedBanners(newBanners)
      
      setRefineInstruction('')
      setShowRefineInput(false)
      toast.success('バナーを修正しました！', { icon: '✨' })
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsRefining(false)
    }
  }

  // 修正を元に戻す
  const handleUndoRefine = () => {
    if (selectedBanner === null || refineHistory.length === 0) return
    
    const lastHistory = refineHistory[refineHistory.length - 1]
    const newBanners = [...generatedBanners]
    newBanners[selectedBanner] = lastHistory.image
    setGeneratedBanners(newBanners)
    setRefineHistory(prev => prev.slice(0, -1))
    toast.success('元に戻しました')
  }

  // ========================================
  // Render
  // ========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 text-gray-900">
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#111827',
            borderRadius: '16px',
            padding: '16px 24px',
            boxShadow: '0 25px 50px -12px rgba(17, 24, 39, 0.18)',
            border: '1px solid rgba(229, 231, 235, 0.9)',
          },
        }}
      />
      
      {/* ========================================
          Header - Ultra Modern Glass Morphism
          ======================================== */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-2xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="h-16 sm:h-20 flex items-center justify-between">
            <Link href="/banner" className="flex items-center gap-3 sm:gap-4 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-xl">
                  <span className="text-xl sm:text-2xl">🎨</span>
                </div>
              </div>
              <div>
                <h1 className="font-black text-lg sm:text-xl tracking-tight">
                  <span className="bg-gradient-to-r from-violet-700 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                    ドヤバナーAI
                  </span>
                </h1>
                <p className="hidden sm:block text-[10px] text-gray-400 font-medium tracking-wider uppercase">Professional Banner Generator</p>
              </div>
            </Link>
            
            <div className="flex items-center gap-3 sm:gap-4">
              {isGuest ? (
                <>
                  <div className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                    <div className={`w-2 h-2 rounded-full bg-amber-400 ${guestRemaining <= 0 ? '' : 'animate-pulse'}`} />
                    {guestRemaining <= 0 ? (
                      <span className="text-xs sm:text-sm font-black text-amber-800">本日の上限</span>
                    ) : (
                      <>
                        <span className="text-xs sm:text-sm font-bold text-amber-700">{guestRemaining}</span>
                        <span className="text-xs text-amber-600 hidden sm:inline">回残り</span>
                      </>
                    )}
                  </div>
                  <Link href="/auth/signin?callbackUrl=/banner/dashboard">
                    <button className="group flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all text-xs sm:text-sm shadow-lg shadow-gray-900/20">
                      <LogIn className="w-4 h-4" />
                      <span>ログイン</span>
                      <ArrowRight className="w-4 h-4 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                    </button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/banner/dashboard/history">
                    <button className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all text-sm">
                      <Clock className="w-4 h-4" />
                      <span className="hidden sm:inline">履歴</span>
                    </button>
                  </Link>
                  <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border ${
                    userRemaining <= 5
                      ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200/50'
                      : 'bg-gradient-to-r from-violet-50 to-fuchsia-50 border-violet-200/50'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${userRemaining <= 5 ? 'bg-amber-400' : 'bg-violet-400'} ${userRemaining <= 5 ? 'animate-pulse' : ''}`} />
                    {userRemaining <= 0 ? (
                      <span className="text-xs sm:text-sm font-black text-amber-800">本日の上限</span>
                    ) : (
                      <>
                        <span className={`text-xs sm:text-sm font-bold ${userRemaining <= 5 ? 'text-amber-700' : 'text-violet-700'}`}>{userRemaining}</span>
                        <span className={`text-xs hidden sm:inline ${userRemaining <= 5 ? 'text-amber-600' : 'text-violet-600'}`}>回残り</span>
                      </>
                    )}
                    {userRemaining <= 0 && (
                      <a
                        href={HIGH_USAGE_CONTACT_URL}
                        target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                        rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
                        className="ml-2 px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-bold hover:bg-gray-800"
                      >
                        上位利用
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-100 to-fuchsia-100 border border-violet-200/50">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white text-xs font-bold">
                      {session.user?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 max-w-[80px] truncate hidden sm:block">{session.user?.name?.split(' ')[0]}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================
          Main Content
          ======================================== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-10">
        <div className="grid lg:grid-cols-[1fr,440px] gap-6 sm:gap-10">
          
          {/* ========================================
              Left Column - Input Form
              ======================================== */}
          <div className="space-y-6">
            
            {/* Hero Section - Premium Minimal Design */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden"
            >
              {/* Main Card */}
              <div className="relative bg-white rounded-3xl border border-gray-200/60 p-6 sm:p-10 shadow-2xl shadow-violet-500/5">
                {/* Subtle Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/[0.02] via-transparent to-fuchsia-500/[0.02] rounded-3xl" />
                
                {/* Decorative Shapes */}
                <div className="absolute -top-20 -right-20 w-60 h-60 bg-gradient-to-br from-violet-100 to-fuchsia-100 rounded-full blur-3xl opacity-60" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-cyan-100 to-blue-100 rounded-full blur-3xl opacity-40" />
                
                <div className="relative">
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold shadow-lg shadow-violet-500/30 mb-6">
                    <Sparkles className="w-4 h-4" />
                    A/B/C 3パターン同時生成
                  </div>
                  
                  {/* Title */}
                  <h1 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight leading-tight">
                    プロ品質バナーを
                    <br />
                    <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                      数クリックで自動生成
                    </span>
                  </h1>
                  
                  {/* Subtitle */}
                  <p className="text-gray-500 text-sm sm:text-base max-w-md">
                    カテゴリとキーワードを入力するだけ。AIがプロのデザイナー品質のバナーを3パターン作成します。
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Step 1: Purpose */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between mb-4 sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-violet-500/30">
                    1
                  </div>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-gray-900">用途を選択</h2>
                    <p className="text-xs text-gray-400 hidden sm:block">どこで使うバナーですか？</p>
                  </div>
                </div>
                <button 
                  onClick={handleSample}
                  className="flex items-center gap-2 px-3.5 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-xl transition-colors text-sm font-bold"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>サンプル入力</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/70 border border-violet-200 text-[11px] font-black text-violet-700">
                    {category
                      ? `${Math.max(1, sampleCopyIndex + 1)}/${Math.max(1, sampleCopyTotal)}`
                      : `${Math.max(1, sampleScenarioIndex + 1)}/${SAMPLE_SCENARIOS.length}`}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 sm:gap-3">
                {PURPOSES.map((p) => {
                  const Icon = p.icon
                  const isSelected = purpose === p.value
                  return (
                    <button
                      key={p.value}
                      onClick={() => setPurpose(p.value)}
                      className={`relative p-3 sm:p-4 rounded-xl sm:rounded-2xl text-center transition-all ${
                        isSelected 
                          ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30 scale-[1.02]' 
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:scale-[1.02]'
                      }`}
                    >
                      {p.hot && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full shadow-md flex items-center justify-center">
                          <span className="text-[6px] text-white font-bold">★</span>
                        </span>
                      )}
                      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${isSelected ? 'text-white' : ''}`} />
                      <span className="text-[10px] sm:text-xs font-bold block truncate">{p.label}</span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* Step 2: Category */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-cyan-500/30">
                  2
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900">業種を選択</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">デザインテイストに影響します</p>
                </div>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 sm:gap-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.value
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl text-center transition-all ${
                        isSelected 
                          ? 'bg-white shadow-lg scale-[1.02] outline outline-2 outline-offset-2' 
                          : 'bg-gray-50/50 hover:bg-gray-100 hover:scale-[1.02]'
                      }`}
                      style={{ 
                        outlineColor: isSelected ? cat.color : undefined,
                        boxShadow: isSelected ? `0 10px 40px -10px ${cat.color}40` : undefined
                      }}
                    >
                      <span className="text-xl sm:text-2xl block mb-1">{cat.icon}</span>
                      <span className={`text-[10px] sm:text-xs font-bold ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                        {cat.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </motion.div>

            {/* Step 3: Size */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-500/30">
                  3
                </div>
                <div>
                  <h2 className="font-bold text-base sm:text-lg text-gray-900">サイズを選択</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">用途に合わせた最適サイズ</p>
                </div>
              </div>
              
              {/* プリセット or カスタム 切り替え */}
              <div className="flex gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                <button
                  onClick={() => setUseCustomSize(false)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    !useCustomSize 
                      ? 'bg-white text-gray-900 shadow-md' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  プリセット
                </button>
                <button
                  onClick={() => setUseCustomSize(true)}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    useCustomSize 
                      ? 'bg-white text-gray-900 shadow-md' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  カスタム
                </button>
              </div>

              <AnimatePresence mode="wait">
                {useCustomSize ? (
                  <motion.div
                    key="custom"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">幅 (px)</label>
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-center text-lg font-bold focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                      <span className="text-gray-300 text-xl mt-5">×</span>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 mb-1 block">高さ (px)</label>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(e.target.value)}
                          min={100}
                          max={4096}
                          className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-center text-lg font-bold focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all"
                          placeholder="1080"
                        />
                      </div>
                    </div>
                    
                    {/* アスペクト比プレビュー */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2">
                        <div 
                          className="bg-gradient-to-br from-fuchsia-200 to-violet-200 border border-fuchsia-300 rounded"
                          style={{
                            width: `${Math.min(40, 40 * (parseInt(customWidth) || 1) / (parseInt(customHeight) || 1))}px`,
                            height: `${Math.min(40, 40 * (parseInt(customHeight) || 1) / (parseInt(customWidth) || 1))}px`,
                            minWidth: '16px',
                            minHeight: '16px',
                          }}
                        />
                        <span className="text-sm text-gray-600">
                          {customWidth} × {customHeight}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {(() => {
                          const w = parseInt(customWidth) || 1
                          const h = parseInt(customHeight) || 1
                          const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a
                          const g = gcd(w, h)
                          return `${w/g}:${h/g}`
                        })()}
                      </span>
                    </div>
                    
                    {/* よく使うサイズ */}
                    <div>
                      <p className="text-xs text-gray-400 mb-2">よく使うサイズ</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { w: 1080, h: 1080, label: 'インスタ' },
                          { w: 1200, h: 628, label: 'OGP' },
                          { w: 1280, h: 720, label: 'YouTube' },
                          { w: 1920, h: 1080, label: 'FHD' },
                          { w: 800, h: 418, label: 'X/Twitter' },
                          { w: 1200, h: 900, label: 'note' },
                        ].map((preset) => (
                          <button
                            key={`${preset.w}x${preset.h}`}
                            onClick={() => {
                              setCustomWidth(preset.w.toString())
                              setCustomHeight(preset.h.toString())
                            }}
                            className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 text-xs rounded-md transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {!isValidCustomSize && (
                      <p className="text-red-500 text-xs">
                        サイズは100〜4096pxの範囲で指定してください
                      </p>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="preset"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-wrap gap-1.5 sm:gap-2"
                  >
                    {currentSizes.map((s) => {
                      const isSelected = size === s.value
                      return (
                        <button
                          key={s.value}
                          onClick={() => setSize(s.value)}
                          className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl transition-all flex items-center gap-1.5 sm:gap-2 ${
                            isSelected 
                              ? 'bg-violet-50 border-2 border-violet-400 text-violet-700 shadow-sm' 
                              : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600" />}
                          <span className="font-medium text-xs sm:text-sm">{s.label}</span>
                          <span className="text-[10px] sm:text-xs text-gray-400 hidden sm:inline">{s.ratio}</span>
                        </button>
                      )
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Step 4: Keyword */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-gray-200/60 p-5 sm:p-6 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-all"
            >
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-orange-600 to-amber-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-lg shadow-orange-500/30">
                    4
                  </div>
                  <div>
                    <h2 className="font-bold text-base sm:text-lg text-gray-900">キャッチコピー</h2>
                    <p className="text-xs text-gray-400 hidden sm:block">業種×用途に合わせてCTRを上げる</p>
                  </div>
                </div>

                <button
                  onClick={handleSmartCopySample}
                  disabled={isSuggestingCopy}
                  className="flex items-center gap-2 px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl transition-colors text-sm font-black disabled:opacity-60"
                >
                  {isSuggestingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span className="hidden sm:inline">AIサンプル</span>
                  <span className="sm:hidden">AI</span>
                </button>
              </div>
              <div className="relative">
                <textarea
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                  className="w-full px-4 sm:px-5 py-4 sm:py-5 bg-gray-50/50 border-2 border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:border-violet-500 focus:bg-white focus:shadow-lg focus:shadow-violet-500/10 outline-none transition-all resize-none text-base sm:text-lg leading-relaxed"
                  rows={3}
                  maxLength={200}
                />
                <div className="absolute bottom-4 right-4 px-2 py-1 bg-white rounded-md text-xs text-gray-400 font-medium">
                  {keyword.length}/200
                </div>
              </div>
            </motion.div>

            {/* Advanced Options */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors text-sm mb-3 font-medium"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                詳細設定（会社名・ロゴ・人物・参考画像）
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm"
                  >
                    {/* Company Name */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                        <Building2 className="w-4 h-4" />
                        会社名・ブランド名
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="例: 株式会社〇〇"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all"
                      />
                    </div>
                    
                    {/* Image Uploads */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Logo */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                          <ImageIcon className="w-4 h-4" />
                          ロゴ
                        </label>
                        <div className="relative">
                          {logoImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                              <img src={logoImage} alt="Logo" className="w-full h-full object-contain p-2" />
                              <button
                                onClick={() => setLogoImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow-sm"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 cursor-pointer transition-colors bg-gray-50 hover:bg-violet-50">
                              <Building2 className="w-8 h-8 text-gray-300 mb-2" />
                              <span className="text-xs text-gray-400">アップロード</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'logo')}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                      
                      {/* Person */}
                      <div>
                        <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                          <User className="w-4 h-4" />
                          人物
                        </label>
                        <div className="relative">
                          {personImage ? (
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                              <img src={personImage} alt="Person" className="w-full h-full object-cover" />
                              <button
                                onClick={() => setPersonImage(null)}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow-sm"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 cursor-pointer transition-colors bg-gray-50 hover:bg-violet-50">
                              <User className="w-8 h-8 text-gray-300 mb-2" />
                              <span className="text-xs text-gray-400">アップロード</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleImageUpload(e, 'person')}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Reference Images */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                        <Eye className="w-4 h-4" />
                        参考画像（テイスト/構図の指定）
                        <span className="text-xs text-gray-400 font-semibold">最大2枚</span>
                      </label>

                      {referenceImages.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {referenceImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-200">
                              <img src={img} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                              <button
                                onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute top-2 right-2 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center hover:bg-white shadow-sm"
                              >
                                <X className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <label className="flex items-center justify-center w-full h-12 rounded-xl border-2 border-dashed border-gray-200 hover:border-violet-400 cursor-pointer transition-colors bg-gray-50 hover:bg-violet-50">
                        <span className="text-sm font-bold text-gray-600">参考画像を追加</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleReferenceUpload}
                          className="hidden"
                          disabled={referenceImages.length >= 2}
                        />
                      </label>

                      <p className="text-xs text-gray-400 mt-2">
                        参考画像のロゴ/透かしはコピーしません。雰囲気・配色・構図の参考として使います。
                      </p>
                    </div>

                    {/* Manual Colors */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                        <Palette className="w-4 h-4" />
                        使用カラー（任意）
                      </label>
                      <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-600">
                            生成に適用: <span className="font-semibold text-gray-800">{useCustomColors ? 'ON' : 'OFF'}</span>
                          </div>
                          <button
                            onClick={() => setUseCustomColors((v) => !v)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              useCustomColors
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            {useCustomColors ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            type="color"
                            value={normalizeHexClient(colorDraft) || '#8B5CF6'}
                            onChange={(e) => setColorDraft(e.target.value)}
                            className="h-12 w-16 rounded-xl border border-gray-200 bg-white p-1"
                            aria-label="color picker"
                          />
                          <input
                            value={colorDraft}
                            onChange={(e) => setColorDraft(e.target.value)}
                            placeholder="#8B5CF6"
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none transition-all font-mono"
                          />
                          <button
                            onClick={() => {
                              const hex = normalizeHexClient(colorDraft)
                              if (!hex) {
                                toast.error('HEX形式（例: #8B5CF6）で入力してください')
                                return
                              }
                              setCustomColors((prev) => uniqStrings([...prev, hex]).slice(0, 8))
                              setColorDraft(hex)
                              toast.success('カラーを追加しました', { icon: '🎨' })
                            }}
                            className="px-4 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
                          >
                            追加
                          </button>
                          <button
                            onClick={() => {
                              const cat = CATEGORIES.find((c) => c.value === category)
                              const hex = normalizeHexClient(cat?.color || '')
                              if (!hex) {
                                toast.error('カテゴリを選択してください')
                                return
                              }
                              setCustomColors((prev) => uniqStrings([...prev, hex]).slice(0, 8))
                              toast.success('カテゴリ色を追加しました', { icon: '➕' })
                            }}
                            className="px-4 py-3 rounded-xl bg-white text-gray-700 font-bold hover:bg-gray-100 border border-gray-200"
                          >
                            カテゴリ色
                          </button>
                        </div>

                        {customColors.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {customColors.map((c) => (
                              <button
                                key={c}
                                onClick={() => setCustomColors((prev) => prev.filter((x) => x !== c))}
                                className="flex items-center gap-2 px-2 py-1 bg-white rounded-lg border border-gray-200 hover:bg-gray-100"
                                title="クリックで削除"
                              >
                                <div className="w-4 h-4 rounded border border-gray-200" style={{ backgroundColor: c }} />
                                <span className="text-xs font-mono text-gray-700">{c}</span>
                                <span className="text-xs text-gray-400">×</span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-3">
                            まだ指定されていません（OFFのままでもOK）。最大8色まで。
                          </p>
                        )}

                        <p className="text-xs text-gray-500 mt-3">
                          ※ ON の場合、ここで指定した色を優先して配色します（白/黒/グレー等は補助色として追加されることがあります）。
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Generate Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className={`group w-full py-5 sm:py-6 rounded-2xl sm:rounded-3xl font-black text-lg sm:text-xl transition-all flex items-center justify-center gap-3 relative overflow-hidden ${
                  canGenerate && !isGenerating
                    ? 'bg-gray-900 text-white shadow-2xl shadow-gray-900/30 hover:shadow-gray-900/50 hover:scale-[1.01]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="absolute inset-0 bg-gray-900" />
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 transition-all duration-300"
                      style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                    />
                    <div className="relative flex items-center gap-3">
                      <div className="relative">
                        <div className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      </div>
                      <span className="text-base sm:text-lg">{GENERATION_PHASES[phaseIndex].icon} {GENERATION_PHASES[phaseIndex].label}</span>
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs sm:text-sm font-bold">{Math.round(progress)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-violet-600/10 to-violet-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />
                    <span>バナーを生成する</span>
                    <ArrowRight className="w-5 h-5 opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all" />
                  </>
                )}
              </button>

              {!isGenerating && remainingCount <= 0 && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm text-center font-medium">
                  本日の使用回数上限に達しました。
                  {isGuest ? (
                    <span className="ml-1">ログインしてプランをご確認ください。</span>
                  ) : (
                    <span className="ml-1">必要なら「上位利用」からご相談ください。</span>
                  )}
                </div>
              )}
              
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <p className="text-red-600 text-sm text-center font-medium">{error}</p>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* ========================================
              Right Column - Results
              ======================================== */}
          <div className="space-y-5 sm:space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-3 sm:space-y-4"
            >
                  {generatedBanners.length > 0 ? (
                    <>
                      {/* Text Overlay Notice */}
                      <div className="bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/50 rounded-2xl p-4 mb-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                            <Pencil className="w-4 h-4 text-violet-600" />
                          </div>
                          <div className="text-sm text-gray-600">
                            <span className="font-semibold text-violet-700">ヒント：</span>
                            生成されたバナーにはテキスト用スペースが確保されています。Canvaなどでテキストを追加してください。
                          </div>
                        </div>
                      </div>
                      
                      {/* Banner Grid */}
                      <div className="grid grid-cols-3 gap-3 sm:gap-4">
                        {generatedBanners.map((banner, i) => {
                          const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                          const insight = insights[i]
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              onClick={() => setSelectedBanner(i)}
                              className={`relative aspect-square rounded-lg sm:rounded-xl overflow-hidden cursor-pointer group shadow-md hover:shadow-xl transition-shadow ${
                                selectedBanner === i 
                                  ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-white' 
                                  : ''
                              }`}
                            >
                              <img src={banner} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              {/* バッジ：A/B/C + アイコン */}
                              <div className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white/90 backdrop-blur-sm rounded-md sm:rounded-lg shadow-sm">
                                <span className="text-sm sm:text-base">{insight.icon}</span>
                                <span className="text-[10px] sm:text-xs font-bold text-gray-800">{insight.type}案</span>
                              </div>
                              {/* ホバー時：訴求タイプ名 */}
                              <div className="absolute bottom-0 inset-x-0 p-2 sm:p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-[10px] sm:text-xs font-medium text-white truncate">
                                  {insight.title}
                                </p>
                              </div>
                              {/* ダウンロードボタン */}
                              <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(banner, i) }}
                                  className="w-7 h-7 sm:w-8 sm:h-8 bg-white/90 backdrop-blur-sm rounded-md sm:rounded-lg flex items-center justify-center hover:bg-white shadow-sm"
                                >
                                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-700" />
                                </button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {/* Selected Banner Preview */}
                      {selectedBanner !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3 sm:space-y-4"
                        >
                          {/* バナー工夫点カード */}
                          {(() => {
                            const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                            const insight = insights[selectedBanner]
                            return (
                              <motion.div
                                key={selectedBanner}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`relative overflow-hidden bg-gradient-to-br ${insight.color} rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg`}
                              >
                                <div className="absolute top-0 right-0 w-20 h-20 sm:w-32 sm:h-32 bg-white/20 rounded-full blur-2xl" />
                                <div className="absolute bottom-0 left-0 w-16 h-16 sm:w-24 sm:h-24 bg-white/20 rounded-full blur-xl" />
                                
                                <div className="relative">
                                  <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                    <span className="text-xl sm:text-2xl">{insight.icon}</span>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-white/30 rounded text-[10px] sm:text-xs font-bold text-white">
                                          {insight.type}案
                                        </span>
                                        <span className="text-white text-xs sm:text-sm font-medium">
                                          {insight.title}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <h4 className="font-bold text-white text-xs sm:text-sm mb-2">
                                    💡 このバナーの工夫点
                                  </h4>
                                  <ul className="space-y-1.5 sm:space-y-2">
                                    {insight.features.map((feature, idx) => (
                                      <li key={idx} className="flex items-start gap-2 text-white text-[11px] sm:text-xs">
                                        <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white flex-shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </motion.div>
                            )
                          })()}
                          
                          {/* 画像プレビュー・操作エリア */}
                          <div className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-3 sm:p-4 shadow-sm">
                          <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base text-gray-900">
                              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                              {['A', 'B', 'C'][selectedBanner]}案 プレビュー
                            </h3>
                            <div className="flex gap-2">
                              {refineHistory.length > 0 && (
                                <button
                                  onClick={handleUndoRefine}
                                  className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 text-gray-500 rounded-lg text-xs hover:bg-gray-200 hover:text-gray-700 transition-colors"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  戻す
                                </button>
                              )}
                              <button
                                onClick={() => setShowRefineInput(!showRefineInput)}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                  showRefineInput 
                                    ? 'bg-fuchsia-100 text-fuchsia-700' 
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                修正
                              </button>
                              <button
                                onClick={() => handleDownload(generatedBanners[selectedBanner], selectedBanner)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-sm hover:bg-violet-200 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                DL
                              </button>
                            </div>
                          </div>
                          
                          {/* プレビュー画像 */}
                          <div className="rounded-xl overflow-hidden mb-3 shadow-md">
                            <div className="relative" ref={overlayPreviewRef}>
                              <img 
                                ref={overlayImgRef}
                                src={generatedBanners[selectedBanner]} 
                                alt="Selected Banner" 
                                className="w-full"
                                onLoad={() => {
                                  const el = overlayImgRef.current
                                  if (el) setOverlayPreviewBox({ w: el.clientWidth || 0, h: el.clientHeight || 0 })
                                }}
                              />
                              
                              {/* Text Layer Preview (独自性) */}
                              {showTextOverlay && (
                                <div className="absolute inset-0 pointer-events-none">
                                  <div
                                    className="absolute overflow-hidden"
                                    style={{
                                      left: `${overlayPreviewMetrics.panelX}px`,
                                      top: `${overlayPreviewMetrics.panelY}px`,
                                      width: `${overlayPreviewMetrics.panelW}px`,
                                      height: `${overlayPreviewMetrics.panelH}px`,
                                      backgroundColor: overlayBgColor,
                                      opacity: clamp(overlayBgOpacity, 0, 100) / 100,
                                      borderRadius: `${overlayPreviewMetrics.radius}px`,
                                    }}
                                  >
                                    <div
                                      style={{
                                        padding: `${overlayPreviewMetrics.textPadTop}px ${overlayPreviewMetrics.textPadX}px`,
                                      }}
                                    >
                                      <div
                                        className="font-black leading-tight"
                                        style={{
                                          color: overlayTextColor,
                                          fontSize: `${overlayPreviewMetrics.baseFont}px`,
                                          fontFamily: OVERLAY_FONT_FAMILY_CSS,
                                          fontWeight: 900,
                                          lineHeight: 1.1,
                                          maxWidth: `${overlayPreviewMetrics.maxTextWidth}px`,
                                          display: '-webkit-box',
                                          WebkitLineClamp: 2,
                                          WebkitBoxOrient: 'vertical',
                                          overflow: 'hidden',
                                        }}
                                      >
                                        {overlayHeadline || ' '}
                                      </div>
                                      {overlaySubhead && (
                                        <div
                                          className="font-semibold opacity-90"
                                          style={{
                                            color: overlayTextColor,
                                            fontSize: `${overlayPreviewMetrics.subFont}px`,
                                            fontFamily: OVERLAY_FONT_FAMILY_CSS,
                                            fontWeight: 700,
                                            marginTop: `${Math.round(overlayPreviewMetrics.baseFont * 0.12)}px`,
                                            maxWidth: `${overlayPreviewMetrics.maxTextWidth}px`,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                          }}
                                        >
                                          {overlaySubhead}
                                        </div>
                                      )}
                                      {overlayCta && (
                                        <div
                                          className="flex justify-end"
                                          style={{ marginTop: `${Math.round(overlayPreviewMetrics.baseFont * 0.18)}px` }}
                                        >
                                          <div
                                            className="rounded-full font-black"
                                            style={{
                                              color: overlayTextColor,
                                              backgroundColor: 'rgba(255,255,255,0.14)',
                                              fontSize: `${overlayPreviewMetrics.ctaFont}px`,
                                              fontFamily: OVERLAY_FONT_FAMILY_CSS,
                                              fontWeight: 900,
                                              padding: `${Math.round(overlayPreviewMetrics.panelH * 0.08)}px ${Math.round(overlayPreviewMetrics.panelW * 0.04)}px`,
                                            }}
                                          >
                                            {overlayCta}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 独自性：テキストレイヤー編集＆合成DL */}
                          <div className="border-t border-gray-100 pt-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Pencil className="w-4 h-4 text-violet-600" />
                                <span className="text-sm font-bold text-gray-900">テキストレイヤー（アプリ独自）</span>
                                <span className="text-[11px] text-gray-500 hidden sm:inline">日本語文字化け対策にも◎</span>
                              </div>
                              <button
                                onClick={() => setShowTextOverlay(!showTextOverlay)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  showTextOverlay ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                              >
                                {showTextOverlay ? 'ON' : 'OFF'}
                              </button>
                            </div>

                            {showTextOverlay && (
                              <div className="space-y-2">
                                <input
                                  value={overlayHeadline}
                                  onChange={(e) => setOverlayHeadline(e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                                  placeholder="見出し（例: 月額990円〜 乗り換えで最大2万円）"
                                />
                                <input
                                  value={overlaySubhead}
                                  onChange={(e) => setOverlaySubhead(e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                                  placeholder="サブ（任意）"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    value={overlayCta}
                                    onChange={(e) => setOverlayCta(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                                    placeholder="CTA（例: 詳しくはこちら）"
                                  />
                                  <select
                                    value={overlayPosition}
                                    onChange={(e) => setOverlayPosition(e.target.value as any)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900"
                                  >
                                    <option value="bottom">下</option>
                                    <option value="center">中央</option>
                                  </select>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                  <div className="col-span-2 flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    <span className="text-xs font-bold text-gray-600">サイズ</span>
                                    <input
                                      type="range"
                                      min={0.8}
                                      max={1.5}
                                      step={0.05}
                                      value={overlayFontScale}
                                      onChange={(e) => setOverlayFontScale(Number(e.target.value))}
                                      className="w-full"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
                                    <span className="text-xs font-bold text-gray-600">濃さ</span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={overlayBgOpacity}
                                      onChange={(e) => setOverlayBgOpacity(Number(e.target.value))}
                                      className="w-14 bg-transparent text-sm font-bold text-gray-900 outline-none"
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    onClick={() => {
                                      const d = buildDefaultOverlay(keyword, purpose)
                                      setOverlayHeadline(d.headline)
                                      setOverlaySubhead(d.subhead)
                                      setOverlayCta(d.cta)
                                    }}
                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded-lg font-bold"
                                  >
                                    自動セット
                                  </button>
                                  {createCopyVariants(keyword, purpose).map((v) => (
                                    <button
                                      key={v}
                                      onClick={() => setOverlayHeadline(v)}
                                      className="px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs rounded-lg font-bold"
                                    >
                                      {v.length > 18 ? `${v.slice(0, 18)}…` : v}
                                    </button>
                                  ))}
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={() => downloadWithTextOverlay(generatedBanners[selectedBanner])}
                                    className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors"
                                  >
                                    テキスト入りでDL（合成）
                                  </button>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText([overlayHeadline, overlaySubhead, overlayCta].filter(Boolean).join('\n'))
                                      toast.success('テキストをコピーしました')
                                    }}
                                    className="px-3 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-sm hover:bg-gray-200 transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 修正入力フォーム */}
                          <AnimatePresence>
                            {showRefineInput && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="pt-3 border-t border-gray-100">
                                  <div className="flex items-center gap-2 mb-2">
                                    <MessageSquare className="w-4 h-4 text-fuchsia-500" />
                                    <span className="text-sm font-medium text-gray-800">AIに修正指示</span>
                                  </div>
                                  <div className="relative">
                                    <textarea
                                      value={refineInstruction}
                                      onChange={(e) => setRefineInstruction(e.target.value)}
                                      placeholder="例: 背景を青に変更して、文字をもっと大きくして"
                                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-100 outline-none transition-all resize-none text-sm pr-12"
                                      rows={2}
                                      maxLength={200}
                                      disabled={isRefining}
                                    />
                              <button
                                onClick={() => handleRefine()}
                                      disabled={isRefining || !refineInstruction.trim()}
                                      className="absolute right-2 bottom-2 w-8 h-8 bg-gradient-to-r from-fuchsia-500 to-violet-500 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {isRefining ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Send className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {[
                                      '背景を変更',
                                      '文字を大きく',
                                      '色を鮮やかに',
                                      'CTAを目立たせて',
                                      'シンプルに',
                                    ].map((suggestion) => (
                                      <button
                                        key={suggestion}
                                        onClick={() => setRefineInstruction(suggestion)}
                                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-700 text-xs rounded-md transition-colors"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                  {isRefining && (
                                    <div className="mt-3 flex items-center gap-2 text-fuchsia-600 text-sm">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      <span>AIが修正中...</span>
                                    </div>
)}
                                  </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          </div>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-10 h-10 text-violet-500" />
                      </div>
                      <h3 className="font-bold text-lg mb-2 text-gray-900">生成結果がここに表示されます</h3>
                      <p className="text-gray-500 text-sm mb-4">
                        カテゴリとキーワードを入力して<br />
                        「バナーを生成する」をクリック
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['A案', 'B案', 'C案'].map((label) => (
                          <span key={label} className="px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-500">
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
            </motion.div>

            {/* ドヤマーケ CV Banner */}
            <a 
              href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="relative overflow-hidden bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all cursor-pointer"
              >
                <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-16 sm:w-24 h-16 sm:h-24 bg-white/10 rounded-full blur-xl" />
                
                <div className="relative flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-xl sm:text-2xl">💬</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                      <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded text-[9px] sm:text-[10px] font-bold">無料相談</span>
                      <span className="text-white/80 text-[10px] sm:text-xs">by ドヤマーケ</span>
                    </div>
                    <h4 className="font-bold text-white text-xs sm:text-sm mb-0.5 truncate">
                      マーケティングのお悩み、いつでも相談OK！
                    </h4>
                    <p className="text-white/70 text-[10px] sm:text-xs hidden xs:block">
                      バナー制作・広告運用・SNS戦略なんでも →
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                      <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                    </div>
                  </div>
                </div>
              </motion.div>
            </a>

            {/* Quick Links */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Link href="/seo">
                <div className="bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-emerald-400 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <span className="text-xl sm:text-2xl">🔎</span>
                    <span className="font-bold text-xs sm:text-sm text-gray-800">ドヤSEO</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                    SEO記事も作成する →
                  </p>
                </div>
              </Link>
              <Link href="/banner/pricing">
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:border-amber-400 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
                    <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    <span className="font-bold text-xs sm:text-sm text-gray-800">プランを見る</span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500 group-hover:text-gray-700 transition-colors">
                    もっと使いたい方へ →
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* ========================================
          Footer
          ======================================== */}
      <footer className="border-t border-gray-100 mt-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href="/" className="hover:text-gray-900 transition-colors">ポータル</Link>
              <Link href="/seo" className="hover:text-gray-900 transition-colors">ドヤSEO</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">プライバシー</Link>
            </div>
            <p className="text-xs text-gray-400">
              © 2025 ドヤAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Hidden canvas for composite download */}
      <canvas ref={compositeCanvasRef} className="hidden" />

      {/* ========================================
          Generation Fullscreen Overlay (飽きさせない演出)
          ======================================== */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-white/85 backdrop-blur-xl" />
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                className="absolute -top-40 -right-40 w-[520px] h-[520px] bg-gradient-to-br from-violet-300/35 to-fuchsia-300/35 rounded-full blur-3xl"
                animate={{ scale: [1, 1.08, 1], rotate: [0, 18, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -bottom-40 -left-40 w-[520px] h-[520px] bg-gradient-to-br from-cyan-300/30 to-blue-300/30 rounded-full blur-3xl"
                animate={{ scale: [1, 1.06, 1], rotate: [0, -14, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
              />
              {FLOATING_ICONS.map((ic, idx) => (
                <motion.div
                  key={`${ic}-${idx}`}
                  className="absolute text-2xl sm:text-3xl opacity-35"
                  style={{
                    left: `${(idx * 13 + 7) % 90}%`,
                    top: `${(idx * 11 + 10) % 90}%`,
                  }}
                  animate={{ y: [0, -14, 0], rotate: [0, 8, 0], opacity: [0.18, 0.38, 0.18] }}
                  transition={{ duration: 4 + (idx % 3), repeat: Infinity, ease: 'easeInOut' }}
                >
                  {ic}
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative w-[min(640px,92vw)] bg-white border border-gray-200/70 rounded-3xl shadow-2xl shadow-gray-900/10 p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl blur-lg opacity-30" />
                    <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-lg">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 font-semibold">生成中</div>
                    <div className="text-lg sm:text-xl font-black text-gray-900">
                      {GENERATION_PHASES[phaseIndex].icon} {GENERATION_PHASES[phaseIndex].label}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-black text-gray-900 tabular-nums">
                  {Math.round(progress)}%
                </div>
              </div>

              <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600"
                  initial={{ width: '0%' }}
                  animate={{ width: `${clamp(progress, 2, 85)}%` }}
                  transition={{ ease: 'easeOut', duration: 0.4 }}
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {['A', 'B', 'C'].map((k, idx) => (
                  <div
                    key={k}
                    className={`rounded-2xl border px-3 py-2 text-center ${
                      phaseIndex >= 2 + idx ? 'bg-violet-50 border-violet-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="text-xs text-gray-500 font-semibold">パターン</div>
                    <div className="text-base font-black text-gray-900">{k}</div>
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tipIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-5 rounded-2xl bg-gradient-to-r from-violet-50 to-fuchsia-50 border border-violet-200/60 p-4"
                >
                  <div className="text-sm font-bold text-violet-700 flex items-start gap-2">
                    <span className="text-lg leading-none">{GENERATION_TIPS[tipIndex].icon}</span>
                    <span>{GENERATION_TIPS[tipIndex].text}</span>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-semibold">高品質生成中（Nano Banana Pro）</span>
                </div>
                <div className="font-semibold">
                  {elapsedSec >= 25
                    ? '少し時間がかかっています（品質優先で前後します）'
                    : elapsedSec >= 10
                      ? 'A/B/Cを順に生成中…（進捗は目安）'
                      : '最適なデザインを探索中…'}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
