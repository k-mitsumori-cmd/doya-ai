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
  MessageSquare, Send, RotateCcw, Pencil, BarChart3,
  Users, DollarSign, Bell, Settings, Search, ArrowUpDown, ChevronRight,
  TrendingUp, Layers
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getGuestUsage, getUserUsage, incrementUserUsage, setGuestUsage } from '@/lib/pricing'
import { DashboardLayout } from '@/components/DashboardLayout' // New import
import { FeatureGuide } from '@/components/FeatureGuide'
// AIバナーコーチ機能は廃止

// ========================================
// 定数
// ========================================
const CATEGORIES = [
  { 
    value: 'telecom', label: '通信', icon: '📱', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【視線誘導】スマホを持つ手元を強調し、月額料金や「乗り換え0円」などの数字が瞬時に目に入る、コンバージョン重視のレイアウト。',
    sample: '/banner-samples/cat-telecom.png'
  },
  { 
    value: 'marketing', label: 'マーケ', icon: '📊', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【権威性】プロフェッショナルな人物と実績グラフを組み合わせ、「このサービスなら解決できる」という信頼感を醸成するB2B特化スタイル。',
    sample: '/banner-samples/cat-marketing.png'
  },
  { 
    value: 'ec', label: 'EC', icon: '🛒', color: '#F97316', bg: 'from-orange-500/10 to-orange-600/10',
    description: '【購買意欲】商品の質感を大胆に見せつつ、セールバッジや期間限定の赤を効かせた、衝動買いを誘発するダイナミックなデザイン。',
    sample: '/banner-samples/cat-ec.png'
  },
  { 
    value: 'recruit', label: '採用', icon: '👥', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【共感訴求】自然な笑顔のチーム写真を背景に、クリーンな白文字を配置。職場の雰囲気と「自分もここで働きたい」という期待感を高めます。',
    sample: '/banner-samples/cat-recruit.png'
  },
  { 
    value: 'beauty', label: '美容', icon: '💄', color: '#FBBF24', bg: 'from-amber-400/10 to-amber-500/10',
    description: '【憧れ喚起】透明感のある人物アップと洗練された余白。高級感のあるフォントが映える、自分磨きの意欲を刺激するビューティースタイル。',
    sample: '/banner-samples/cat-beauty.png'
  },
  { 
    value: 'food', label: '飲食', icon: '🍽️', color: '#F97316', bg: 'from-orange-500/10 to-orange-600/10',
    description: '【シズル感】料理の「美味しそう」を最大限に引き出す接写構図。食欲を刺激する暖色背景で、店舗予約や注文ボタンへのクリックを促します。',
    sample: '/banner-samples/cat-food.png'
  },
  { 
    value: 'realestate', label: '不動産', icon: '🏠', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【安心・理想】開放感のある内装イメージ。落ち着いたトーンで「一生の買い物」をサポートする誠実さと、理想の暮らしを視覚化します。',
    sample: '/banner-samples/cat-realestate.png'
  },
  { 
    value: 'education', label: '教育', icon: '📚', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【未来への自己投資】真剣に学ぶ姿と明るい光の演出。習得できるスキルをステップ形式で見せる、申し込みへのハードルを下げる構成。',
    sample: '/banner-samples/cat-education.png'
  },
  { 
    value: 'finance', label: '金融', icon: '💰', color: '#FBBF24', bg: 'from-amber-400/10 to-amber-500/10',
    description: '【堅実な資産形成】スマホアプリの操作感と資産増を想起させるアイコン。ダークネイビーと金の対比で、プロフェッショナルな品質を担保。',
    sample: '/banner-samples/cat-finance.png'
  },
  { 
    value: 'health', label: '医療', icon: '🏥', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【清潔感と安全】専門家の優しそうな表情と、機能性を感じさせる青のグラデーション。健康課題の解決をストレートに伝えるデザイン。',
    sample: '/banner-samples/cat-health.png'
  },
  { 
    value: 'it', label: 'IT', icon: '💻', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【先進・スピード】サーバーやネットワークの抽象的な光。デジタル領域での圧倒的な優位性と、最新技術の導入効果をクールに伝えます。',
    sample: '/banner-samples/cat-it.png'
  },
  { 
    value: 'other', label: 'その他', icon: '✨', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '【万能・モダン】特定の業種に縛られない自由なキャンバス。どんなキャッチコピーでも主役になれる、引き算の美学を活かした配置。',
    sample: '/banner-samples/cat-other.png'
  },
]

