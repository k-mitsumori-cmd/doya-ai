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
  Users, DollarSign, Settings, Search, ArrowUpDown, ChevronRight,
  TrendingUp, Layers, Link2
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'
import { BANNER_PRICING, HIGH_USAGE_CONTACT_URL, getBannerDailyLimitByUserPlan, getGuestUsage, getUserUsage, incrementUserUsage, setGuestUsage } from '@/lib/pricing'
import { DashboardLayout } from '@/components/DashboardLayout' // New import
import { FeatureGuide } from '@/components/FeatureGuide'
import { CheckoutButton } from '@/components/CheckoutButton'
// AIバナーコーチ機能は廃止

// ========================================
// 定数
// ========================================
const CATEGORIES = [
  { 
    value: 'telecom', label: '通信', icon: '📱', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ スマホを持つ手元をメインビジュアルに\n✓ 月額料金・割引額を大きく目立たせる\n✓ 「乗り換え0円」等の数字訴求を配置\n✓ 今すぐ申し込めるCTAボタンを強調',
    sample: '/banner-samples/cat-telecom.png'
  },
  { 
    value: 'marketing', label: 'マーケ', icon: '📊', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ プロフェッショナルな人物写真を使用\n✓ 実績グラフ・数値データを見せる\n✓ 「導入○○社」等の権威性を強調\n✓ B2B向けの信頼感あるトーン',
    sample: '/banner-samples/cat-marketing.png'
  },
  { 
    value: 'ec', label: 'EC', icon: '🛒', color: '#F97316', bg: 'from-orange-500/10 to-orange-600/10',
    description: '✓ 商品の質感・細部を大胆にアップ\n✓ セールバッジ・期間限定の赤を効かせる\n✓ 「本日限り」等の緊急性を訴求\n✓ 衝動買いを誘発する配色',
    sample: '/banner-samples/cat-ec.png'
  },
  { 
    value: 'recruit', label: '採用', icon: '👥', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ 笑顔のチームメンバー写真を使用\n✓ 職場の雰囲気が伝わる背景\n✓ 「働きやすさ」を視覚的に表現\n✓ 共感と期待感を高めるコピー',
    sample: '/banner-samples/cat-recruit.png'
  },
  { 
    value: 'beauty', label: '美容', icon: '💄', color: '#FBBF24', bg: 'from-amber-400/10 to-amber-500/10',
    description: '✓ 透明感のある人物アップショット\n✓ 洗練された余白で高級感を演出\n✓ ビフォーアフターを効果的に配置\n✓ 「自分磨き」意欲を刺激するコピー',
    sample: '/banner-samples/cat-beauty.png'
  },
  { 
    value: 'food', label: '飲食', icon: '🍽️', color: '#F97316', bg: 'from-orange-500/10 to-orange-600/10',
    description: '✓ 料理の接写で「シズル感」を最大化\n✓ 暖色背景で食欲を刺激\n✓ 湯気・ツヤ等のリアルな質感\n✓ 予約・注文への導線を明確に',
    sample: '/banner-samples/cat-food.png'
  },
  { 
    value: 'realestate', label: '不動産', icon: '🏠', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ 開放感のある内装・外観写真\n✓ 落ち着いた青系トーンで誠実さを演出\n✓ 「理想の暮らし」をビジュアル化\n✓ 相談・問い合わせへの安心感',
    sample: '/banner-samples/cat-realestate.png'
  },
  { 
    value: 'education', label: '教育', icon: '📚', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ 真剣に学ぶ姿・明るい光の演出\n✓ 習得スキルをステップ形式で提示\n✓ 「未来への自己投資」感を醸成\n✓ 申し込みハードルを下げるコピー',
    sample: '/banner-samples/cat-education.png'
  },
  { 
    value: 'finance', label: '金融', icon: '💰', color: '#FBBF24', bg: 'from-amber-400/10 to-amber-500/10',
    description: '✓ スマホアプリの操作画面イメージ\n✓ 資産増をイメージさせるアイコン\n✓ ダークネイビー×ゴールドの高級感\n✓ 信頼・安心・専門性を強調',
    sample: '/banner-samples/cat-finance.png'
  },
  { 
    value: 'health', label: '医療', icon: '🏥', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ 専門家の優しい表情を見せる\n✓ 清潔感のある青系グラデーション\n✓ 機能性・安全性を視覚的に表現\n✓ 健康課題の解決を具体的に訴求',
    sample: '/banner-samples/cat-health.png'
  },
  { 
    value: 'it', label: 'IT', icon: '💻', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ サーバー・ネットワークの抽象光\n✓ デジタル感あるクールなトーン\n✓ 最新技術・スピード感を演出\n✓ 課題解決・効率化を数値で訴求',
    sample: '/banner-samples/cat-it.png'
  },
  { 
    value: 'other', label: 'その他', icon: '✨', color: '#2563EB', bg: 'from-blue-600/10 to-blue-700/10',
    description: '✓ シンプルで汎用性の高いレイアウト\n✓ どんなコピーも映える余白設計\n✓ 引き算の美学でメッセージを際立たせる\n✓ 業種を問わないモダンなデザイン',
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

type SampleScenario = { purpose: string; category: string; size: string; keyword: string; imageDescription: string }

// サンプル入力（用途/業種/サイズ/内容/イメージまで含めて押すたびに切り替え）
const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    purpose: 'sns_ad',
    category: 'marketing',
    size: '1080x1080',
    keyword: '広告費ムダ打ち0へ。CV改善の無料診断、今だけ受付中',
    imageDescription:
      'B2B感のある清潔なビジネス写真（人物＋グラフの抽象要素）。\nドヤバナーブルー基調、CTAは白背景×青文字で目立たせる。\n見出しは太字で短く、3秒で理解できる構成。上下の余白や黒帯は作らない。',
  },
  {
    purpose: 'sns_ad',
    category: 'beauty',
    size: '1080x1080',
    keyword: '【本日限定】新規¥0体験あり たった30分で印象UP',
    imageDescription:
      '透明感のある人物アップ（肌ツヤ/清潔感）。\n白〜淡いベージュ×アクセントに黄色、上品で“高級感”。\nテキストは2段まで・大きく、CTAボタンをはっきり配置。余白や黒帯なし。',
  },
  {
    purpose: 'sns_ad',
    category: 'recruit',
    size: '1080x1080',
    keyword: '未経験OK｜週3〜リモート可 まずはカジュアル面談',
    imageDescription:
      '笑顔のチーム写真＋“安心感”のある青トーン。\n「未経験OK」「週3〜」など数字/条件を大きく。\nCTAは“面談予約”系のボタンで目立たせる。上下の余白なし。',
  },
  {
    purpose: 'display',
    category: 'ec',
    size: '300x250',
    keyword: '決算セール MAX70%OFF 本日限り！',
    imageDescription:
      '商品を大きく1点見せ、赤/オレンジで割引バッジ。\n文字は極太で短く、視認性最優先（小サイズでも読める）。\nCTAは右下に小さくても押せるボタン風。黒帯なし。',
  },
  {
    purpose: 'display',
    category: 'food',
    size: '300x250',
    keyword: '初回限定 20%OFF。人気No.1セットを今だけ',
    imageDescription:
      '料理の接写でシズル感（湯気/ツヤ）。\n暖色背景＋オレンジCTAで食欲を刺激。\n文字は短く太く。上下の余白なし。',
  },
  {
    purpose: 'display',
    category: 'realestate',
    size: '728x90',
    keyword: '内見予約でギフト券1万円（今月限定）',
    imageDescription:
      '開放感のある室内写真を横長にトリミング。\n青系で誠実、特典数字を最優先で大きく。\n小さくても読める太字。余白や黒帯なし。',
  },
  {
    purpose: 'webinar',
    category: 'it',
    size: '1200x628',
    keyword: '【参加無料】生成AI活用ロードマップ（Q&A付き）',
    imageDescription:
      '登壇者の上半身写真＋“参加無料”バッジ。\n日程/時間/特典を整理して配置。\nブルー基調で信頼感、申込CTAを強調。上下の余白なし。',
  },
  {
    purpose: 'webinar',
    category: 'finance',
    size: '1200x628',
    keyword: '【無料セミナー】家計見直しで月1万円を生み出す方法',
    imageDescription:
      '信頼感のある人物（スーツ）＋ネイビー×ゴールド。\n「月1万円」など数字を最大級。\n“無料”をバッジで強調、CTAを明確に。余白なし。',
  },
  {
    purpose: 'lp_hero',
    category: 'it',
    size: '1920x600',
    keyword: '業務効率を10倍に。次世代AIプラットフォーム',
    imageDescription:
      'プロダクトUIの抽象イメージ＋クリーンな余白。\n大見出しは左寄せで太字、サブ要点は3つまで。\nCTAは右側に目立つボタン。上下の余白なし（ヒーロー帯ぴったり）。',
  },
  {
    purpose: 'lp_hero',
    category: 'health',
    size: '1920x600',
    keyword: '予約から問診まで一括管理。現場をもっとラクに',
    imageDescription:
      '清潔感のある医療現場写真（白衣/受付/タブレット）。\n青×白で安心、要点を短く太字。\nCTAをはっきり配置。上下の余白なし。',
  },
  {
    purpose: 'email',
    category: 'ec',
    size: '600x200',
    keyword: '本日23:59まで：会員様限定クーポン配布中',
    imageDescription:
      'メール上部で一瞬で伝わるシンプル構成。\nクーポン券風のビジュアル＋期限を太字。\nCTAは“今すぐ使う”で明確に。余白なし。',
  },
  {
    purpose: 'email',
    category: 'education',
    size: '600x300',
    keyword: '無料体験レッスン受付中｜最短2週間で基礎が身につく',
    imageDescription:
      '学習している人物/ノートPCの写真。\n青基調で信頼、箇条書きは2〜3点。\nCTAは目立つボタン。余白なし。',
  },
  {
    purpose: 'campaign',
    category: 'telecom',
    size: '1200x628',
    keyword: '乗り換えで最大2万円キャッシュバック 月額990円〜',
    imageDescription:
      'スマホを持つ手元＋“最大2万円”を最優先で巨大表示。\nオレンジ×黄色アクセントでお得感。\nCTAは“今すぐ申し込む”系。上下の余白なし。',
  },
  {
    purpose: 'campaign',
    category: 'food',
    size: '1080x1080',
    keyword: '今だけ！ランチセット500円OFF（先着100名）',
    imageDescription:
      '料理の接写＋赤い先着バッジ。\n「500円OFF」「先着100名」を大きく。\nCTAは予約/注文ボタン風。余白なし。',
  },
  {
    purpose: 'youtube',
    category: 'it',
    size: '1280x720',
    keyword: '【保存版】AIで作業が10倍速くなる“最短ルート”',
    imageDescription:
      '表情のある人物（驚き/ドヤ顔）＋極太テキスト。\n強コントラスト（青×黒）＋黄色ハイライト。\n“10倍”“最短”など数字・強語を強調。上下の余白なし。',
  },
  {
    purpose: 'youtube',
    category: 'marketing',
    size: '1280x720',
    keyword: '【NG集】広告で失敗する人の共通点7つ',
    imageDescription:
      '人物の表情＋“NG”を赤でドン。\n数字（7つ）を大きく、視線誘導の矢印。\nサムネらしい派手さ。余白なし。',
  },
]