const PURPOSES = [
  { 
    value: 'sns_ad', label: 'SNS広告', icon: Target, desc: 'FB/IG/X', hot: true,
    sample: '/banner-samples/purpose-sns_ad.png',
    color: '#2563EB',
    description: '【スクロール停止】フィード上で指を止めさせる大胆なビジュアルと、3秒で理解できる明快なCTA配置。'
  },
  { 
    value: 'youtube', label: 'YouTube', icon: Play, desc: 'サムネイル', hot: true,
    sample: '/banner-samples/purpose-youtube.png',
    color: '#2563EB',
    description: '【クリック誘発】表情豊かな人物＋強調文字で「見なきゃ損」感を演出。関連動画の中で埋もれないコントラスト設計。'
  },
  { 
    value: 'display', label: 'ディスプレイ', icon: Layout, desc: 'GDN/YDA', hot: false,
    sample: '/banner-samples/purpose-display.png',
    color: '#2563EB',
    description: '【視認性重視】小さなサイズでも読みやすい太字フォントと、ブランドカラーを活かしたシンプル構成。'
  },
  { 
    value: 'webinar', label: 'ウェビナー', icon: Video, desc: 'セミナー', hot: false,
    sample: '/banner-samples/purpose-webinar.png',
    color: '#2563EB',
    description: '【権威性＋緊急性】登壇者の写真と「参加無料」「残席わずか」で申し込みを後押しするレイアウト。'
  },
  { 
    value: 'lp_hero', label: 'LP', icon: Megaphone, desc: 'ヒーロー', hot: false,
    sample: '/banner-samples/purpose-lp_hero.png',
    color: '#2563EB',
    description: '【ファーストビュー】ページを開いた瞬間に価値提案が伝わる、余白を活かした大胆なヘッドライン配置。'
  },
  { 
    value: 'email', label: 'メール', icon: Mail, desc: 'ヘッダー', hot: false,
    sample: '/banner-samples/purpose-email.png',
    color: '#2563EB',
    description: '【開封後の導線】メール上部で目を引き、本文へスムーズに誘導するシンプルで軽量なデザイン。'
  },
  { 
    value: 'campaign', label: 'セール', icon: Gift, desc: 'キャンペーン', hot: false,
    sample: '/banner-samples/purpose-campaign.png',
    color: '#F97316',
    description: '【衝動喚起】「今だけ」「限定」を強調するバースト装飾と、お得感が一目でわかる価格表示レイアウト。'
  },
]

// サイズ別のイメージとCTRロジック解説
const SIZE_INFO: Record<string, { sample: string; description: string }> = {
  '1080x1080': {
    sample: '/banner-samples/size-1080x1080.png',
    description: '【フィード最適】Instagram/Facebookで最も表示面積が大きく、スクロール中に目を引きやすい正方形。'
  },
  '1200x628': {
    sample: '/banner-samples/size-1200x628.png',
    description: '【OGP/リンク広告】シェア時のプレビューで情報量と視認性のバランスが最も取れた黄金比率。'
  },
  '1080x1920': {
    sample: '/banner-samples/size-1080x1920.png',
    description: '【ストーリー/リール】全画面表示で没入感MAX。スワイプアップを促す縦型レイアウト。'
  },
  '1280x720': {
    sample: '/banner-samples/size-1280x720.png',
    description: '【YouTube HD】関連動画一覧で埋もれない、顔＋テキストのコントラストが効くサムネイル向け。'
  },
  '1920x1080': {
    sample: '/banner-samples/size-1920x1080.png',
    description: '【フルHD】ウェビナーやプレゼン背景に最適。高解像度でプロフェッショナルな印象を与える。'
  },
  '300x250': {
    sample: '/banner-samples/size-300x250.png',
    description: '【レクタングル】GDN/YDAで最も配信量が多いサイズ。限られたスペースで要点を伝える設計。'
  },
  '728x90': {
    sample: '/banner-samples/size-728x90.png',
    description: '【リーダーボード】記事上部に表示されるPC向けバナー。ブランド認知に効果的な横長形式。'
  },
  '320x50': {
    sample: '/banner-samples/size-320x50.png',
    description: '【モバイルバナー】スマホ画面下部に表示。タップしやすいCTAボタン配置が鍵。'
  },
  '1920x600': {
    sample: '/banner-samples/size-1920x600.png',
    description: '【LPワイドヒーロー】ファーストビューを占有し、キャッチコピーを最大限に目立たせるワイド形式。'
  },
  '1200x800': {
    sample: '/banner-samples/size-1200x800.png',
    description: '【LP標準】バランスの良い3:2比率。メインビジュアルとCTAを自然に配置できる。'
  },
  '600x200': {
    sample: '/banner-samples/size-600x200.png',
    description: '【メールヘッダー】開封直後に目に入る最初の要素。ブランドロゴとキャンペーン名を明示。'
  },
  '600x300': {
    sample: '/banner-samples/size-600x300.png',
    description: '【メールバナー】本文中に差し込む訴求画像。クリックを促すボタン風デザインが効果的。'
  },
}

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
        'ポジティブで清潔感のあるデザイン',
        '価値提案を強調したコピー配置',
      ],
      color: 'from-blue-600 to-blue-700',
      icon: '💡',
    },
    {
      type: 'B',
      title: '緊急性・限定訴求',
      features: [
        '「今だけ」「限定」の訴求を強調',
        'オレンジ・黄色のアクセントカラー',
        '行動を促すダイナミックな構成',
      ],
      color: 'from-orange-500 to-amber-500',
      icon: '⚡',
    },
    {
      type: 'C',
      title: '信頼性・実績訴求',
      features: [
        '「No.1」「〇万人利用」などの実績',
        '落ち着いたプロフェッショナルな配色',
        '安心感を与えるグリッドレイアウト',
      ],
      color: 'from-slate-700 to-slate-800',
      icon: '🏆',
    },
  ],
  youtube: [
    {
      type: 'A',
      title: '衝撃・驚きフック',
      features: [
        '好奇心を強く刺激するビジュアル',
        'ドラマチックなコントラスト設計',
        '視線を集める太字ハイライト',
      ],
      color: 'from-blue-700 to-slate-900',
      icon: '😱',
    },
    {
      type: 'B',
      title: '教育・価値提供',
      features: [
        '「〜の方法」「完全解説」の学び訴求',
        '具体性を持たせた数字の強調',
        'ドヤバナーブルーの信頼感カラー',
      ],
      color: 'from-blue-600 to-blue-800',
      icon: '📚',
    },
    {
      type: 'C',
      title: '体験・ストーリー',
      features: [
        '「〜した結果」「密着」の物語性',
        '親しみやすく共感を得るテイスト',
        '暖かみのあるオレンジアクセント',
      ],
      color: 'from-orange-500 to-amber-600',
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
          `【保存版】${head}`,
          `知らないと損… ${head}`,
          `結論：${head}`,
          `【検証】${head}`,
        ]
      : [
          `${head}`,
          `【無料】${head}`,
          `【今だけ】${head}`,
          `失敗しない：${head}`,
          `まずは1分で：${head}`,
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
        ? '【暴露】通信費が月5,000円下がる人の共通点'
        : isCampaign
          ? '【本日限定】乗り換えで最大2万円還元｜月額990円〜'
          : '月額990円〜｜乗り換えで最大2万円還元（今だけ）'
    case 'ec':
      return isYouTube
        ? '【検証】人気No.1を買ってみた結果（ガチレビュー）'
        : '【本日限定】MAX70%OFF｜送料無料で今すぐお得に'
    case 'marketing':
      return isWebinar
        ? '【参加無料】売上を伸ばす広告改善 “即効” 5施策（資料付き）'
        : isLp
          ? '売上を最短で伸ばす。成果直結の広告運用をはじめよう'
          : '【無料診断】広告費のムダを削減してCVを増やす'
    case 'recruit':
      return isYouTube
        ? '【転職】年収が上がる人が“最初に”やること'
        : '【未経験OK】月給30万〜｜面談だけでもOK（今週）'
    case 'beauty':
      return isCampaign
        ? '【初回限定】毛穴・くすみ対策｜今だけ特別価格'
        : '【初回限定】30分で印象UP。人気No.1ケアを体験'
    case 'food':
      return isCampaign
        ? '【本日限定】人気メニューが今だけ20%OFF'
        : '【限定】今週だけの特別メニュー｜クーポン配布中'
    case 'realestate':
      return '【来場特典】理想の住まいが見つかる｜今週末 見学会'
    case 'education':
      return isWebinar
        ? '【無料説明会】3ヶ月でスキル習得｜学習ロードマップ公開'
        : '【無料体験】最短で伸びる学習法、まずは1日で実感'
    case 'finance':
      return '【無料相談】手数料を見直して“毎月のムダ”を削減'
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
        `【検証】${base.replace(/^【[^】]+】/, '')}`,
        `【初心者OK】${base.replace(/^【[^】]+】/, '')}`,
        `【完全解説】${base.replace(/^【[^】]+】/, '')}`,
      ]
    : [
        base,
        `【無料】${base.replace(/^【[^】]+】/, '')}`,
        `【今だけ】${base.replace(/^【[^】]+】/, '')}`,
        `【先着】${base.replace(/^【[^】]+】/, '')}`,
        `失敗しない：${base.replace(/^【[^】]+】/, '')}`,
        `まずは1分で：${base.replace(/^【[^】]+】/, '')}`,
        `【実績】${base.replace(/^【[^】]+】/, '')}`,
        `比較して選ぶ：${base.replace(/^【[^】]+】/, '')}`,
        `今すぐチェック：${base.replace(/^【[^】]+】/, '')}`,
      ]

  const boosts = [
    ...(isCampaign ? ['【本日限定】', '【期間限定】', '【数量限定】', '今だけ'] : []),
    ...(isWebinar ? ['【参加無料】', '【無料ウェビナー】', '【限定公開】', '【資料付き】', '【Q&Aあり】'] : []),
  ]

  const boosted = core.flatMap((s) => {
    const out = [s]
    for (const b of boosts) out.push(`${b}${s.replace(/^【[^】]+】/, '')}`)
    return out
  })

  // さらに「数字/証明/簡単」を混ぜてCTRを底上げ
  const extras = isYouTube
    ? [
        '【3分で理解】',
        '【5選】',
        '【結論だけ】',
      ]
    : [
        '【最短】',
        '【たった1分】',
        '【今すぐ】',
      ]

  const expanded = boosted.flatMap((s) => extras.map((p) => `${p}${s.replace(/^【[^】]+】/, '')}`).concat([s]))

  return uniqStrings(expanded).slice(0, 36)
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
  const [imageDescription, setImageDescription] = useState('') // 詳細テキスト（イメージ説明）
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
  const [overlayBgColor, setOverlayBgColor] = useState('#2563EB') // Doya Banner Blue
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

  // カテゴリホバー/選択用
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  // 用途ホバー用
  const [hoveredPurpose, setHoveredPurpose] = useState<string | null>(null)
  // サイズホバー用
  const [hoveredSize, setHoveredSize] = useState<string | null>(null)

  // 使用カラー（任意・手動指定）
  const [useCustomColors, setUseCustomColors] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [colorDraft, setColorDraft] = useState('#8B5CF6')

  // ギャラリー公開（任意）
  const [shareToGallery, setShareToGallery] = useState(false)
  const [shareProfile, setShareProfile] = useState(false)

  // 生成履歴（ローカルストレージから読み込み）
  interface HistoryItem {
    id: string
    category: string
    keyword: string
    size: string
    createdAt: string
    banners: string[]
  }
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([])

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

  // 生成履歴をローカルストレージから読み込み
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem('banner_history')
      if (stored) {
        const parsed = JSON.parse(stored) as HistoryItem[]
        // 最新3件のみ取得（表示用）
        setRecentHistory(parsed.slice(0, 3))
      }
    } catch {
      setRecentHistory([])
    }
  }, [generatedBanners.length]) // 生成後も更新

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

    // 上限に達している場合はプロプランへ誘導
    if (remainingCount <= 0) {
      toast.error('本日の上限に達しました。プロプランにアップグレードしてください。', { duration: 6000 })
      try {
        const upgradeUrl = '/banner/pricing'
        window.open(upgradeUrl, '_self')
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
          imageDescription: imageDescription.trim() || undefined,
          logoImage: logoImage || undefined,
          personImage: personImage || undefined,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
          brandColors: useCustomColors
            ? uniqStrings(customColors.map((c) => normalizeHexClient(c) || '').filter(Boolean)).slice(0, 8)
            : undefined,
          shareToGallery: shareToGallery && !isGuest ? true : undefined,
          shareProfile: shareToGallery && !isGuest ? (shareProfile ? true : false) : undefined,
        }),
      })

      const data = await response.json()
      
      if (!response.ok) throw new Error(data.error || '生成に失敗しました')
      
      setProgress(100)
      await new Promise(r => setTimeout(r, 500))
      setGeneratedBanners(data.banners || [])
      
      if (isGuest) {
        const serverUsed = Number(data?.usage?.dailyUsed)
        if (Number.isFinite(serverUsed)) {
          setGuestUsageCount(serverUsed)
          setGuestUsage('banner', serverUsed)
        } else {
          const newCount = guestUsageCount + 1
          setGuestUsageCount(newCount)
          setGuestUsage('banner', newCount)
        }
      } else {
        const serverUsed = Number(data?.usage?.dailyUsed)
        if (Number.isFinite(serverUsed)) {
          setUserUsageCount(serverUsed)
        } else {
          const newCount = incrementUserUsage('banner')
          setUserUsageCount(newCount)
        }
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
      link.download = `bunridge-banner-text-${Date.now()}.png`
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
      // CTR特化：AIで12案生成 → ローカルテンプレと合流して“切り替え可能”にする
      setIsSuggestingCopy(true)
      const base = keyword.trim()
      const local = buildHighCtrSampleCopies(category, purpose)

      let ai: string[] = []
      try {
        const res = await fetch('/api/banner/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category,
            purpose,
            base: base || undefined,
            companyName: companyName.trim() || undefined,
          }),
        })
        const data = await res.json()
        if (res.ok && Array.isArray(data?.suggestions)) {
          ai = data.suggestions.filter((s: any) => typeof s === 'string')
        }
      } catch {
        // ignore (fallback to local)
      }

      const boosts = base
        ? uniqStrings([
            base,
            `【今だけ】${base.replace(/^【[^】]+】/, '')}`,
            `【無料】${base.replace(/^【[^】]+】/, '')}`,
            `【先着】${base.replace(/^【[^】]+】/, '')}`,
            `失敗しない：${base.replace(/^【[^】]+】/, '')}`,
            `まずは1分で：${base.replace(/^【[^】]+】/, '')}`,
          ])
        : []

      const pool = uniqStrings([...ai, ...boosts, ...local]).slice(0, 24)

      setAiSampleKey(key)
      setAiSamplePool(pool)
      setAiSampleIndex(0)
      setKeyword(pool[0] || local[0] || '')
      toast.success(`クリックされやすいサンプルを入力しました（1/${Math.max(1, pool.length)}）`, { icon: '✅' })
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
    link.download = `bunridge-banner-${['A', 'B', 'C'][index]}-${Date.now()}.png`
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
    <DashboardLayout>
      <div className="text-gray-900 relative">
        {/* Page Background Accent */}
        <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none -z-10" />
        
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
            Main Content
            ======================================== */}
        <div className="grid lg:grid-cols-[1fr,440px] gap-6 sm:gap-10">
          
          {/* ========================================
              Left Column - Input Form
              ======================================== */}
          <div className="space-y-6">
            
            {/* Hero Card - Professional */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative bg-white rounded-[2rem] border border-blue-50 p-8 sm:p-10 shadow-sm overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60" />
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider mb-6">
                    <Sparkles className="w-3.5 h-3.5" />
                    ドヤバナーAI Engine v2.0
                  </div>
                  
                  <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-4 tracking-tighter leading-tight">
                    プロ品質のバナーを
                    <br />
                    <span className="text-blue-600">
                      数クリックで自動生成
                    </span>
                  </h2>
                  
                  <p className="text-slate-400 text-sm sm:text-base max-w-md font-medium">
                    最新のAIエンジンが、あなたのビジネスに最適な高CTRバナーを3パターン提案します。
                  </p>
                </div>
                
                <div className="flex-shrink-0 grid grid-cols-2 gap-3">
                  {[
                    { label: '高CTR', icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: '爆速生成', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
                    { label: '修正自在', icon: Wand2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
                    { label: 'マルチサイズ', icon: Layers, color: 'text-indigo-500', bg: 'bg-indigo-50' },
                  ].map((f) => (
                    <div key={f.label} className={`${f.bg} p-3 rounded-2xl flex flex-col items-center justify-center text-center w-24 h-24 transition-transform hover:scale-105 cursor-default`}>
                      <f.icon className={`w-6 h-6 ${f.color} mb-2`} />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Step 1: Purpose */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:rotate-3 transition-transform">
                    01
                  </div>
                  <div>
                    <h2 className="font-bold text-2xl text-slate-800 tracking-tight">用途を選択</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Channel Strategy</p>
                  </div>
                </div>
                <button 
                  onClick={handleSample}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl transition-all text-sm font-bold border border-slate-200 shadow-sm active:scale-95"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>サンプル入力</span>
                </button>
              </div>
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="grid grid-cols-4 gap-3">
                  {PURPOSES.map((p) => {
                    const Icon = p.icon
                    const isSelected = purpose === p.value
                    return (
                      <button
                        key={p.value}
                        onClick={() => setPurpose(p.value)}
                        className={`relative p-4 rounded-2xl text-center transition-all group ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-blue-600'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                        <span className="text-[10px] font-black block truncate uppercase tracking-tighter">{p.label}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-center">
                  {purpose ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                        <Target className="w-3.5 h-3.5" /> Recommended Strategy
                      </div>
                      <h3 className="text-slate-800 font-bold text-sm">{PURPOSES.find(p => p.value === purpose)?.label}特化レイアウト</h3>
                      <p className="text-slate-500 text-[11px] leading-relaxed font-medium">
                        {PURPOSES.find(p => p.value === purpose)?.description}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                        <ArrowRight className="w-5 h-5 text-slate-300" />
                      </div>
                      <p className="text-slate-400 text-[11px] font-bold italic">用途を選択すると戦略が表示されます</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Step 2: Category */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:rotate-3 transition-transform">
                  02
                </div>
                <div>
                  <h2 className="font-bold text-2xl text-slate-800 tracking-tight">業種を選択</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Industry Design</p>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr,280px] gap-8">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {CATEGORIES.map((cat) => {
                    const isSelected = category === cat.value
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value)}
                        className={`p-3 rounded-2xl text-center transition-all group/btn active:scale-95 ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 ring-2 ring-blue-600 ring-offset-2' 
                            : 'bg-slate-50 text-slate-500 hover:bg-white hover:text-blue-600 hover:shadow-lg border border-transparent hover:border-blue-100'
                        }`}
                      >
                        <span className={`text-2xl block mb-1 transition-transform group-hover/btn:scale-110 ${isSelected ? 'scale-110' : ''}`}>{cat.icon}</span>
                        <span className="text-[10px] font-black block truncate uppercase tracking-tighter">{cat.label}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-center">
                  {category ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                        <Palette className="w-3.5 h-3.5" /> Color Palette & Strategy
                      </div>
                      <h3 className="text-slate-800 font-bold text-base">{CATEGORIES.find(c => c.value === category)?.label}向けの推奨配色</h3>
                      <div className="flex items-center gap-2">
                        {CATEGORIES.find(c => c.value === category)?.bg?.split(' ').map((cl, idx) => (
                          <div key={idx} className={`w-8 h-8 rounded-full shadow-sm bg-gradient-to-br ${cl} border border-white/20`} />
                        ))}
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed font-bold mt-2">
                        {CATEGORIES.find(c => c.value === category)?.description}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-400 text-[11px] font-bold italic text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Palette className="w-5 h-5 text-slate-200" />
                      </div>
                      業種を選択すると<br />推奨配色が表示されます
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Step 3: Size */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:rotate-3 transition-transform">
                    03
                  </div>
                  <div>
                    <h2 className="font-bold text-2xl text-slate-800 tracking-tight">サイズを選択</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Canvas Dimensions</p>
                  </div>
                </div>
                <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                  <button 
                    onClick={() => setUseCustomSize(false)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${!useCustomSize ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    PRESET
                  </button>
                  <button 
                    onClick={() => setUseCustomSize(true)}
                    className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all uppercase ${useCustomSize ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    CUSTOM
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr,280px] gap-8 mt-8">
                <div className="space-y-4">
                  <AnimatePresence mode="wait">
                    {useCustomSize ? (
                      <motion.div
                        key="custom"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Width (px)</label>
                            <input
                              type="number"
                              value={customWidth}
                              onChange={(e) => setCustomWidth(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-lg font-black focus:border-blue-600 focus:bg-white outline-none transition-all"
                            />
                          </div>
                          <div className="pt-6 text-slate-300 font-black">×</div>
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Height (px)</label>
                            <input
                              type="number"
                              value={customHeight}
                              onChange={(e) => setCustomHeight(e.target.value)}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-lg font-black focus:border-blue-600 focus:bg-white outline-none transition-all"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="preset"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-wrap gap-2"
                      >
                        {currentSizes.map((s) => {
                          const isSelected = size === s.value
                          return (
                            <button
                              key={s.value}
                              onClick={() => setSize(s.value)}
                              className={`px-4 py-3 rounded-xl border transition-all text-xs font-black uppercase tracking-tighter ${
                                isSelected 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' 
                                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                              }`}
                            >
                              {s.label} <span className="opacity-60 ml-1">{s.ratio}</span>
                            </button>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-center items-center text-center">
                  <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center justify-center mb-4 overflow-hidden relative">
                    <div 
                      className="bg-blue-600/10 border border-blue-600/20 rounded-sm"
                      style={{
                        width: useCustomSize 
                          ? `${Math.min(48, 48 * (parseInt(customWidth) || 1) / (parseInt(customHeight) || 1))}px` 
                          : `${Math.min(48, 48 * (SIZE_INFO[size]?.w || 1) / (SIZE_INFO[size]?.h || 1))}px`,
                        height: useCustomSize 
                          ? `${Math.min(48, 48 * (parseInt(customHeight) || 1) / (parseInt(customWidth) || 1))}px` 
                          : `${Math.min(48, 48 * (SIZE_INFO[size]?.h || 1) / (SIZE_INFO[size]?.w || 1))}px`,
                      }}
                    />
                  </div>
                  <p className="text-slate-800 font-black text-sm">
                    {useCustomSize ? `${customWidth} × ${customHeight}` : size}
                  </p>
                  <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase">Aspect Ratio Preview</p>
                </div>
              </div>
            </motion.div>

            {/* Step 4: Keyword & Description */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white rounded-[2rem] border border-gray-100 p-8 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center text-white font-black text-xl shadow-xl group-hover:rotate-3 transition-transform">
                    04
                  </div>
                  <div>
                    <h2 className="font-bold text-2xl text-slate-800 tracking-tight">内容とイメージ</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em]">Message & Visuals</p>
                  </div>
                </div>

                <button
                  onClick={handleSmartCopySample}
                  disabled={isSuggestingCopy}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all text-xs font-black uppercase shadow-lg shadow-blue-200 disabled:opacity-60 active:scale-95"
                >
                  {isSuggestingCopy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  <span>AI Copy Assist</span>
                </button>
              </div>
              
              <div className="space-y-8">
                {/* Catchphrase */}
                <div className="relative group/input">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-[0.2em] ml-1">Catchphrase</label>
                  <textarea
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="例: 月額990円〜 乗り換えで最大2万円キャッシュバック"
                    className="w-full px-6 py-6 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-300 focus:border-blue-600 focus:bg-white outline-none transition-all resize-none text-lg font-black leading-relaxed shadow-inner min-h-[140px]"
                    maxLength={200}
                  />
                  <div className="absolute bottom-4 right-6 text-[10px] font-black text-slate-300 uppercase tracking-widest bg-white/50 backdrop-blur-sm px-2 py-1 rounded-md border border-white/50">
                    {keyword.length} / 200
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {createCopyVariants(keyword, purpose).map((v) => (
                    <button
                      key={v}
                      onClick={() => setKeyword(v)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] rounded-xl font-bold border border-blue-100 transition-all active:scale-95 shadow-sm"
                    >
                      {v.length > 25 ? v.slice(0, 25) + '...' : v}
                    </button>
                  ))}
                </div>

                {/* Visual Description */}
                <div className="pt-8 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-[0.2em] ml-1 flex items-center gap-2">
                    Visual Description <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded tracking-normal">Optional</span>
                  </label>
                  <textarea
                    value={imageDescription}
                    onChange={(e) => setImageDescription(e.target.value)}
                    placeholder="例: 青空の下で笑顔でジャンプする若い女性、モダンなオフィスで働くビジネスマン..."
                    className="w-full px-6 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-300 focus:border-blue-600 focus:bg-white outline-none transition-all resize-none text-base font-bold leading-relaxed shadow-inner min-h-[100px]"
                  />
                  <div className="flex flex-wrap gap-2 mt-4">
                    {[
                      { text: '笑顔の人物', icon: '😊' },
                      { text: 'モダンなオフィス', icon: '🏢' },
                      { text: 'スマホを操作', icon: '📱' },
                      { text: '未来的・デジタル', icon: '✨' },
                    ].map((tag) => (
                      <button
                        key={tag.text}
                        onClick={() => setImageDescription(prev => prev ? `${prev}、${tag.text}` : tag.text)}
                        className="px-4 py-2 bg-white hover:bg-blue-50 text-slate-500 hover:text-blue-600 text-[10px] font-black rounded-xl transition-all border border-slate-200 hover:border-blue-200 shadow-sm flex items-center gap-1.5"
                      >
                        <span>{tag.icon}</span>
                        <span>{tag.text}</span>
                      </button>
                    ))}
                  </div>
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
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50">
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
                            <label className="flex flex-col items-center justify-center aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50">
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

                      <label className="flex items-center justify-center w-full h-12 rounded-xl border-2 border-dashed border-gray-200 hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50">
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
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                            }`}
                          >
                            {useCustomColors ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-col sm:flex-row gap-2">
                          <input
                            type="color"
                            value={normalizeHexClient(colorDraft) || '#2563EB'}
                            onChange={(e) => setColorDraft(e.target.value)}
                            className="h-12 w-16 rounded-xl border border-gray-200 bg-white p-1"
                            aria-label="color picker"
                          />
                          <input
                            value={colorDraft}
                            onChange={(e) => setColorDraft(e.target.value)}
                            placeholder="#2563EB"
                            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all font-mono"
                          />
                          <button
                            onClick={() => {
                              const hex = normalizeHexClient(colorDraft)
                              if (!hex) {
                                toast.error('HEX形式（例: #2563EB）で入力してください')
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
            <div className="pt-10">
              {/* Share to Gallery */}
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-800">ギャラリーに公開</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      他のユーザーが見られる「公開ギャラリー」に掲載します（デフォルトOFF）。
                      {isGuest ? ' 公開にはログインが必要です。' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (isGuest) {
                        toast.error('ギャラリー公開にはログインが必要です')
                        return
                      }
                      const next = !shareToGallery
                      setShareToGallery(next)
                      if (!next) setShareProfile(false)
                    }}
                    className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                      shareToGallery && !isGuest ? 'bg-blue-600' : 'bg-slate-200'
                    } ${isGuest ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-pressed={shareToGallery && !isGuest}
                    disabled={isGuest}
                  >
                    <span
                      className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
                        shareToGallery && !isGuest ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {shareToGallery && !isGuest && (
                  <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-slate-50 border border-slate-100 p-3">
                    <div>
                      <p className="text-xs font-black text-slate-700">プロフィール名も表示</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">OFFのままだと匿名で表示されます。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShareProfile((v) => !v)}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                        shareProfile ? 'bg-slate-900' : 'bg-slate-300'
                      }`}
                      aria-pressed={shareProfile}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                          shareProfile ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={handleGenerate}
                disabled={isGenerating || !canGenerate}
                className={`group w-full py-6 rounded-[2rem] font-black text-xl transition-all flex items-center justify-center gap-4 relative overflow-hidden active:scale-[0.98] ${
                  canGenerate && !isGenerating
                    ? 'bg-slate-900 text-white shadow-2xl shadow-slate-900/30 hover:shadow-blue-600/40 hover:bg-blue-600'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                }`}
              >
                {isGenerating ? (
                  <>
                    <div className="absolute inset-0 bg-slate-900" />
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 transition-all duration-300"
                      style={{ clipPath: `inset(0 ${100 - progress}% 0 0)` }}
                    />
                    <div className="relative flex items-center gap-4">
                      <Loader2 className="w-7 h-7 animate-spin text-white" />
                      <span className="text-lg uppercase tracking-widest">{GENERATION_PHASES[phaseIndex].label}</span>
                      <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-black tabular-nums">{Math.round(progress)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Sparkles className="w-7 h-7" />
                    </div>
                    <span className="tracking-tight">プロ品質バナーを生成する</span>
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {!isGenerating && remainingCount <= 0 && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm text-center font-medium">
                  本日の使用回数上限に達しました。
                  {isGuest ? (
                    <span className="ml-1">ログインしてプランをご確認ください。</span>
                  ) : (
                    <span className="ml-1">プロプランにアップグレードしてください。</span>
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
            </div>
            </motion.div>
          </div>

          {/* ========================================
              Right Column - Results
              ======================================== */}
          <div className="space-y-6">
            {/* Recent History (when no generation result) */}
            {generatedBanners.length === 0 && recentHistory.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    RECENT ACTIVITY
                  </h3>
                  <Link href="/banner/dashboard/history" className="text-[10px] font-black text-blue-600 hover:text-blue-700 tracking-widest uppercase">
                    VIEW ALL →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {recentHistory.slice(0, 3).map((item) => (
                    <div key={item.id} className="group cursor-pointer">
                      {item.banners?.[0] && (
                        <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm group-hover:shadow-md transition-all">
                          <img
                            src={item.banners[0]}
                            alt={item.keyword}
                            className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all"
                          />
                          <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ArrowUpRight className="w-5 h-5 text-white" />
                          </div>
                        </div>
                      )}
                      <p className="text-[9px] font-bold text-slate-400 mt-2 truncate px-1">{item.keyword}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
                  {generatedBanners.length > 0 ? (
                    <>
                      {/* Integrated Action Card */}
                      <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-full blur-3xl" />
                        <div className="relative z-10 flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-white font-black text-sm mb-1 tracking-tight">GENERATION COMPLETE</h3>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                              A/B/C 3つの異なる戦略に基づいたバナーを生成しました。気に入ったバナーを選択してダウンロード、またはAIチャットで微調整が可能です。
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Banner Grid - Professional Presentation */}
                      <div className="grid grid-cols-3 gap-3">
                        {generatedBanners.map((banner, i) => {
                          const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                          const insight = insights[i]
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.1 }}
                              onClick={() => setSelectedBanner(i)}
                              className={`relative aspect-square rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 border-2 ${
                                selectedBanner === i 
                                  ? 'border-blue-600 shadow-xl shadow-blue-600/20 scale-105 z-10' 
                                  : 'border-white shadow-sm hover:border-slate-200'
                              }`}
                            >
                              <img src={banner} alt={`Banner ${i + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-slate-100 flex items-center gap-1.5">
                                <span className="text-xs">{insight.icon}</span>
                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">{insight.type}</span>
                              </div>
                              <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                修正
                              </button>
                              <button
                                onClick={() => handleDownload(generatedBanners[selectedBanner], selectedBanner)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                <Download className="w-4 h-4" />
                                ダウンロード
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
                                <Pencil className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-bold text-gray-900">テキストレイヤー（アプリ独自）</span>
                                <span className="text-[11px] text-gray-500 hidden sm:inline">日本語文字化け対策にも◎</span>
                              </div>
                              <button
                                onClick={() => setShowTextOverlay(!showTextOverlay)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                  showTextOverlay ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                                  placeholder="見出し（例: 月額990円〜 乗り換えで最大2万円）"
                                />
                                <input
                                  value={overlaySubhead}
                                  onChange={(e) => setOverlaySubhead(e.target.value)}
                                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
                                  placeholder="サブ（任意）"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    value={overlayCta}
                                    onChange={(e) => setOverlayCta(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none"
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
                                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs rounded-lg font-bold"
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
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-medium text-gray-800">AIに修正指示</span>
                                  </div>
                                  <div className="relative">
                                    <textarea
                                      value={refineInstruction}
                                      onChange={(e) => setRefineInstruction(e.target.value)}
                                      placeholder="例: 背景を青に変更して、文字をもっと大きくして"
                                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none text-sm pr-12"
                                      rows={2}
                                      maxLength={200}
                                      disabled={isRefining}
                                    />
                              <button
                                onClick={() => handleRefine()}
                                      disabled={isRefining || !refineInstruction.trim()}
                                      className="absolute right-2 bottom-2 w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-600 rounded-lg flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    <div className="mt-3 flex items-center gap-2 text-blue-700 text-sm">
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
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-100 flex items-center justify-center mx-auto mb-4">
                        <ImageIcon className="w-10 h-10 text-blue-500" />
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

           {/* CV Banner */}
           <a 
             href="https://doyamarke.surisuta.jp/download/base02_doyamarke-free-1" 
             target="_blank" 
             rel="noopener noreferrer"
           >
             <motion.div
               whileHover={{ scale: 1.02 }}
               className="relative overflow-hidden bg-gradient-to-r from-blue-500 via-blue-500 to-blue-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all cursor-pointer"
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
                     <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                   </div>
                 </div>
               </div>
             </motion.div>
           </a>
          </div>
        </div>


      {/* ========================================
          Footer
          ======================================== */}
      <footer className="border-t border-gray-100 mt-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href="/banner" className="hover:text-gray-900 transition-colors">ドヤバナーAIポータル</Link>
              <Link href="/terms" className="hover:text-gray-900 transition-colors">利用規約</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition-colors">プライバシー</Link>
            </div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
              © 2025 ドヤバナーAI. All rights reserved.
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
                className="absolute -top-40 -right-40 w-[520px] h-[520px] bg-gradient-to-br from-blue-300/35 to-blue-300/35 rounded-full blur-3xl"
                animate={{ scale: [1, 1.08, 1], rotate: [0, 18, 0] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute -bottom-40 -left-40 w-[520px] h-[520px] bg-gradient-to-br from-blue-300/30 to-blue-300/30 rounded-full blur-3xl"
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
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-600 rounded-2xl blur-lg opacity-30" />
                    <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
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
                  className="h-full bg-gradient-to-r from-blue-600 via-blue-600 to-blue-600"
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
                      phaseIndex >= 2 + idx ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
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
                  className="mt-5 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-50 border border-blue-200/70 p-4"
                >
                  <div className="text-sm font-bold text-blue-800 flex items-start gap-2">
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
    </DashboardLayout>
  )
}