function buildSampleImageDescription(category: string, purpose: string, size: string) {
  const catLabel = CATEGORIES.find((c) => c.value === category)?.label || category
  const purposeLabel = PURPOSES.find((p) => p.value === purpose)?.label || purpose
  const purposeCue =
    purpose === 'youtube'
      ? '表情強めの人物＋極太テキスト。コントラストを強く、数字/強語をハイライト。'
      : purpose === 'display'
        ? '小サイズ前提。文字は短く太く、重要語を最大サイズで。'
        : purpose === 'webinar'
          ? '登壇者写真＋「無料/日程/特典」を整理し、申込CTAを明確に。'
          : purpose === 'lp_hero'
            ? '余白を活かしたヒーロー構成。価値提案を太字で、CTAを目立たせる。'
            : purpose === 'email'
              ? 'シンプルで軽量。1メッセージを短く、CTAで本文へ誘導。'
              : purpose === 'campaign'
                ? 'お得感（割引/限定/先着）を最優先で大きく、CTAを強く。'
                : '3秒で伝わる構成。'

  const catCue =
    category === 'food'
      ? '料理の接写でシズル感（湯気/ツヤ）。暖色で食欲を刺激。'
      : category === 'beauty'
        ? '透明感・清潔感の人物アップ。上品な余白と高級感。'
        : category === 'ec'
          ? '商品を大きく、割引バッジと期限で緊急性。'
          : category === 'marketing'
            ? 'B2Bの信頼感。清潔な人物＋データの抽象要素。'
            : category === 'telecom'
              ? 'スマホ/料金/キャッシュバックの数字訴求を強調。'
              : category === 'recruit'
                ? '笑顔のチーム写真。安心感の青トーン。'
                : category === 'finance'
                  ? 'ネイビー×ゴールドで信頼/高級感。数字を強調。'
                  : category === 'health'
                    ? '清潔な医療現場。安心の青×白。'
                    : category === 'realestate'
                      ? '開放感のある室内/外観。誠実な青トーン。'
                      : category === 'education'
                        ? '学習シーン。成長が伝わる明るい光。'
                        : category === 'it'
                          ? 'デジタル抽象光/UI。スピード感。'
                          : 'シンプルで汎用性の高いモダンデザイン。'

  return `【${purposeLabel} / ${catLabel} / ${size}】\n${purposeCue}\n${catCue}\nCTAボタンを必ず入れ、文字は同じ文言を重複させない。上下の余白や黒帯は作らない。`
}

function buildSampleScenariosFor(category: string, purpose: string): SampleScenario[] {
  const fixed = SAMPLE_SCENARIOS.filter((s) => s.category === category && s.purpose === purpose)
  if (fixed.length > 0) return fixed

  // 固定プリセットが足りない場合は「高CTRコピー」から自動生成してパターンを増やす
  const sizes = (SIZE_PRESETS[purpose] || SIZE_PRESETS.default).map((s) => s.value)
  const sizeA = sizes[0] || '1080x1080'
  const sizeB = sizes[1] || sizeA
  const copies = buildHighCtrSampleCopies(category, purpose).slice(0, 8)
  const derived: SampleScenario[] = []
  for (let i = 0; i < copies.length; i++) {
    const sz = i % 3 === 0 ? sizeB : sizeA
    derived.push({
      purpose,
      category,
      size: sz,
      keyword: copies[i]!,
      imageDescription: buildSampleImageDescription(category, purpose, sz),
    })
  }
  return derived
}

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

// 生成時間の統計（ローカル保存）→ 予測時間表示に使用
type GenStats = {
  global?: { n: number; emaMs: number }
  byPurpose?: Record<string, { n: number; emaMs: number }>
}
const GEN_STATS_KEY = 'doya_banner_gen_stats_v1'
const GEN_STATS_ALPHA = 0.22
const DEFAULT_PREDICT_MS = 55_000

// ==============================
// 修正（チャット編集）中の“飽きさせない”演出
// ==============================
const REFINE_TIPS = [
  { icon: '🧩', text: 'レイアウトを崩さずに、意図した変更だけを反映しています' },
  { icon: '🔎', text: '文字の可読性（太さ/コントラスト/背景パネル）を再最適化しています' },
  { icon: '📏', text: '上下の余白ゼロ・文字のはみ出し防止をチェックしています' },
  { icon: '🎯', text: 'CTAが“押せそう”に見えるように、立体感と色差を調整しています' },
  { icon: '🧼', text: '余計な要素を減らして、視線誘導を強くしています' },
]

const REFINE_PHASES = [
  { label: '指示を解釈中', sub: '意図の抽出・優先順位づけ' },
  { label: '構図を微調整中', sub: '余白/整列/視線誘導' },
  { label: '文字を最適化中', sub: '太さ/コントラスト/パネル' },
  { label: 'CTAを強調中', sub: '押せそう感・色差・影' },
  { label: '最終チェック中', sub: 'サイズ/はみ出し/仕上げ' },
]

type SimpleEma = { n: number; emaMs: number }
const REFINE_STATS_KEY = 'doya_banner_refine_stats_v1'
const DEFAULT_REFINE_PREDICT_MS = 18_000

function readRefineStats(): SimpleEma | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(REFINE_STATS_KEY)
    if (!raw) return null
    const json = JSON.parse(raw)
    if (typeof json?.emaMs === 'number' && typeof json?.n === 'number') return json as SimpleEma
    return null
  } catch {
    return null
  }
}

function writeRefineStats(v: SimpleEma) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REFINE_STATS_KEY, JSON.stringify(v))
  } catch {
    // ignore
  }
}

function clampMs(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.min(Math.max(n, min), max)
}

function readGenStats(): GenStats {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(GEN_STATS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as GenStats) : {}
  } catch {
    return {}
  }
}

function writeGenStats(stats: GenStats) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(GEN_STATS_KEY, JSON.stringify(stats))
  } catch {
    // ignore
  }
}

function updateEma(prev: { n: number; emaMs: number } | undefined, sampleMs: number) {
  const s = clampMs(sampleMs, 3_000, 240_000)
  if (!prev || !Number.isFinite(prev.emaMs) || prev.n <= 0) return { n: 1, emaMs: s }
  const emaMs = prev.emaMs * (1 - GEN_STATS_ALPHA) + s * GEN_STATS_ALPHA
  return { n: Math.min(prev.n + 1, 10_000), emaMs }
}

function formatSec(ms: number) {
  const sec = Math.max(0, Math.round(ms / 1000))
  if (sec < 60) return `${sec}秒`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}分${s.toString().padStart(2, '0')}秒`
}

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

function buildAltHeadlinePool(category: string, purpose: string, baseHeadline: string): string[] {
  const cat = category && typeof category === 'string' ? category : 'other'
  const base = String(baseHeadline || '').trim()
  const pool = uniqStrings([
    ...buildHighCtrSampleCopies(cat, purpose),
    ...createCopyVariants(base, purpose),
  ])
  return pool.filter((s) => s && s !== base).slice(0, 20)
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
  const [showAdvanced, setShowAdvanced] = useState(false)
  // const [showCoach, setShowCoach] = useState(false) // removed
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedBanners, setGeneratedBanners] = useState<string[]>([])
  const [generatedCopies, setGeneratedCopies] = useState<
    { variant: 'A' | 'B' | 'C'; headline: string; subhead: string; cta: string }[]
  >([])
  const [usedModelDisplay, setUsedModelDisplay] = useState<string | null>(null) // 使用モデル名
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [selectedBanner, setSelectedBanner] = useState<number | null>(null)
  const [generationStartedAt, setGenerationStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [predictedTotalMs, setPredictedTotalMs] = useState<number>(DEFAULT_PREDICT_MS)
  const [predictedRemainingMs, setPredictedRemainingMs] = useState<number>(DEFAULT_PREDICT_MS)
  const [isHidden, setIsHidden] = useState(false)
  
  // 修正機能
  const [refineInstruction, setRefineInstruction] = useState('')
  const [isRefining, setIsRefining] = useState(false)
  const [refineHistory, setRefineHistory] = useState<{ instruction: string; image: string }[]>([])
  const [refineStartedAt, setRefineStartedAt] = useState<number | null>(null)
  const [refineElapsedSec, setRefineElapsedSec] = useState(0)
  const [refinePredictedTotalMs, setRefinePredictedTotalMs] = useState<number>(DEFAULT_REFINE_PREDICT_MS)
  const [refinePredictedRemainingMs, setRefinePredictedRemainingMs] = useState<number>(DEFAULT_REFINE_PREDICT_MS)
  const [refineTipIndex, setRefineTipIndex] = useState(0)
  const [refinePhaseIndex, setRefinePhaseIndex] = useState(0)
  
  const [tipIndex, setTipIndex] = useState(0)
  
  const [guestUsageCount, setGuestUsageCount] = useState(0)

  // サンプル入力（用途/業種/サイズ/内容/イメージまで押すたびに切り替え）
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

  // ロゴ/人物（任意・アップロード画像をAIに渡して反映）
  const [logoImage, setLogoImage] = useState<string | null>(null)
  const [logoFileName, setLogoFileName] = useState('')
  const [personImages, setPersonImages] = useState<string[]>([])
  const [personFileNames, setPersonFileNames] = useState<string[]>([])

  // 生成枚数（デフォルト3 / 有料は最大10）
  const [generateCount, setGenerateCount] = useState<number>(3)

  const readFileAsDataUrl = async (file: File): Promise<string> => {
    const maxBytes = 6 * 1024 * 1024 // 6MB
    if (file.size > maxBytes) throw new Error('画像が大きすぎます（6MB以内）')
    if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選択してください')
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      reader.readAsDataURL(file)
    })
  }

  const optimizeImageDataUrl = async (
    dataUrl: string,
    opts: { maxSide: number; mime: 'image/jpeg' | 'image/png'; quality?: number }
  ): Promise<string> => {
    if (typeof document === 'undefined') return dataUrl
    if (!String(dataUrl || '').startsWith('data:image/')) return dataUrl
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        el.src = dataUrl
      })
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      if (!w || !h) return dataUrl

      const maxSide = Math.max(64, Math.floor(opts.maxSide))
      const scale = Math.min(1, maxSide / Math.max(w, h))
      const outW = Math.max(1, Math.round(w * scale))
      const outH = Math.max(1, Math.round(h * scale))

      const canvas = document.createElement('canvas')
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d', { alpha: opts.mime === 'image/png' })
      if (!ctx) return dataUrl
      ctx.drawImage(img, 0, 0, outW, outH)

      const quality = typeof opts.quality === 'number' ? opts.quality : 0.82
      const out = canvas.toDataURL(opts.mime, quality)

      // 極端に大きい場合はそのまま返す（環境依存の失敗回避）
      return out && out.length > 200 ? out : dataUrl
    } catch {
      return dataUrl
    }
  }

  const readAndOptimizeImage = async (file: File, kind: 'logo' | 'person'): Promise<string> => {
    const raw = await readFileAsDataUrl(file)
    if (kind === 'logo') {
      // ロゴは小さく（透過の可能性があるためPNG寄せ）
      return await optimizeImageDataUrl(raw, { maxSide: 512, mime: 'image/png' })
    }
    // 人物写真は軽量化（JPEG）
    return await optimizeImageDataUrl(raw, { maxSide: 1024, mime: 'image/jpeg', quality: 0.8 })
  }

  // 人物写真は「1名（1枚）」のみ対応
  const MAX_PERSON_IMAGES = 1

  const addPersonSlot = () => {
    if (personImages.length >= MAX_PERSON_IMAGES) {
      toast.error(`人物写真は最大${MAX_PERSON_IMAGES}人までです`)
      return
    }
    // 互換: 旧UIの名残。現在は単一アップロードUIのため、枠は追加しない。
    setPersonImages((prev) => (prev.length > 0 ? prev : ['']))
    setPersonFileNames((prev) => (prev.length > 0 ? prev : ['']))
  }

  const removePersonSlot = (idx: number) => {
    // 単一のみ
    if (idx !== 0) return
    setPersonImages([])
    setPersonFileNames([])
  }

  const setPersonFileAt = async (idx: number, file: File | null) => {
    if (!file) return
    try {
      const url = await readAndOptimizeImage(file, 'person')
      // 単一のみ（idxは0固定）
      setPersonImages([url])
      setPersonFileNames([file.name])
      toast.success('人物写真を設定しました')
    } catch (e: any) {
      toast.error(e?.message || '人物写真の追加に失敗しました')
    }
  }

  const safeReadJson = async (res: Response): Promise<{ ok: boolean; status: number; data: any; text: string }> => {
    const status = res.status
    const text = await res.text().catch(() => '')
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = null
    }
    return { ok: res.ok, status, data, text }
  }

  const normalizeNonJsonApiError = (status: number, text: string): string => {
    const t = String(text || '').trim()
    if (status === 413 || /Request Entity Too Large/i.test(t) || /^Request En/i.test(t)) {
      return '送信データが大きすぎます（人物写真/ロゴを小さめにして再試行してください）'
    }
    if (status === 502 || status === 503) return 'サーバが混雑しています。少し待って再試行してください。'
    if (t) return t.slice(0, 180)
    return '生成に失敗しました'
  }

  // ギャラリー公開（任意）
  const [shareToGallery, setShareToGallery] = useState(false)
  const [shareProfile, setShareProfile] = useState(false)
  
  // URL自動生成は /banner（別ページ）に分離

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

  // （旧）テキストレイヤー合成のためのプレビュー計測は廃止
  
  const isGuest = !session
  const bannerPlan = session ? String((session.user as any)?.bannerPlan || (session.user as any)?.plan || 'FREE').toUpperCase() : 'GUEST'
  const planTier = useMemo(() => {
    const p = String(bannerPlan || '').toUpperCase()
    if (!p || p === 'GUEST') return 'GUEST' as const
    if (p.includes('ENTERPRISE')) return 'ENTERPRISE' as const
    if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO' as const
    if (p.includes('FREE')) return 'FREE' as const
    return 'FREE' as const
  }, [bannerPlan])
  const isEnterpriseUser = !isGuest && planTier === 'ENTERPRISE'
  const isPaidUser = !isGuest && (planTier === 'PRO' || planTier === 'ENTERPRISE')
  const currentSizes = SIZE_PRESETS[purpose] || SIZE_PRESETS.default
  const guestRemaining = BANNER_PRICING.guestLimit - guestUsageCount
  const [userUsageCount, setUserUsageCount] = useState(0)
  const userDailyLimit = getBannerDailyLimitByUserPlan(bannerPlan)
  const userRemaining = Math.max(0, userDailyLimit - userUsageCount)
  const remainingCount = isGuest ? guestRemaining : userRemaining

  useEffect(() => {
    // 無料/ゲストは3枚固定
    if (!isPaidUser) {
      if (generateCount !== 3) setGenerateCount(3)
      return
    }
    // 有料は 3..10
    if (generateCount < 3) setGenerateCount(3)
    if (generateCount > 10) setGenerateCount(10)
  }, [isPaidUser, generateCount])
  
  // タブ状態（バックグラウンドでも進行するが、閉じる/更新すると中断される可能性が高い）
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => setIsHidden(!!document.hidden)
    onVis()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (!isGenerating) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isGenerating])

  // カスタムサイズの場合は入力値を使用
  const effectiveSize = useCustomSize ? `${customWidth}x${customHeight}` : size
  const previewAspect = useMemo(() => {
    const [w, h] = String(effectiveSize || '1080x1080').split('x').map((v) => Number(v))
    const ww = Number.isFinite(w) && w > 0 ? w : 1
    const hh = Number.isFinite(h) && h > 0 ? h : 1
    return `${ww} / ${hh}`
  }, [effectiveSize])
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

  // （旧）テキストレイヤー合成の計算は廃止

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
      setPredictedRemainingMs(predictedTotalMs)
      return
    }
    // 経過時間の追跡（表示用）
    const started = generationStartedAt ?? Date.now()
    if (!generationStartedAt) setGenerationStartedAt(started)
    const tick = setInterval(() => setElapsedSec(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => {
      clearInterval(tick)
    }
  }, [isGenerating, generationStartedAt, predictedTotalMs])

  useEffect(() => {
    if (!isGenerating || !generationStartedAt) return
    const t = setInterval(() => {
      const elapsedMs = Date.now() - generationStartedAt
      const remaining = Math.max(0, predictedTotalMs - elapsedMs)
      setPredictedRemainingMs(remaining)

      // 予測に追従する進捗（完了時にのみ100へ）
      const p = Math.min(85, (elapsedMs / Math.max(1, predictedTotalMs)) * 85)
      setProgress(Math.max(2, Math.min(85, p)))

      // フェーズも予測時間に合わせて切り替え
      const r = elapsedMs / Math.max(1, predictedTotalMs)
      const idx =
        r < 0.12 ? 0 :
        r < 0.24 ? 1 :
        r < 0.46 ? 2 :
        r < 0.68 ? 3 :
        r < 0.88 ? 4 : 5
      setPhaseIndex(idx)
    }, 350)
    return () => clearInterval(t)
  }, [isGenerating, generationStartedAt, predictedTotalMs])

  useEffect(() => {
    if (!isGenerating) return
    const t = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % GENERATION_TIPS.length)
    }, 5200)
    return () => clearInterval(t)
  }, [isGenerating])

  // 修正中の“飽きさせない”演出（予測残り時間/フェーズ/チップ）
  useEffect(() => {
    if (!isRefining) {
      setRefineStartedAt(null)
      setRefineElapsedSec(0)
      setRefinePhaseIndex(0)
      setRefineTipIndex(0)
      setRefinePredictedTotalMs(DEFAULT_REFINE_PREDICT_MS)
      setRefinePredictedRemainingMs(DEFAULT_REFINE_PREDICT_MS)
      return
    }

    const stats = readRefineStats()
    const base = stats?.emaMs || DEFAULT_REFINE_PREDICT_MS
    setRefinePredictedTotalMs(base)
    setRefinePredictedRemainingMs(base)

    const started = refineStartedAt ?? Date.now()
    if (!refineStartedAt) setRefineStartedAt(started)

    const t = setInterval(() => {
      const elapsedMs = Date.now() - started
      setRefineElapsedSec(Math.floor(elapsedMs / 1000))
      const remaining = Math.max(0, base - elapsedMs)
      setRefinePredictedRemainingMs(remaining)

      // 予測に合わせて“フェーズ”を進める（実進捗が取れないため演出）
      const r = elapsedMs / Math.max(1, base)
      const idx = Math.min(REFINE_PHASES.length - 1, Math.floor(Math.min(0.999, r) * REFINE_PHASES.length))
      setRefinePhaseIndex(idx)
    }, 260)

    return () => clearInterval(t)
  }, [isRefining, refineStartedAt])

  useEffect(() => {
    if (!isRefining) return
    const t = setInterval(() => {
      setRefineTipIndex((prev) => (prev + 1) % REFINE_TIPS.length)
    }, 3600)
    return () => clearInterval(t)
  }, [isRefining])

  // Handlers
  const handleSample = () => {
    // 業種選択済み → 用途×業種×サイズ×内容×イメージまでまとめて切り替える
    if (category) {
      const key = `${category}|${purpose}`
      const pool = buildSampleScenariosFor(category, purpose)
      const current = sampleCopyIndexRef.current[key] ?? -1
      const next = (current + 1) % Math.max(1, pool.length)
      sampleCopyIndexRef.current[key] = next
      setSampleCopyIndex(next)
      setSampleCopyTotal(pool.length)

      const s = pool[next] || pool[0]
      if (s) {
        setUseCustomSize(false)
        setSize(s.size)
        setKeyword(s.keyword)
        setImageDescription(s.imageDescription)
      }
      const label = CATEGORIES.find((c) => c.value === category)?.label || category
      toast.success(`サンプルを切り替えました（${label}×${PURPOSES.find(p => p.value === purpose)?.label || purpose} / ${next + 1}/${pool.length}）`, { icon: '🔁' })
      return
    }

    // 業種未選択 → 用途/業種/サイズ/内容/イメージまでまとめてセット（導線として残す）
    const pool = SAMPLE_SCENARIOS
    sampleScenarioIndexRef.current = (sampleScenarioIndexRef.current + 1) % pool.length
    const next = sampleScenarioIndexRef.current
    setSampleScenarioIndex(next)
    const s = pool[next]!
    setPurpose(s.purpose)
    setCategory(s.category)
    setUseCustomSize(false)
    setSize(s.size)
    setKeyword(s.keyword)
    setImageDescription(s.imageDescription)
    toast.success(`サンプルを切り替えました（${next + 1}/${pool.length}）`, { icon: '🔁' })
  }

  const handleGenerate = async () => {
    if (!canGenerate) return

    // 上限に達している場合はプロプランへ誘導
    if (remainingCount <= 0) {
      if (isPaidUser) {
        toast.error('今月の生成上限に達しました。', { duration: 6000 })
        // PROは「上限UP相談」導線を下に表示（自動遷移はしない）
      } else {
        toast.error('今月の生成上限に達しました。プロプランにアップグレードしてください。', { duration: 6000 })
        try {
          const upgradeUrl = '/banner'
          window.open(upgradeUrl, '_self')
        } catch {}
      }
      return
    }
    
    setError('')
    setIsGenerating(true)
    // 生成開始時に既存バナーを消さない（消すと画面が「パチパチ」しやすい）
    // 新しい結果が返ってきたタイミングで上書きする
    setGeneratedCopies([])
    setUsedModelDisplay(null)
    setRefineInstruction('')
    setRefineHistory([])
    const startedAt = Date.now()
    setGenerationStartedAt(startedAt)

    // 予測時間（平均/EMA）を読み込み
    const stats = readGenStats()
    const byPurpose = stats.byPurpose?.[purpose]
    const base = byPurpose?.emaMs || stats.global?.emaMs || DEFAULT_PREDICT_MS
    // サイズが大きいほど時間が伸びる傾向があるので軽く補正
    const [wStr, hStr] = effectiveSize.split('x')
    const px = safeNumber(wStr, 1080) * safeNumber(hStr, 1080)
    const scale = clamp(px / (1080 * 1080), 0.6, 3.0)
    // 生成枚数に応じて時間をスケール（基準: デフォルト3枚）
    const countScale = clamp(generateCount / 3, 0.7, 4.0)
    const predicted = clampMs(base * (0.85 + 0.15 * scale) * countScale, 8_000, 600_000)
    setPredictedTotalMs(predicted)
    setPredictedRemainingMs(predicted)

    try {
      // “終わらない”体感を潰す：フロント側でタイムアウト検知
      const controller = new AbortController()
      // NOTE: state の predictedTotalMs は即時反映されないので、ローカル変数 predicted を使う
      // 10枚でも待てるよう、上限はサーバ側 maxDuration(300s) に寄せる
      const timeoutMs = Math.max(90_000, Math.min(290_000, predicted + 60_000))
      const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

      const response = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          category,
          keyword: keyword.trim(),
          size: effectiveSize,
          purpose,
          count: generateCount,
          imageDescription: imageDescription.trim() || undefined,
          logoImage: logoImage || undefined,
          personImages: personImages
            .map((x) => String(x || '').trim())
            .filter((x) => x.startsWith('data:'))
            .slice(0, 1),
          // 後方互換（念のため）
          personImage:
            personImages
              .map((x) => String(x || '').trim())
              .find((x) => x.startsWith('data:')) || undefined,
          brandColors: useCustomColors
            ? uniqStrings(customColors.map((c) => normalizeHexClient(c) || '').filter(Boolean)).slice(0, 8)
            : undefined,
          shareToGallery: shareToGallery && !isGuest ? true : undefined,
          shareProfile: shareToGallery && !isGuest ? (shareProfile ? true : false) : undefined,
        }),
      })
      window.clearTimeout(timeout)

      const parsed = await safeReadJson(response)
      const data = parsed.data || {}
      if (!parsed.ok) {
        const msg = data?.error || data?.message || normalizeNonJsonApiError(parsed.status, parsed.text)
        throw new Error(msg)
      }
      
      setProgress(100)
      await new Promise(r => setTimeout(r, 500))
      setGeneratedBanners(data.banners || [])
      setGeneratedCopies(Array.isArray(data.copies) ? data.copies : [])
      setUsedModelDisplay(data.usedModelDisplay || null)
      // 生成直後は先頭を選択（プレビューが出てUXが良い & null事故を防ぐ）
      setSelectedBanner(0)

      // 実績時間を保存（次回以降の予測に使用）
      const actualMs = Date.now() - startedAt
      const nextStats = readGenStats()
      nextStats.global = updateEma(nextStats.global, actualMs)
      nextStats.byPurpose = nextStats.byPurpose || {}
      nextStats.byPurpose[purpose] = updateEma(nextStats.byPurpose[purpose], actualMs)
      writeGenStats(nextStats)
      
      if (isGuest) {
        const serverUsed = Number(data?.usage?.dailyUsed)
        if (Number.isFinite(serverUsed)) {
          setGuestUsageCount(serverUsed)
          setGuestUsage('banner', serverUsed)
        } else {
          const genCount = Array.isArray(data?.banners) ? data.banners.length : 3
          const newCount = guestUsageCount + genCount
          setGuestUsageCount(newCount)
          setGuestUsage('banner', newCount)
        }
      } else {
        const serverUsed = Number(data?.usage?.dailyUsed)
        if (Number.isFinite(serverUsed)) {
          setUserUsageCount(serverUsed)
        } else {
          const genCount = Array.isArray(data?.banners) ? data.banners.length : 3
          const newCount = incrementUserUsage('banner', genCount)
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
      if (err?.name === 'AbortError') {
        setError('生成に時間がかかっています。タブは開いたまま、しばらく待つか再試行してください。')
        toast.error('タイムアウト：サーバが混雑している可能性があります', { duration: 6000 })
      } else {
        setError(err.message)
        toast.error('生成に失敗しました', { icon: '❌', duration: 5000 })
      }
    } finally {
      setIsGenerating(false)
    }
  }

  // URL自動生成は /banner（別ページ）へ移動

  // （旧）テキストレイヤー合成DLは廃止（画像生成AIが文字まで描画する）

  const handleDownload = (url: string, index: number) => {
    const link = document.createElement('a')
    link.href = url
    const label = index >= 0 && index < 3 ? ['A', 'B', 'C'][index] : `No${index + 1}`
    link.download = `doya-banner-${label}-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('ダウンロード開始')
  }

  // 画像修正ハンドラー（外部から指示文を渡して実行もできる）
  const handleRefine = async (overrideInstruction?: string) => {
    if (selectedBanner === null) return
    const instruction = (overrideInstruction ?? refineInstruction).trim()
    if (!instruction) return

    const originalImage = generatedBanners[selectedBanner]
    
    setIsRefining(true)
    const startedAt = Date.now()
    setRefineStartedAt(startedAt)
    setRefineElapsedSec(0)
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

      const parsed = await safeReadJson(response)
      const data = parsed.data || {}
      
      if (!parsed.ok || !data.success) {
        const msg = data?.error || normalizeNonJsonApiError(parsed.status, parsed.text) || '修正に失敗しました'
        throw new Error(msg)
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
      toast.success('バナーを修正しました！', { icon: '✨' })

      // 修正時間を保存（次回以降の予測に使用）
      const actualMs = Date.now() - startedAt
      const next = updateEma(readRefineStats() || undefined, actualMs) as SimpleEma
      writeRefineStats(next)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsRefining(false)
      setRefineStartedAt(null)
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
        {/* UI崩れ対策：左カラム固定幅だと日本語が1文字改行しやすいので、元の比率（右=固定）に戻す */}
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
                <div className="flex flex-col items-start sm:items-end gap-2">
                  <button
                    onClick={handleSample}
                    className="relative flex items-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl transition-all text-sm font-black shadow-xl shadow-blue-200 active:scale-95 border border-blue-600"
                  >
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-amber-400 text-[10px] font-black text-slate-900 shadow-md">
                      HOT
                    </span>
                    <Wand2 className="w-4 h-4" />
                    <span>サンプル入力</span>
                  </button>

                  {/* 使い方 */}
                  <div className="max-w-[360px] rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <p className="text-[11px] font-black text-slate-700">サンプル入力の使い方</p>
                    <ul className="mt-1 text-[11px] text-slate-600 font-bold leading-relaxed space-y-1">
                      <li>・押すだけで「用途/業種/サイズ/内容詳細（イメージ）」まで一括入力</li>
                      <li>・押すたびにシナリオが切り替わります（迷ったら2〜3回押す）</li>
                      <li>・そのまま「プロ品質バナーを生成する」を押せばOK</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {PURPOSES.map((p) => {
                    const Icon = p.icon
                    const isSelected = purpose === p.value
                    return (
                      <button
                        key={p.value}
                        onClick={() => setPurpose(p.value)}
                        className={`relative p-3 sm:p-4 rounded-2xl text-center transition-all group ${
                          isSelected 
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105' 
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-blue-600'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                        <span className="text-[11px] font-black block leading-tight whitespace-normal break-words tracking-tight">
                          {p.label}
                        </span>
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
                <div className="grid grid-cols-4 gap-3">
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest">
                        <Zap className="w-3.5 h-3.5" /> CTR最大化のポイント
                      </div>
                      <h3 className="text-slate-800 font-bold text-base">{CATEGORIES.find(c => c.value === category)?.label}向け 画像戦略</h3>
                      <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">
                        {CATEGORIES.find(c => c.value === category)?.description}
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-4 text-slate-400 text-[11px] font-bold italic text-center">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Zap className="w-5 h-5 text-slate-200" />
                      </div>
                      業種を選択すると<br />CTR最大化のポイントが表示されます
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
                    {(() => {
                      const max = 48
                      const w = useCustomSize ? Number(customWidth) : Number(String(size).split('x')[0])
                      const h = useCustomSize ? Number(customHeight) : Number(String(size).split('x')[1])
                      const ww = Number.isFinite(w) && w > 0 ? w : 1
                      const hh = Number.isFinite(h) && h > 0 ? h : 1
                      const scale = max / Math.max(ww, hh)
                      const boxW = Math.max(6, Math.round(ww * scale))
                      const boxH = Math.max(6, Math.round(hh * scale))
                      return (
                        <div
                          className="bg-blue-600/10 border border-blue-600/20 rounded-sm"
                          style={{ width: `${boxW}px`, height: `${boxH}px` }}
                        />
                      )
                    })()}
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
              </div>
              
              <div className="space-y-8">
                {/* キャッチフレーズ */}
                <div className="relative group/input">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-[0.2em] ml-1">キャッチフレーズ</label>
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

                {/* 内容詳細（イメージ） */}
                <div className="pt-8 border-t border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block tracking-[0.2em] ml-1 flex items-center gap-2">
                    内容詳細（イメージ） <span className="text-[8px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded tracking-normal">任意</span>
                  </label>
                  <textarea
                    value={imageDescription}
                    onChange={(e) => setImageDescription(e.target.value)}
                    placeholder="例: 青空の下で笑顔の人物／モダンなオフィス／スマホを操作している手元…など"
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
                カラー設定
              </button>
              
              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm"
                  >
                    {/* Manual Colors */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-600 mb-2 font-medium">
                        <Palette className="w-4 h-4" />
                        使用カラー
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
              {/* Generate Count */}
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-800">生成枚数</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      デフォルトは3枚（A/B/C）。有料プランは最大10枚まで増やせます。
                      <span className="ml-1 font-bold text-slate-700">枚数を増やすほど時間がかかります。</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900 tabular-nums">{generateCount}枚</p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {isPaidUser ? '最大10枚' : '無料は3枚固定'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={!isPaidUser && n !== 3}
                      onClick={() => setGenerateCount(n)}
                      className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                        generateCount === n
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white disabled:cursor-not-allowed'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>

                {!isPaidUser && (
                  <p className="mt-3 text-[11px] text-slate-500 font-medium">
                    ※ 4枚以上は有料プラン限定です（生成時間とコストが増えるため）。
                  </p>
                )}
              </div>

              {/* Logo / Person Upload */}
              <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <p className="text-sm font-black text-slate-800">ロゴ / 人物写真（任意）</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    アップロードした画像をバナーに反映します（AIが画像内に合成します）。
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Logo */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-700">ロゴ</p>
                      {logoImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoImage(null)
                            setLogoFileName('')
                            toast('ロゴを解除しました')
                          }}
                          className="text-xs font-black text-slate-500 hover:text-slate-900"
                        >
                          解除
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                        {logoImage ? (
                          <img src={logoImage} alt="logo" className="h-full w-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-black text-slate-400">LOGO</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-600 font-bold truncate">{logoFileName || '未設定'}</p>
                        <label className="mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-black text-slate-800 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={async (e) => {
                              const f = e.target.files?.[0]
                              e.target.value = ''
                              if (!f) return
                              try {
                                const url = await readAndOptimizeImage(f, 'logo')
                                setLogoImage(url)
                                setLogoFileName(f.name)
                                toast.success('ロゴを設定しました')
                              } catch (err: any) {
                                toast.error(err?.message || 'ロゴの設定に失敗しました')
                              }
                            }}
                          />
                          アップロード
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Person (single) */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-slate-700">人物写真</p>
                      {personImages[0] && (
                        <button
                          type="button"
                          onClick={() => {
                            setPersonImages([])
                            setPersonFileNames([])
                            toast('人物写真を解除しました')
                          }}
                          className="text-xs font-black text-slate-500 hover:text-slate-900"
                        >
                          解除
                        </button>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center">
                        {personImages[0] ? (
                          <img src={personImages[0]} alt="person" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-black text-slate-400">PERSON</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-600 font-bold truncate">{personFileNames[0] || '未設定'}</p>
                        <span className="relative mt-1 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-black text-slate-800 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={async (e) => {
                              const f = e.currentTarget.files?.[0] || null
                              e.currentTarget.value = ''
                              await setPersonFileAt(0, f)
                            }}
                          />
                          {personImages[0] ? '変更' : 'アップロード'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-slate-500 font-bold">
                      ※ 人物写真は1名（1枚）のみ対応です（提供画像を優先して自然に合成します）
                    </p>
                  </div>
                </div>
              </div>

              {/* URL自動生成は /banner に分離 */}

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
                  <div className="font-black">今月の生成上限に達しました。</div>

                  {isGuest ? (
                    <div className="mt-2">ログインしてプランをご確認ください。</div>
                  ) : isEnterpriseUser ? (
                    <div className="mt-2">
                      上限をさらにUPしたい場合は{' '}
                      <a
                        href={HIGH_USAGE_CONTACT_URL}
                        target={HIGH_USAGE_CONTACT_URL.startsWith('http') ? '_blank' : undefined}
                        rel={HIGH_USAGE_CONTACT_URL.startsWith('http') ? 'noreferrer' : undefined}
                        className="font-black underline underline-offset-2 hover:opacity-80"
                      >
                        マーケティング施策を丸投げする
                      </a>
                      からご相談ください。
                    </div>
                  ) : (
                    <div className="mt-3 flex justify-center">
                      <CheckoutButton
                        planId={isPaidUser ? 'banner-enterprise' : 'banner-pro'}
                        loginCallbackUrl="/banner/dashboard"
                        className="px-4 py-2 rounded-xl text-sm"
                        variant="secondary"
                      >
                        {isPaidUser ? 'エンタープライズにアップグレード' : 'プロプランへアップグレード'}
                      </CheckoutButton>
                    </div>
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
                        <div
                          className="relative rounded-xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm group-hover:shadow-md transition-all"
                          style={{ aspectRatio: previewAspect }}
                        >
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
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="text-white font-black text-sm tracking-tight">GENERATION COMPLETE</h3>
                              {usedModelDisplay ? (
                                usedModelDisplay.toLowerCase().includes('nano banana') ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 rounded-full text-[10px] font-bold text-white shadow-lg animate-pulse">
                                    <span className="text-[12px]">🍌</span> {usedModelDisplay}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-[10px] font-bold text-white shadow-lg">
                                    <span className="text-[12px]">🤖</span> {usedModelDisplay}
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-gray-500 to-gray-600 rounded-full text-[10px] font-bold text-white shadow-lg">
                                  <span className="text-[12px]">🤖</span> AI生成
                                </span>
                              )}
                            </div>
                            <p className="text-slate-400 text-[11px] leading-relaxed">
                              A/B/C 3つの異なる戦略に基づいたバナーを生成しました。気に入ったバナーを選択してダウンロード、またはAIチャットで微調整が可能です。
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Banner Grid - Professional Presentation */}
                      <div className={`grid gap-3 ${generatedBanners.length > 3 ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid-cols-3'}`}>
                        {generatedBanners.map((banner, i) => {
                          const insights = BANNER_INSIGHTS[purpose] || BANNER_INSIGHTS.default
                          const insight = insights[i % Math.max(1, insights.length)] || insights[0]
                          const badge = i < 3 ? insight.type : `+${i - 2}`
                          return (
                            <motion.div
                              key={i}
                              onClick={() => setSelectedBanner(i)}
                              className={`relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 border-2 ${
                                selectedBanner === i 
                                  ? 'border-blue-600 shadow-xl shadow-blue-600/20 scale-105 z-10' 
                                  : 'border-white shadow-sm hover:border-slate-200'
                              }`}
                              style={{ aspectRatio: previewAspect }}
                            >
                              {/* 画像の切り替え時にぱちぱちしないようトランジション追加 */}
                              <img src={banner} alt={`Banner ${i + 1}`} className="w-full h-full object-cover transition-opacity duration-200" />
                              <div className="absolute top-2 left-2 px-2 py-1 bg-white/90 backdrop-blur-md rounded-lg shadow-sm border border-slate-100 flex items-center gap-1.5">
                                <span className="text-xs">{insight.icon}</span>
                                <span className="text-[9px] font-black text-slate-800 uppercase tracking-tighter">{badge}</span>
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
                            const insight = insights[selectedBanner % Math.max(1, insights.length)] || insights[0]
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
                                          {selectedBanner < 3 ? `${insight.type}案` : `追加${selectedBanner - 2}枚目`}
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
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold flex items-center gap-2 text-sm sm:text-base text-gray-900">
                                <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                                {selectedBanner < 3 ? `${['A', 'B', 'C'][selectedBanner]}案` : `No${selectedBanner + 1}`} プレビュー
                              </h3>
                              {usedModelDisplay ? (
                                usedModelDisplay.toLowerCase().includes('nano banana') ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-500 rounded-full text-[9px] font-bold text-white shadow">
                                    <span className="text-[11px]">🍌</span> {usedModelDisplay}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-[9px] font-bold text-white shadow">
                                    <span className="text-[11px]">🤖</span> {usedModelDisplay}
                                  </span>
                                )
                              ) : null}
                            </div>
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
                                onClick={() => handleDownload(generatedBanners[selectedBanner], selectedBanner)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                <Download className="w-4 h-4" />
                                ダウンロード
                              </button>
                            </div>
                          </div>
                          
                          {/* プレビュー画像（refine後も静かに切り替わるようトランジション追加） */}
                          <div
                            className="rounded-xl overflow-hidden mb-3 shadow-md bg-slate-100"
                            style={{ aspectRatio: previewAspect }}
                          >
                            <img
                              src={generatedBanners[selectedBanner]}
                              alt="Selected Banner"
                              className="w-full h-full object-cover transition-opacity duration-300"
                            />
                          </div>

                          {/* この画像に使われたテキスト（用途/業種/訴求タイプに合わせて自動生成） */}
                          {(() => {
                            // 表示仕様:
                            // - No1〜No5: 同一コピー（固定）
                            // - No6〜No10: コピー差し替え版（比較用）
                            const base = buildDefaultOverlay(keyword, purpose)
                            const altPool = buildAltHeadlinePool(category, purpose, base.headline)
                            const isAlt = selectedBanner >= 5
                            const altHeadline = altPool[selectedBanner - 5] || altPool[0] || base.headline
                            const display = {
                              headline: isAlt ? altHeadline : base.headline,
                              subhead: base.subhead,
                              cta: base.cta,
                            }
                            return (
                              <div className="border-t border-gray-100 pt-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <MessageSquare className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-bold text-gray-900">画像内テキスト（自動）</span>
                                </div>
                                <div className="mb-2 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-[11px] font-bold text-slate-700">
                                  ※ No1〜No5 は<strong className="font-black">同一コピー（固定）</strong>、No6〜No10 は<strong className="font-black">コピー差し替え版（比較用）</strong>を表示しています。
                                </div>
                                <div className="grid gap-2">
                                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                                    <div className="text-[11px] font-bold text-gray-500 mb-0.5">見出し（キーワード）</div>
                                    <div className="text-sm font-black text-gray-900 break-words">{display.headline}</div>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                                    <div className="text-[11px] font-bold text-gray-500 mb-0.5">サブ（訴求を一致させます）</div>
                                    <div className="text-sm font-bold text-gray-900 break-words">{display.subhead || '—'}</div>
                                  </div>
                                  <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
                                    <div className="text-[11px] font-bold text-gray-500 mb-0.5">CTA</div>
                                    <div className="text-sm font-bold text-gray-900 break-words">{display.cta}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })()}

                          {/* 生成画像の下で、チャット文を入力して画像を編集 */}
                          <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-bold text-gray-900">チャットで画像を編集</span>
                              </div>
                              <div className="text-[11px] text-gray-500 font-semibold">
                                例: 背景を明るく / 文字を太く / CTAをもっと目立たせて
                              </div>
                            </div>

                            {refineHistory.length > 0 && (
                              <div className="mb-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                                <div className="text-[11px] font-bold text-gray-500 mb-1">直近の編集履歴</div>
                                <div className="space-y-1">
                                  {refineHistory.slice(-3).reverse().map((h, idx) => (
                                    <div key={`${h.instruction}-${idx}`} className="text-xs text-gray-700 font-semibold">
                                      - {h.instruction}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="relative">
                              <textarea
                                value={refineInstruction}
                                onChange={(e) => setRefineInstruction(e.target.value)}
                                placeholder="例: 上下の余白をなくして、文字を枠内に収めつつ大きく。医療っぽく清潔感のある写真に寄せて。"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all resize-none text-sm pr-12"
                                rows={2}
                                maxLength={220}
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
                                '上下の余白をなくして、文字を枠内に収めて',
                                '文字を太くして読みやすく',
                                '背景をもっと明るくして',
                                'CTAをもっと目立たせて',
                                '要素を減らしてシンプルに',
                              ].map((suggestion) => (
                                <button
                                  key={suggestion}
                                  onClick={() => setRefineInstruction(suggestion)}
                                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 text-xs rounded-md transition-colors font-semibold"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>

                            {isRefining && (
                              <div className="mt-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-white p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                    <div>
                                      <div className="text-sm font-black text-slate-900">
                                        AI修正中：{REFINE_PHASES[refinePhaseIndex]?.label}
                                      </div>
                                      <div className="text-[11px] text-slate-500 font-semibold">
                                        {REFINE_PHASES[refinePhaseIndex]?.sub}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[11px] text-slate-500 font-semibold">予測残り</div>
                                    <div className="text-sm font-black text-blue-700">
                                      約{formatSec(refinePredictedRemainingMs)}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-3 h-2 rounded-full bg-blue-100 overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full transition-all"
                                    style={{
                                      width: `${Math.max(
                                        5,
                                        Math.min(
                                          95,
                                          ((refinePredictedTotalMs - refinePredictedRemainingMs) /
                                            Math.max(1, refinePredictedTotalMs)) *
                                            100
                                        )
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                                  <span className="text-base leading-none">{REFINE_TIPS[refineTipIndex]?.icon}</span>
                                  <span>{REFINE_TIPS[refineTipIndex]?.text}</span>
                                  <span className="ml-auto text-[11px] text-slate-500 font-semibold">
                                    経過 {refineElapsedSec}秒
                                  </span>
                                </div>

                                <div className="mt-2 text-[11px] text-slate-500 font-semibold">
                                  タブを開いたままお待ちください（バックグラウンドでも進行します）
                                </div>
                              </div>
                            )}
                          </div>
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

{/* CV Banner（削除済み・謎リンク問題解消） */}
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
      {/* （旧）テキストレイヤー合成用canvasは廃止 */}

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
                <div className="font-semibold tabular-nums">
                  予測残り: 約{formatSec(predictedRemainingMs)}（平均から算出）
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                <div className="font-bold text-gray-900 mb-1">このタブを開いたままにしてください</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-semibold">- バックグラウンドでも進行します（別タブで作業OK）</span>
                  <span className="font-semibold">- ただし「閉じる/更新」すると中断される可能性があります</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-gray-500 font-semibold">
                    予測合計: 約{formatSec(predictedTotalMs)} / 経過: {elapsedSec}秒{isHidden ? '（バックグラウンド）' : ''}
                  </div>
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
