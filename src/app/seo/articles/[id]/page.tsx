'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { EditableMarkdownPreview } from '@seo/components/EditableMarkdownPreview'
import { ScorePanel } from './components/ScorePanel'
import { OutlineEditor } from './components/OutlineEditor'
import { ClientErrorBoundary } from '@seo/components/ClientErrorBoundary'
import { GenerationProgress } from '@seo/components/GenerationProgress'
import { Button } from '@seo/components/ui/Button'
import { Badge } from '@seo/components/ui/Badge'
import { analyzeMarkdown } from '@seo/lib/score'
import { slugifyHeading } from '@seo/lib/markdown'
import { CompletionModal } from '@seo/components/CompletionModal'
import { patchSeoClientSettings, readSeoClientSettings } from '@seo/lib/clientSettings'
import { AiThinkingStrip } from '@seo/components/AiThinkingStrip'
import { FeatureGuide } from '@/components/FeatureGuide'
import { CompetitorAnalysisTab } from '@/components/seo/CompetitorAnalysisTab'
import {
  Download,
  Image as ImageIcon,
  Link2,
  RefreshCcw,
  Sparkles,
  ExternalLink,
  Wand2,
  Settings,
  BookOpen,
  Search,
  FileText,
  ArrowLeft,
  Play,
  Pause,
  Eye,
  Edit3,
  Compass,
  Layout,
  Tag,
  CheckCircle,
  AlertTriangle,
  Layers,
  MessageSquare,
  Copy,
  Check,
  Zap,
  Target,
  BarChart3,
  PenTool,
  CheckCircle2,
  MessageCircle,
  Loader2,
  Lock,
  LayoutGrid,
  Braces,
} from 'lucide-react'

type SeoImage = {
  id: string
  kind: string
  title?: string | null
  description?: string | null
  prompt?: string | null
  createdAt: string
}

type SeoAudit = {
  id: string
  report: string
  createdAt: string
}

type SeoKnowledge = {
  id: string
  type: string
  title?: string | null
  content: string
  createdAt: string
}

type SeoReference = {
  id: string
  url: string
  title?: string | null
  summary?: string | null
  headings?: any
  insights?: any
  createdAt: string
}

type ComparisonCandidate = {
  name: string
  websiteUrl?: string
  pricing?: string
  features?: string[]
  description?: string
  source?: string
}

type Article = {
  id: string
  title: string
  status: string
  targetChars: number
  keywords?: string[]
  outline?: string | null
  finalMarkdown?: string | null
  jobs?: { id: string; status: string; progress: number; step: string; error?: string | null; createdAt: string }[]
  memo?: { content: string } | null
  audits: SeoAudit[]
  images: SeoImage[]
  linkChecks: { url: string; ok: boolean; statusCode?: number | null; finalUrl?: string | null; error?: string | null }[]
  knowledgeItems?: SeoKnowledge[]
  references?: SeoReference[]
  llmoOptions?: any
  sections?: { id: string; status: string; headingPath?: string; content?: string }[]
  requestText?: string | null
  referenceImages?: { name: string; dataUrl: string }[] | null
  autoBundle?: boolean
  createdAt: string
  // 比較記事関連
  mode?: string
  comparisonCount?: number
  comparisonCandidates?: ComparisonCandidate[]
  comparisonConfig?: { count?: number; region?: string; template?: string }
}

type TocItem = { id: string; text: string; level: 2 | 3 }

// 画像カードコンポーネント（サムネ・図解で共通利用）
function ImageCard({
  img,
  isMediaLocked,
  mediaLockLabel,
  upgradeHref,
  mediaBusy,
  imgLoaded,
  imgGenerating,
  imgRetry,
  bumpRetry,
  setImgLoaded,
  setImgGenerating,
  setImageDetail,
  downloadImage,
  copyToClipboard,
  setRegenImage,
  setRegenPrompt,
  setRegenOpen,
  sanitizeLegacyBannerPrompt,
  entitlements,
  router,
}: {
  img: SeoImage
  isMediaLocked: boolean
  mediaLockLabel: string
  upgradeHref: string
  mediaBusy: boolean
  imgLoaded: Record<string, boolean>
  imgGenerating: Record<string, boolean>
  imgRetry: Record<string, number>
  bumpRetry: (id: string) => void
  setImgLoaded: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setImgGenerating: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  setImageDetail: (img: SeoImage | null) => void
  downloadImage: (img: SeoImage) => void
  copyToClipboard: (text: string) => void
  setRegenImage: (img: SeoImage | null) => void
  setRegenPrompt: (prompt: string) => void
  setRegenOpen: (open: boolean) => void
  sanitizeLegacyBannerPrompt: (p: string) => string
  entitlements: any
  router: any
}) {
  return (
    <div className="group bg-white rounded-2xl sm:rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500">
      <div className="aspect-video relative overflow-hidden bg-gray-50">
        <button
          type="button"
          onClick={() => {
            if (isMediaLocked) {
              router.push(upgradeHref)
              return
            }
            setImageDetail(img)
          }}
          className="block w-full h-full"
          title={isMediaLocked ? '有料プランで解放（クリックで移動）' : 'クリックで拡大表示'}
        >
          <img
            src={`/api/seo/images/${img.id}?v=${imgRetry[img.id] || 0}`}
            className={`w-full h-full object-cover transition-all duration-700 ${isMediaLocked ? 'grayscale-[0.2]' : 'group-hover:scale-105'}`}
            alt={img.title || ''}
            onLoad={(e) => {
              const el = e.currentTarget
              if (!el?.naturalWidth || !el?.naturalHeight) {
                setImgLoaded((prev) => ({ ...prev, [img.id]: false }))
                setImgGenerating((prev) => ({ ...prev, [img.id]: true }))
                setTimeout(() => bumpRetry(img.id), 1200)
                return
              }
              setImgLoaded((prev) => ({ ...prev, [img.id]: true }))
              setImgGenerating((prev) => ({ ...prev, [img.id]: false }))
            }}
            onError={() => {
              setImgLoaded((prev) => ({ ...prev, [img.id]: false }))
              setImgGenerating((prev) => ({ ...prev, [img.id]: true }))
              setTimeout(() => bumpRetry(img.id), 1200)
            }}
          />
        </button>
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex gap-2">
          <Badge tone={img.kind === 'BANNER' ? 'orange' : 'blue'}>{img.kind === 'BANNER' ? 'サムネイル' : '図解'}</Badge>
        </div>
        {isMediaLocked && (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-sm rounded-2xl bg-black/55 border border-white/20 backdrop-blur-[2px] p-4 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-black">
                  <Lock className="w-4 h-4" />
                  {mediaLockLabel}
                </div>
                <p className="mt-3 text-white text-sm font-black">アイキャッチの操作（DL/コピー）は有料プラン限定</p>
                <p className="mt-1 text-white/80 text-[11px] font-bold">
                  画像は表示のみです。アップグレードでダウンロードできます。
                </p>
                <Link href={upgradeHref} className="inline-flex mt-3">
                  <span className="h-10 px-5 rounded-xl bg-white text-gray-900 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-100">
                    料金プランを見る
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
        {!isMediaLocked && (mediaBusy || !imgLoaded[img.id] || !!imgGenerating[img.id]) && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-50" />
            <motion.div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0) 35%, rgba(255,255,255,0.75) 50%, rgba(255,255,255,0) 65%, rgba(255,255,255,0) 100%)',
                backgroundSize: '200% 100%',
              }}
              animate={{ backgroundPositionX: ['200%', '-200%'] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="px-5 py-3 rounded-2xl bg-white/85 border border-gray-200 text-gray-800 text-xs font-black shadow-sm backdrop-blur-[2px]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>生成中</span>
                  <span className="inline-flex items-center gap-0.5 text-gray-500 font-black">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '140ms' }} />
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '280ms' }} />
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-[240px] max-w-[70vw] rounded-full bg-gray-200 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500"
                    initial={{ x: '-60%' }}
                    animate={{ x: ['-60%', '110%'] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '55%' }}
                  />
                </div>
                <div className="mt-1 text-[10px] font-bold text-gray-500">
                  ※ 生成→保存→反映まで少し時間がかかる場合があります
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 sm:p-5">
        <p className="font-black text-gray-900 truncate text-sm sm:text-base">{img.title || '無題の画像'}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{new Date(img.createdAt).toLocaleDateString()}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => (isMediaLocked ? router.push(upgradeHref) : setImageDetail(img))}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border font-black text-xs transition-colors ${
              isMediaLocked
                ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
            }`}
          >
            {isMediaLocked ? <Lock className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {isMediaLocked ? 'ロック中' : 'ひらく'}
          </button>
          <button
            type="button"
            onClick={() => (isMediaLocked ? router.push(upgradeHref) : downloadImage(img))}
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border font-black text-xs transition-colors ${
              isMediaLocked
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
            }`}
            disabled={isMediaLocked}
          >
            <Download className="w-4 h-4" />
            ダウンロード
          </button>
          <button
            type="button"
            onClick={() =>
              isMediaLocked
                ? router.push(upgradeHref)
                : copyToClipboard(`![${img.title || 'image'}](/api/seo/images/${img.id})`)
            }
            className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl border font-black text-xs transition-colors ${
              isMediaLocked
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
            }`}
            disabled={isMediaLocked}
          >
            <Copy className="w-4 h-4" />
            Markdownコピー
          </button>
          <Link
            href={isMediaLocked || !entitlements?.isLoggedIn ? upgradeHref : `/seo/images/${img.id}`}
            className="inline-flex"
          >
            <span
              className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl font-black text-xs transition-colors ${
                isMediaLocked ? 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              {isMediaLocked || !entitlements?.isLoggedIn ? '料金プラン' : '詳細ページ'}
            </span>
          </Link>
          {entitlements?.canUseSeoImages && (
            <button
              type="button"
              onClick={() => {
                setRegenImage(img)
                const p = String(img.prompt || '')
                setRegenPrompt(img.kind === 'BANNER' ? sanitizeLegacyBannerPrompt(p) : p)
                setRegenOpen(true)
              }}
              className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700"
              title="プロンプトを編集して再生成"
            >
              <Wand2 className="w-4 h-4" />
              再生成
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function extractTocFromMarkdown(md: string): TocItem[] {
  const text = String(md || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  const out: TocItem[] = []
  const counts = new Map<string, number>()
  let inCode = false
  for (const raw of lines) {
    const line = raw
    if (line.startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!m) continue
    const level = m[1].length as 2 | 3
    const t = m[2].trim()
    if (!t) continue
    const base = slugifyHeading(t)
    const n = (counts.get(base) || 0) + 1
    counts.set(base, n)
    const id = n === 1 ? base : `${base}-${n}`
    out.push({ id, text: t, level })
    if (out.length >= 40) break
  }
  return out
}

function stripCoverFromMarkdown(md: string, bannerId?: string | null): string {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  let i = 0
  // drop leading empty
  while (i < lines.length && !lines[i].trim()) i++
  // drop top H1
  if (lines[i]?.startsWith('# ')) {
    i++
    while (i < lines.length && !lines[i].trim()) i++
  }
  // drop top banner image line if it matches
  if (bannerId) {
    const needle = `/api/seo/images/${bannerId}`
    if (lines[i] && lines[i].includes(needle)) {
      i++
      while (i < lines.length && !lines[i].trim()) i++
    }
  }
  return lines.slice(i).join('\n').trim()
}

// シンプル化: 核心的な機能のみに絞る＋SEOスコア/見出し操作を追加
const TABS = [
  { id: 'preview', label: 'プレビュー', icon: Eye, color: 'text-blue-500' },
  { id: 'media', label: '画像', icon: ImageIcon, color: 'text-orange-500' },
  { id: 'competitors', label: '競合記事', icon: Search, color: 'text-cyan-500' },
  { id: 'score', label: 'SEOスコア', icon: BarChart3, color: 'text-emerald-500' },
  { id: 'outline', label: '見出し編集', icon: Layers, color: 'text-indigo-500' },
  { id: 'edit', label: '本文編集', icon: Edit3, color: 'text-purple-500' },
  { id: 'export', label: 'ダウンロード', icon: Download, color: 'text-gray-500' },
] as const

const DEFAULT_BANNER_PROMPT_TEMPLATE = `あなたは「広告・記事バナーを専門に制作するトップレベルのAIデザイナー」です。
以下の記事内容を正確に理解し、成果が出ている記事バナー画像の構成・情報設計・視線誘導を踏襲した
"クリックされる記事バナー画像"を生成してください。

# 参照するバナーの共通特徴（必ず反映）
- 大きく強いメインコピー（一目で内容が伝わる）
- 数字・実績・条件などの"判断材料"を明示
- 人物 or 商品を主役にした視線誘導
- 情報は多いが、整理されていて読みやすい
- 広告感はあるが「記事内容と完全一致」している

# 入力情報
【記事タイトル】
{{ARTICLE_TITLE}}

【記事本文】
{{ARTICLE_TEXT}}

【用途】
記事バナー（アイキャッチ／SNS／広告流用可）

【サイズ】
1200x628（16:9、SNS/広告向け）

【想定ジャンル】
{{GENRE}}

# ステップ1：記事理解（必須）
以下を内部で必ず整理してください。
- 記事の結論・一番伝えたいこと
- 読者が「自分ごと」と感じる悩み・欲求
- 記事内で最も強い訴求ポイント
- 記事の信頼性を支える要素（実績・数字・条件・専門性）

# ステップ2：コピー設計（超重要）
以下の構成で文字情報を設計してください。

■ メインコピー（最重要・20〜30文字）
- 記事の結論 or ベネフィットを端的に
- 強いが誇張しない
- 記事内表現を優先

■ サブコピー（補足・10〜20文字）
- 条件・背景・安心材料

■ 強調ワード
- 数字（％、年齢、金額、実績など）
- 限定性・簡単さ・変化

■ CTAテキスト（短く）
- 「詳しくはこちら」
- 「今すぐチェック」
- 「無料で見る」など

※ 記事に書かれていない数字・実績は絶対に作らない

# ステップ3：デザイン指示（成果バナー準拠）
- 広告で実際に使われている記事バナーの構図を採用
- メインコピーは大きく、背景と強いコントラスト
- 人物がいる場合は、自然で信頼感のある表情
- 商品がある場合は、清潔感・質感が伝わる配置
- 色はジャンルに合わせて最適化
  - 転職・IT：青・ネイビー
  - 美容：白・パステル・透明感
  - EC：オレンジ・赤で訴求
- 情報は多くても「ブロック化」して整理

# 禁止事項
- 記事内容とズレた煽り表現
- 根拠のないNo.1表記
- 読めないほど小さい文字
- 世界観だけで中身が伝わらないデザイン

# 出力要件
- 記事バナー画像を1枚生成
- 広告・記事一覧に並んでも"負けない"視認性
- 見ただけで「この記事、気になる」と思わせる完成度

以上をすべて満たした、プロ品質の記事バナー画像を生成してください。`

const DEFAULT_DIAGRAM_PROMPT_TEMPLATE = `あなたは「SEO記事用の図解バナー制作」を専門とするトップクラスのデザイナーです。
今回の目的は、オウンドメディアの記事内容を一瞬で理解できる
“とにかく分かりやすい図解バナー画像”を制作することです。

【前提】
・使用用途：オウンドメディアのSEO記事内・サムネイル
・ターゲット：専門知識がない人でも直感的に理解できる読者
・記事内容：下記の本文内容を正確に要約・視覚化すること
・難しい表現や抽象表現は使わない
・「見ただけで内容が分かる」ことを最優先する

【デザインの方向性】
・カラー：ポップで明るい（青・水色・オレンジ・黄などをベースに）
・雰囲気：親しみやすい／やさしい／説明がうまい資料のような印象
・線は太め、要素は大きめ
・情報量は詰め込みすぎず、整理された構成にする
・背景は白 or 薄い単色で、視認性を最優先

【図解のルール】
・文章をそのまま並べるのではなく「構造化」する
・以下を必ず意識する
  - 因果関係（なぜ → どうなる）
  - 手順（STEP1 → STEP2 → STEP3）
  - 比較（AとBの違い）
  - 課題 → 解決策 の流れ
・矢印、アイコン、囲み枠を使って視線誘導を行う
・1つの図解で「伝えたいメッセージは1つ」に絞る

【テキストの扱い】
・文字量は最小限
・1フレーズは15文字以内を目安
・専門用語は使わず、使う場合は必ず噛み砕く
・「〇〇とは？」が一瞬で分かる見出しを入れる

【禁止事項】
・抽象的すぎるイラスト
・意味のない装飾
・読まないと理解できない画像
・文字だらけの画像

【ゴール】
・記事を読まなくても、画像だけで
  「この記事で何が分かるか」が理解できる状態
・SNSやサムネで見ても内容が伝わる図解

【元となる記事内容】
▼ここにSEO記事本文、または要点を貼り付ける▼`

function SeoArticleInner() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const searchParams = useSearchParams()
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autoRun, setAutoRun] = useState(false)
  const [resumeBusy, setResumeBusy] = useState(false)
  const [resumeNotice, setResumeNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [tab, setTab] = useState<typeof TABS[number]['id']>('preview')
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [completionOpen, setCompletionOpen] = useState(false)
  const [completionPopupEnabled, setCompletionPopupEnabled] = useState(true)
  const prevArticleStatusRef = useRef<string | null>(null)
  const dontShowAgainRef = useRef(false)
  const notFoundErrorCountRef = useRef(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const [entitlements, setEntitlements] = useState<null | { canUseSeoImages: boolean; plan: string; isLoggedIn: boolean }>(null)
  const [mediaBusy, setMediaBusy] = useState(false)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenImage, setRegenImage] = useState<SeoImage | null>(null)
  const [regenPrompt, setRegenPrompt] = useState('')
  const autoImagesRequestedRef = useRef(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [bannerPromptTemplate, setBannerPromptTemplate] = useState(DEFAULT_BANNER_PROMPT_TEMPLATE)
  const [diagramPromptTemplate, setDiagramPromptTemplate] = useState(DEFAULT_DIAGRAM_PROMPT_TEMPLATE)
  
  // 記事の同テーマ再生成
  const [regenArticleOpen, setRegenArticleOpen] = useState(false)
  const [regenArticleTitle, setRegenArticleTitle] = useState('')
  const [regenArticleKeywords, setRegenArticleKeywords] = useState('')
  const [regenArticleFix, setRegenArticleFix] = useState('')
  const [regenArticleBusy, setRegenArticleBusy] = useState(false)
  const [regenArticleError, setRegenArticleError] = useState<string | null>(null)
  
  // 比較サービス追加モーダル
  const [addServiceOpen, setAddServiceOpen] = useState(false)
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceUrl, setNewServiceUrl] = useState('')
  const [newServicePricing, setNewServicePricing] = useState('')
  const [newServiceDescription, setNewServiceDescription] = useState('')
  const [addingService, setAddingService] = useState(false)
  const [addServiceError, setAddServiceError] = useState<string | null>(null)
  const [imageDetail, setImageDetail] = useState<SeoImage | null>(null)
  const [imgLoaded, setImgLoaded] = useState<Record<string, boolean>>({})
  const [imgRetry, setImgRetry] = useState<Record<string, number>>({})
  const [imgGenerating, setImgGenerating] = useState<Record<string, boolean>>({})

  function sanitizeLegacyBannerPrompt(raw: string): string {
    const s = String(raw || '')
    if (!s) return s
    
    // 古い「記事バナー」プロンプト全体を検出した場合、新しいデフォルトに置き換え
    if (
      s.includes('あなたは記事バナー') &&
      s.includes('画像内に文字は一切入れない')
    ) {
      // 古いプロンプト全体を新しいプロンプトに置き換え
      return DEFAULT_BANNER_PROMPT_TEMPLATE
    }
    
    const lines = s.replace(/\r\n/g, '\n').split('\n')

    const filtered = lines.filter((line) => {
      const t = line.trim()
      if (!t) return true
      // 過去ログに混入していた「テキストを入れない」系を除去（SEO=ドヤライティングAIのみ）
      // より広範囲にマッチするように正規表現を使用
      if (/文字.*入れない/i.test(t)) return false
      if (/文字は一切/i.test(t)) return false
      if (/画像内に文字/i.test(t)) return false
      if (/NO TEXT/i.test(t)) return false
      if (/ネガティブスペース/i.test(t)) return false
      if (/後から文字を載せ/i.test(t)) return false
      if (/余白.*確保/i.test(t)) return false
      if (/大きな余白/i.test(t)) return false
      if (/参考.*後から載せる.*コピー/i.test(t)) return false
      if (/画像に文字は入れない/i.test(t)) return false
      // CTAを作らない系
      if (/CTA要素/i.test(t)) return false
      if (/CTA.*入れない/i.test(t)) return false
      if (/作らない.*入れない/i.test(t)) return false
      // 広告バナーではない系
      if (/広告バナーではない/i.test(t)) return false
      // 重要ルール:のヘッダー
      if (/^重要ルール[:：]/i.test(t)) return false
      return true
    })

    const out = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    return out
  }

  const mediaLockState = useMemo<'loading' | 'locked' | 'unlocked'>(() => {
    if (tab !== 'media') return 'unlocked'
    if (!entitlements) return 'loading'
    return entitlements.canUseSeoImages ? 'unlocked' : 'locked'
  }, [entitlements, tab])

  const upgradeHref = useMemo(() => {
    if (!entitlements) return '/seo/pricing'
    return entitlements.isLoggedIn ? '/seo/dashboard/plan' : '/seo/pricing'
  }, [entitlements])

  const isMediaLocked = mediaLockState !== 'unlocked'
  const mediaLockLabel = mediaLockState === 'loading' ? '権限を確認中…' : '有料プランで解放'

  const bumpRetry = useCallback((id: string) => {
    setImgRetry((prev) => {
      const cur = Number(prev[id] || 0)
      // 無限ループ回避（最大10回）
      const next = Math.min(10, cur + 1)
      return next === cur ? prev : { ...prev, [id]: next }
    })
  }, [])


  const markdown = useMemo(() => article?.finalMarkdown || '', [article])
  const score = useMemo(() => analyzeMarkdown(markdown || ''), [markdown])
  const bannerImageId = useMemo(() => {
    const imgs = (article?.images || []).filter((x) => x.kind === 'BANNER')
    if (!imgs.length) return null
    const sorted = imgs
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return sorted[0]?.id || null
  }, [article])
  const toc = useMemo(() => extractTocFromMarkdown(markdown), [markdown])
  const previewMarkdown = useMemo(() => stripCoverFromMarkdown(markdown, bannerImageId), [markdown, bannerImageId])
  const readingMinutes = useMemo(() => {
    const chars = (markdown || '').length
    // 600-900字/分くらいを想定して安全側に丸める
    return Math.max(1, Math.round(chars / 850))
  }, [markdown])

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading === true
    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/seo/articles/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        // 404エラーの場合、カウントを増やす
        if (res.status === 404) {
          notFoundErrorCountRef.current += 1
          // 404エラーが3回連続で発生した場合、ポーリングを停止
          if (notFoundErrorCountRef.current >= 3) {
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current)
              pollingIntervalRef.current = null
            }
            setLoadError('記事が見つかりません。記事が削除されたか、アクセス権限がない可能性があります。')
            if (showLoading) setArticle(null)
            return
          }
          throw new Error(json?.error || '記事が見つかりません')
        }
        // 404以外のエラーはカウントをリセット
        notFoundErrorCountRef.current = 0
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      // 成功した場合、エラーカウントをリセット
      notFoundErrorCountRef.current = 0
      setArticle(json.article || null)
      setMemo(json.article?.memo?.content || '')
      setMarkdownDraft(json.article?.finalMarkdown || '')
    } catch (e: any) {
      const errorMessage = e?.message || '読み込みに失敗しました'
      setLoadError(errorMessage)
      if (showLoading) setArticle(null)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [id])

  async function act(name: string, fn: () => Promise<void>) {
    setBusy(name)
    setMessage(null)
    try {
      await fn()
      await load()
      setMessage('完了しました ✓')
      setTimeout(() => setMessage(null), 3000)
    } catch (e: any) {
      setMessage(e?.message || '失敗しました')
    } finally {
      setBusy(null)
    }
  }

  // サービスを追加して再生成
  async function handleAddService(regenerate: boolean = false) {
    if (!newServiceName.trim()) {
      setAddServiceError('サービス名を入力してください')
      return
    }
    setAddingService(true)
    setAddServiceError(null)
    try {
      const res = await fetch(`/api/seo/articles/${id}/candidates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidates: [{
            name: newServiceName.trim(),
            websiteUrl: newServiceUrl.trim() || undefined,
            pricing: newServicePricing.trim() || undefined,
            description: newServiceDescription.trim() || undefined,
          }],
          regenerate,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || '追加に失敗しました')
      }
      // 成功したらフォームをリセット
      setNewServiceName('')
      setNewServiceUrl('')
      setNewServicePricing('')
      setNewServiceDescription('')
      setAddServiceOpen(false)
      await load({ showLoading: false })
      if (regenerate && json.jobId) {
        // 再生成ジョブが作成された場合、ジョブページへ遷移
        router.push(`/seo/jobs/${json.jobId}?auto=1`)
      } else {
        setMessage(`サービスを追加しました（現在${json.count}社）`)
        setTimeout(() => setMessage(null), 3000)
      }
    } catch (e: any) {
      setAddServiceError(e?.message || '追加に失敗しました')
    } finally {
      setAddingService(false)
    }
  }

  useEffect(() => {
    load({ showLoading: true })
    // ポーリングインターバルをrefに保存
    pollingIntervalRef.current = setInterval(() => {
      load({ showLoading: false })
    }, 3000)
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [load])

  // 記事が完成済み（DONE/ERROR/EXPORTED）になったらポーリングを停止
  useEffect(() => {
    const status = String((article as any)?.status || '').toUpperCase()
    if (status === 'DONE' || status === 'ERROR' || status === 'EXPORTED') {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [(article as any)?.status])

  useEffect(() => {
    setCompletionPopupEnabled(readSeoClientSettings().completionPopupEnabled)
  }, [])

  // /seo/articles/[id]?tab=media のようにクエリでタブを指定できるようにする
  useEffect(() => {
    const t = searchParams.get('tab')
    if (!t) return
    if (TABS.some((x) => x.id === t)) {
      setTab(t as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 画像生成プロンプトテンプレを復元
  useEffect(() => {
    try {
      const s = readSeoClientSettings()
      const tpl = (s as any)?.seoImagePromptTemplates
      if (tpl?.banner) {
        const b = String(tpl.banner)
        // 旧テンプレ（文字なし前提）が残っている場合は、最新デフォルトへ自動移行
        if (
          (b.includes('画像内に文字') && b.includes('入れない')) ||
          b.includes('文字は一切入れない') ||
          b.includes('画像に文字は入れない') ||
          b.includes('ネガティブスペース') ||
          b.includes('後から文字を載せられる') ||
          b.includes('これは広告バナーではない') ||
          b.includes('CTA要素') ||
          b.includes('記事アイキャッチ画像')
        ) {
          setBannerPromptTemplate(DEFAULT_BANNER_PROMPT_TEMPLATE)
          patchSeoClientSettings({
            seoImagePromptTemplates: {
              banner: DEFAULT_BANNER_PROMPT_TEMPLATE,
              diagram: typeof tpl?.diagram === 'string' ? String(tpl.diagram) : DEFAULT_DIAGRAM_PROMPT_TEMPLATE,
            },
          })
        } else {
          setBannerPromptTemplate(b)
        }
      }
      if (tpl?.diagram) setDiagramPromptTemplate(String(tpl.diagram))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    const cur = article?.status || null
    const prev = prevArticleStatusRef.current
    prevArticleStatusRef.current = cur
    if (!article) return
    if (!completionPopupEnabled) return
    if (cur !== 'DONE') return
    if (!prev || prev === 'DONE') return

    try {
      const key = `doyaSeo.completionPopup.shown.article.${id}`
      if (window.sessionStorage.getItem(key)) return
      window.sessionStorage.setItem(key, '1')
    } catch {
      // ignore
    }
    setCompletionOpen(true)
  }, [article, article?.status, completionPopupEnabled, id])

  // 画像タブを開いた時だけ権限を取得（無駄な呼び出しを避ける）
  useEffect(() => {
    if (tab !== 'media') return
    if (entitlements) return
    ;(async () => {
      try {
        const res = await fetch('/api/seo/entitlements', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (json?.success) setEntitlements(json)
        else setEntitlements({ canUseSeoImages: false, plan: 'UNKNOWN', isLoggedIn: false })
      } catch {
        setEntitlements({ canUseSeoImages: false, plan: 'UNKNOWN', isLoggedIn: false })
      }
    })()
  }, [tab, entitlements])

  async function ensureImages() {
    if (mediaBusy) return
    setMediaBusy(true)
    setMediaError(null)
    try {
      // 生成中に「白抜け」して見えないことがあるため、表示側を生成中状態に寄せる
      setImgGenerating((prev) => {
        const next = { ...prev }
        for (const x of article?.images || []) next[String(x.id)] = true
        return next
      })
      setImgLoaded((prev) => {
        const next = { ...prev }
        for (const x of article?.images || []) next[String(x.id)] = false
        return next
      })
      // プロンプトテンプレを送って、記事内容に合わせた生成にする
      const res = await fetch(`/api/seo/articles/${id}/images/ensure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bannerPromptTemplate: bannerPromptTemplate?.trim() || undefined,
          diagramPromptTemplate: diagramPromptTemplate?.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `生成に失敗しました (${res.status})`)
      await load({ showLoading: false })
    } catch (e: any) {
      setMediaError(e?.message || '画像生成に失敗しました')
    } finally {
      setMediaBusy(false)
    }
  }

  // 記事が完成したら（autoBundleがONなら）自動で画像生成を試行する
  useEffect(() => {
    if (!article) return
    if (!article.autoBundle) return
    if (article.status !== 'DONE') return
    if (autoImagesRequestedRef.current) return
    // 既に画像がある程度ある場合はスキップ（サーバ側で不足分のみ生成する）
    const hasAny = (article.images || []).length > 0
    if (hasAny) return
    autoImagesRequestedRef.current = true
    // 自動生成は「ログイン + 有料」の場合のみ（それ以外は401/403になるため叩かない）
    ;(async () => {
      try {
        const res = await fetch('/api/seo/entitlements', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json?.success !== true) return
        if (!json?.isLoggedIn) return
        if (!json?.canUseSeoImages) return
        // 失敗してもUIは壊さない（ネットワーク/生成失敗など）
        await ensureImages()
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, article?.status, article?.autoBundle])

  async function regenerateImage() {
    if (!regenImage) return
    if (mediaBusy) return
    setMediaBusy(true)
    setMediaError(null)
    try {
      const rid = String(regenImage.id || '')
      if (rid) {
        setImgGenerating((prev) => ({ ...prev, [rid]: true }))
        setImgLoaded((prev) => ({ ...prev, [rid]: false }))
      }
      const res = await fetch(`/api/seo/images/${regenImage.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: regenPrompt }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `再生成に失敗しました (${res.status})`)
      setRegenOpen(false)
      setRegenImage(null)
      setRegenPrompt('')
      await load({ showLoading: false })
    } catch (e: any) {
      setMediaError(e?.message || '再生成に失敗しました')
    } finally {
      setMediaBusy(false)
      const rid = String(regenImage?.id || '')
      if (rid) setImgGenerating((prev) => ({ ...prev, [rid]: false }))
    }
  }

  function openRegenerateArticle() {
    if (!article) return
    setRegenArticleTitle(String(article.title || ''))
    setRegenArticleKeywords(
      (Array.isArray((article as any).keywords) ? ((article as any).keywords as any[]) : [])
        .map((s) => String(s || '').trim())
        .filter(Boolean)
        .join('\n')
    )
    setRegenArticleFix('')
    setRegenArticleError(null)
    setRegenArticleOpen(true)
  }

  async function submitRegenerateArticle() {
    if (!article) return
    if (regenArticleBusy) return

    const title = regenArticleTitle.trim() || String(article.title || '')
    const keywords = regenArticleKeywords
      .split(/[\n,、]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50)

    if (!title) {
      setRegenArticleError('タイトルを入力してください')
      return
    }
    if (!keywords.length) {
      setRegenArticleError('キーワードを1つ以上入力してください')
      return
    }

    const baseReq = String((article as any).requestText || '').trim()
    const fix = regenArticleFix.trim()
    const requestText = (baseReq || fix)
      ? [baseReq, fix ? `【再生成の修正指示】\n${fix}` : ''].filter(Boolean).join('\n\n')
      : null

    setRegenArticleBusy(true)
    setRegenArticleError(null)
    try {
      const payload: any = {
        title,
        keywords,
        persona: String((article as any).persona || ''),
        searchIntent: String((article as any).searchIntent || ''),
        targetChars: Number((article as any).targetChars || 10000),
        referenceUrls: Array.isArray((article as any).referenceUrls) ? (article as any).referenceUrls : [],
        tone: (article as any).tone || '丁寧',
        forbidden: Array.isArray((article as any).forbidden) ? (article as any).forbidden : [],
        llmoOptions: (article as any).llmoOptions ?? undefined,
        requestText,
        referenceImages: (article as any).referenceImages ?? null,
        autoBundle: (article as any).autoBundle ?? true,
        mode: (article as any).mode ?? 'standard',
        comparisonConfig: (article as any).comparisonConfig ?? null,
        comparisonCandidates: (article as any).comparisonCandidates ?? null,
        referenceInputs: (article as any).referenceInputs ?? null,
        createJob: true,
      }

      const res = await fetch('/api/seo/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `再生成に失敗しました (${res.status})`)
      }

      const jobId = json.jobId || json.job?.id
      const articleId = json.articleId || json.article?.id
      setRegenArticleOpen(false)
      if (jobId) router.push(`/seo/jobs/${jobId}?auto=1`)
      else if (articleId) router.push(`/seo/articles/${articleId}`)
      else throw new Error('再生成結果のID取得に失敗しました')
    } catch (e: any) {
      setRegenArticleError(e?.message || '再生成に失敗しました')
    } finally {
      setRegenArticleBusy(false)
    }
  }


  useEffect(() => {
    if (searchParams.get('auto') === '1') setAutoRun(true)
  }, [searchParams])

  const latestJob = article?.jobs?.[0]
  const latestJobId = latestJob?.id

  const advanceOnce = useCallback(async () => {
    if (!latestJobId) return
    setActionError(null)
    try {
      const res = await fetch(`/api/seo/jobs/${latestJobId}/advance`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || 'advance failed')
      }
      await load({ showLoading: false })
    } catch (e: any) {
      setActionError(e.message)
      setAutoRun(false)
    }
  }, [latestJobId, load])

  // 途中から再開（タイトル/キーワードは維持、既存セクションも維持）
  const resumeFromCurrent = useCallback(async () => {
    if (!article?.id || resumeBusy) return
    setResumeBusy(true)
    setResumeNotice(null)
    try {
      const res = await fetch(`/api/seo/articles/${article.id}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resetSections: false, autoStart: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `再開に失敗しました (${res.status})`)
      }
      const jobId = json.jobId
      setResumeNotice('途中から生成を再開しました（ジョブ画面で進捗を確認できます）')
      if (jobId) router.push(`/seo/jobs/${jobId}?auto=1`)
      else await load({ showLoading: false })
    } catch (e: any) {
      setResumeNotice(e?.message || '再開に失敗しました')
    } finally {
      setResumeBusy(false)
      setTimeout(() => setResumeNotice(null), 4500)
    }
  }, [article?.id, load, resumeBusy, router])

  useEffect(() => {
    if (!autoRun || !latestJob) return
    if (latestJob.status === 'done' || latestJob.status === 'error') return
    const t = setTimeout(advanceOnce, 800)
    return () => clearTimeout(t)
  }, [autoRun, latestJob, advanceOnce])

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { }
  }

  async function downloadImage(img: SeoImage) {
    try {
      const res = await fetch(`/api/seo/images/${img.id}`)
      if (!res.ok) throw new Error(`download failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const safeTitle = String(img.title || img.kind || 'image')
        .replace(/[\\/:*?"<>|]/g, '_')
        .slice(0, 80)
      const ext = (res.headers.get('Content-Type') || '').includes('png') ? 'png' : 'png'
      const a = document.createElement('a')
      a.href = url
      a.download = `doya-${safeTitle}-${img.id.slice(0, 6)}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setMediaError(e?.message || 'ダウンロードに失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!article) {
    const isNotFound = loadError?.includes('記事が見つかりません') || loadError?.includes('not found')
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-gray-900 mb-4">記事が見つかりません</h2>
        {loadError && <p className="text-gray-600 mb-6">{loadError}</p>}
        <div className="flex gap-4 justify-center">
          <Button variant="primary" onClick={() => {
            notFoundErrorCountRef.current = 0
            load({ showLoading: true })
            // ポーリングを再開
            if (!pollingIntervalRef.current) {
              pollingIntervalRef.current = setInterval(() => {
                load({ showLoading: false })
              }, 3000)
            }
          }}>再試行</Button>
          {isNotFound && (
            <Link href="/seo/articles">
              <Button variant="secondary">記事一覧に戻る</Button>
            </Link>
          )}
        </div>
      </div>
    )
  }

  const charProgress = Math.min(100, Math.round((score.charCount / article.targetChars) * 100))
  const isGenerating = latestJob && latestJob.status !== 'done' && latestJob.status !== 'error'

  return (
    <main className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-0">
        <CompletionModal
          open={completionOpen}
          title={article.title}
          subtitle="プレビューを確認して、必要ならAI修正チャットで仕上げましょう。"
          primaryLabel="プレビューを見る"
          onPrimary={() => setTab('preview')}
          onClose={() => {
            if (dontShowAgainRef.current) {
              const next = patchSeoClientSettings({ completionPopupEnabled: false })
              setCompletionPopupEnabled(next.completionPopupEnabled)
            }
            dontShowAgainRef.current = false
            setCompletionOpen(false)
          }}
          onDontShowAgainChange={(v) => {
            dontShowAgainRef.current = v
          }}
        />

        {/* サービス追加モーダル */}
        <AnimatePresence>
          {addServiceOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => !addingService && setAddServiceOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-gray-900">比較サービスを追加</h3>
                      <p className="text-sm text-gray-500">記事に追加する新しいサービスを入力してください</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      サービス名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="例：DMM英会話"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                      disabled={addingService}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">公式サイトURL（任意）</label>
                    <input
                      type="url"
                      value={newServiceUrl}
                      onChange={(e) => setNewServiceUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                      disabled={addingService}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">料金情報（任意）</label>
                    <input
                      type="text"
                      value={newServicePricing}
                      onChange={(e) => setNewServicePricing(e.target.value)}
                      placeholder="例：月額6,480円〜"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                      disabled={addingService}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">概要・特徴（任意）</label>
                    <textarea
                      value={newServiceDescription}
                      onChange={(e) => setNewServiceDescription(e.target.value)}
                      placeholder="例：24時間レッスン可能、フィリピン人講師が中心"
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm resize-none"
                      disabled={addingService}
                    />
                  </div>
                  {addServiceError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                      {addServiceError}
                    </div>
                  )}
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => !addingService && setAddServiceOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors"
                    disabled={addingService}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddService(false)}
                    className="flex-1 px-4 py-3 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                    disabled={addingService || !newServiceName.trim()}
                  >
                    {addingService ? '追加中...' : '候補に追加'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddService(true)}
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={addingService || !newServiceName.trim()}
                  >
                    <RefreshCcw className="w-4 h-4" />
                    {addingService ? '追加中...' : '追加して再生成'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 同テーマ再生成モーダル */}
        <AnimatePresence>
          {regenArticleOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => !regenArticleBusy && setRegenArticleOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.98, opacity: 0 }}
                className="w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center">
                      <Wand2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-gray-900">同じテーマで再生成</h3>
                      <p className="text-sm text-gray-500">
                        タイトル/キーワードは引き継ぎつつ、修正指示を追加して再生成できます
                      </p>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      タイトル <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regenArticleTitle}
                      onChange={(e) => setRegenArticleTitle(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold"
                      disabled={regenArticleBusy}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      キーワード（改行区切り） <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={regenArticleKeywords}
                      onChange={(e) => setRegenArticleKeywords(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold resize-none"
                      disabled={regenArticleBusy}
                      placeholder="例：AIライティングツール\nSEO\n比較"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">修正内容（追加指示）</label>
                    <textarea
                      value={regenArticleFix}
                      onChange={(e) => setRegenArticleFix(e.target.value)}
                      rows={5}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm resize-none"
                      disabled={regenArticleBusy}
                      placeholder="例：比較表に“無料枠の有無”を追加／各ツールの注意点を1行で入れる／初心者向けに噛み砕く…"
                    />
                    <p className="mt-2 text-[11px] text-gray-500 font-bold">
                      ※「同じテーマ」で再生成しつつ、この指示を一次情報として優先的に反映します
                    </p>
                  </div>
                  {regenArticleError && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-bold">
                      {regenArticleError}
                    </div>
                  )}
                </div>
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => !regenArticleBusy && setRegenArticleOpen(false)}
                    className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 text-sm font-bold hover:bg-gray-50 transition-colors"
                    disabled={regenArticleBusy}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={submitRegenerateArticle}
                    className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={regenArticleBusy}
                  >
                    {regenArticleBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    {regenArticleBusy ? '再生成中...' : '再生成を開始'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="w-full md:w-auto">
            <button onClick={() => router.push('/seo')} className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-xs sm:text-sm mb-3 sm:mb-4 font-bold transition-colors group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 一覧へ戻る
            </button>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3 sm:mb-2">
              <div className="flex items-center gap-2">
                <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : 'amber'}>
                  {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : '生成中'}
                </Badge>
              </div>
              <h1 className="text-xl sm:text-3xl font-black text-gray-900 tracking-tight leading-tight">{article.title}</h1>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 font-bold">
              <p>目標 {article.targetChars.toLocaleString()}字</p>
              <div className="w-1 h-1 rounded-full bg-gray-200" />
              <p>現在 {score.charCount.toLocaleString()}字 ({charProgress}%)</p>
            </div>

            <div className="mt-4">
              <AiThinkingStrip
                show={!!isGenerating || !!busy || !!mediaBusy}
                compact
                title="AIがSEO/LLMO最適化を実行中…"
                subtitle={
                  isGenerating
                    ? `生成工程「${latestJob?.step || ''}」を進めています（裏で構造/網羅性/読みやすさも調整中）`
                    : mediaBusy
                    ? '記事内容を解析して、図解/バナーを生成しています'
                    : busy
                    ? '改善・整合性チェックを行っています'
                    : '最適化しています'
                }
                tags={['SEO', 'LLMO', '構造化', '網羅性', '読みやすさ']}
              />
              <div className="mt-3">
                <FeatureGuide
                  featureId={`seo.article.detail.${article.id}`}
                  title="記事詳細（本文＋画像）の使い方"
                  description="生成後の確認・修正・画像生成・ダウンロードを、この画面ひとつで完結できます。"
                  steps={[
                    '「プレビュー」で本文を確認します（生成中でも進捗が見られます）',
                    '「SEOスコア」で良い点/改善点を確認し、手動 or AI自動修正で反映します',
                    '「見出し編集」「本文編集」で必要な箇所だけピンポイントで直せます',
                    '「画像」でバナー/図解を生成・再生成し、Markdownコピーやダウンロードも可能です',
                  ]}
                  imageMode="off"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={openRegenerateArticle}
              className="flex-1 sm:flex-none h-11 sm:h-12 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-black shadow-lg shadow-blue-500/10 text-xs sm:text-sm"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              同テーマで再生成
            </Button>
            {isGenerating && (
              <Button variant={autoRun ? 'secondary' : 'primary'} onClick={() => setAutoRun(!autoRun)} className="flex-1 sm:flex-none h-11 sm:h-12 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-black shadow-lg shadow-blue-500/20 text-xs sm:text-sm">
                {autoRun ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {autoRun ? '一時停止' : '生成を再開'}
              </Button>
            )}
            {(article?.status === 'RUNNING' || article?.status === 'ERROR') && (
              <Button
                variant="secondary"
                onClick={resumeFromCurrent}
                disabled={resumeBusy}
                className="flex-1 sm:flex-none h-11 sm:h-12 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-black text-xs sm:text-sm"
                title="途中から続き生成（タイトル/キーワードは変更しません）"
              >
                {resumeBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {resumeBusy ? '再開中...' : '途中から再開'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => load({ showLoading: true })} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>

        {resumeNotice && (
          <div className="mt-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs sm:text-sm font-black text-blue-900">
            {resumeNotice}
          </div>
        )}

        {/* Progress Display */}
        {isGenerating && (
          <div className="mb-8 sm:mb-12 bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
            <GenerationProgress progress={latestJob.progress} step={latestJob.step} title={article.title} />
            {actionError && (
              <div className="p-6 sm:p-8 bg-red-50 border-t border-red-100 text-red-700">
                <p className="font-black mb-2 flex items-center gap-2 text-sm sm:text-base"><AlertTriangle className="w-5 h-5" /> 生成エラー</p>
                <p className="text-[10px] sm:text-xs font-bold opacity-80 mb-4">{actionError}</p>
                <Button variant="secondary" onClick={advanceOnce} className="bg-white text-red-600 border-red-200 text-xs sm:text-sm">再試行</Button>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        {!isGenerating && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-10">
            {[
              { label: 'スコア', val: score.score, icon: BarChart3, color: score.score >= 70 ? 'text-emerald-500' : 'text-amber-500' },
              { label: '文字数', val: score.charCount.toLocaleString(), sub: `/ ${charProgress}%`, icon: FileText, color: 'text-blue-500' },
              { label: '見出し', val: score.headingCount, icon: Layers, color: 'text-purple-500' },
              { label: '画像', val: article.images?.length || 0, icon: ImageIcon, color: 'text-orange-500' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <p className={`text-xl sm:text-3xl font-black ${s.color}`}>{s.val}</p>
                    {s.sub && <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">{s.sub}</span>}
                  </div>
                  <s.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${s.color} opacity-20`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs - Sticky & Scrollable */}
        <div className="sticky top-[4.5rem] z-30 mb-6 sm:mb-8 pb-2 bg-[#F8FAFC]/80 backdrop-blur-md -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-1 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-white border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-black transition-all whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid - 記事本文を最大限広く */}
        <div className="grid lg:grid-cols-4 gap-6 sm:gap-8">
          <div className="lg:col-span-3">
            {tab === 'preview' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl overflow-hidden min-h-[400px] sm:min-h-[600px]">
                {/* Cover */}
                <div className="relative">
                  <div className="aspect-[16/9] bg-gradient-to-br from-[#2563EB] via-indigo-700 to-slate-900 overflow-hidden">
                    {bannerImageId ? (
                      <img
                        src={`/api/seo/images/${bannerImageId}`}
                        alt="cover"
                        className="w-full h-full object-cover opacity-95"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-200/30 via-indigo-200/20 to-white/0" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(markdown)}
                      className="bg-white/90 hover:bg-white border border-white/30 font-black h-10 px-3 shadow-lg"
                    >
                      {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      <span className="hidden sm:inline">コピー</span>
                    </Button>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                    <div className="flex items-center gap-2 text-white/80 text-[10px] font-black uppercase tracking-widest mb-2">
                      <Eye className="w-4 h-4" />
                      プレビュー
                    </div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white leading-tight tracking-tight">
                      {article.title}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[10px] font-black">
                        {readingMinutes}分で読める
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[10px] font-black">
                        目標 {Number(article.targetChars || 0).toLocaleString()}字
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-[10px] font-black">
                        {new Date(article.createdAt).toLocaleDateString()}
                      </span>
                      {article.mode === 'comparison_research' && article.comparisonCount && article.comparisonCount > 0 && (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/80 border border-emerald-400/50 text-white text-[10px] font-black flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {article.comparisonCount}社を比較
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body - 記事本文を全幅で表示 */}
                <div className="p-4 sm:p-6 lg:p-10">
                  {/* 比較記事の場合：サービス追加バー */}
                  {article.mode === 'comparison_research' && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl border border-emerald-100">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900">
                              {article.comparisonCount || 0}社を比較した記事
                            </p>
                            <p className="text-xs text-gray-500">
                              サービスを追加して、より網羅的な比較記事に
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setAddServiceOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-black hover:bg-emerald-700 transition-colors"
                        >
                          <Zap className="w-4 h-4" />
                          サービスを追加
                        </button>
                      </div>
                      {/* 現在の候補一覧（折りたたみ） */}
                      {article.comparisonCandidates && article.comparisonCandidates.length > 0 && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-xs font-bold text-gray-500 hover:text-gray-700">
                            現在の比較対象を見る（{article.comparisonCandidates.length}社）
                          </summary>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {article.comparisonCandidates.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700"
                              >
                                {c.websiteUrl ? (
                                  <a href={c.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 flex items-center gap-1">
                                    {c.name}
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  c.name
                                )}
                              </span>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {markdown ? (
                    <>
                      {/* Mobile TOC */}
                      {toc.length > 0 && (
                        <div className="mb-6 lg:hidden">
                          <details className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                            <summary className="cursor-pointer select-none px-5 py-4 font-black text-sm text-gray-900 flex items-center justify-between">
                              目次
                              <span className="text-[10px] font-black text-gray-400">タップで開く</span>
                            </summary>
                            <div className="px-5 pb-5">
                              <div className="space-y-2">
                                {toc.map((it) => (
                                  <a
                                    key={it.id}
                                    href={`#${it.id}`}
                                    className={`block text-xs font-bold text-gray-600 hover:text-blue-600 transition-colors ${
                                      it.level === 3 ? 'pl-4' : ''
                                    }`}
                                  >
                                    {it.text}
                                  </a>
                                ))}
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      {/* 記事本文 - 全幅で読みやすく + バイブ編集対応 */}
                      <article className="max-w-none">
                        {article.status === 'DONE' ? (
                          <EditableMarkdownPreview 
                            markdown={previewMarkdown || markdown} 
                            articleId={id}
                            onUpdate={() => load({ showLoading: false })}
                          />
                        ) : (
                          <MarkdownPreview markdown={previewMarkdown || markdown} />
                        )}
                      </article>
                    </>
                  ) : (
                    <div className="py-20 sm:py-32 text-center text-gray-300 font-black text-sm sm:text-base">
                      本文が生成されるまでお待ちください...
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'score' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-emerald-500" /> SEOスコア・改善ポイント
                </h2>
                <ScorePanel
                  articleId={id}
                  article={article}
                  onUpdated={() => load({ showLoading: false })}
                  onGoEdit={() => setTab('edit')}
                  onGoOutline={() => setTab('outline')}
                />
              </div>
            )}

            {tab === 'competitors' && (
              <CompetitorAnalysisTab
                articleId={id}
                article={article}
                onUpdated={() => load({ showLoading: false })}
              />
            )}

            {tab === 'outline' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-6 flex items-center gap-3">
                  <Layers className="w-6 h-6 text-indigo-500" /> 見出し構成・個別操作
                </h2>
                {/* セクションIDをマッピング（sectionsがあれば） */}
                <OutlineEditor
                  articleId={id}
                  finalMarkdown={article.finalMarkdown || ''}
                  headings={toc.map((h, i) => {
                    // headingPathが一致するセクションを探す
                    const matchedSection = (article.sections || []).find(
                      (s: any) => s.headingPath === h.text || s.headingPath?.endsWith(h.text)
                    )
                    return {
                      id: `h-${i}`,
                      sectionId: matchedSection?.id || null,
                      level: h.level as 2 | 3 | 4,
                      text: h.text,
                      content: matchedSection?.content || undefined,
                    }
                  })}
                  onUpdate={() => load({ showLoading: false })}
                />
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-6 sm:space-y-8">
                <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-6 sm:mb-8 flex items-center gap-3">
                    <ImageIcon className="w-6 h-6 text-orange-500" /> 生成されたクリエイティブ
                  </h2>

                  {entitlements && !entitlements.canUseSeoImages && (
                    <div className="mb-6 p-5 rounded-2xl bg-amber-50 border border-amber-100">
                      <p className="font-black text-amber-900 text-sm">画像生成（図解/バナー）は有料プラン限定です</p>
                      <p className="text-xs font-bold text-amber-800/80 mt-1">現在のプラン: {entitlements.plan}</p>
                      <Link href={upgradeHref} className="inline-block mt-3">
                        <button className="h-11 px-5 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors">
                          料金プランを見る
                        </button>
                      </Link>
                    </div>
                  )}

                  {(!entitlements || entitlements.canUseSeoImages) && (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <button
                        onClick={ensureImages}
                        disabled={mediaBusy}
                        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm shadow-lg shadow-blue-500/20 hover:opacity-95 disabled:opacity-50"
                      >
                        {mediaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                        図解を作成
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptOpen((v) => !v)}
                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs hover:bg-gray-50"
                      >
                        <Settings className="w-4 h-4" />
                        プロンプト設定
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next = patchSeoClientSettings({
                            seoImagePromptTemplates: {
                              banner: bannerPromptTemplate,
                              diagram: diagramPromptTemplate,
                            },
                          } as any)
                          // 反映通知（軽く）
                          if (next) {
                            setMessage('プロンプト設定を保存しました')
                            setTimeout(() => setMessage(null), 1800)
                          }
                        }}
                        className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-gray-900 text-white font-black text-xs hover:bg-gray-800"
                        title="このブラウザに保存します"
                      >
                        <Check className="w-4 h-4" />
                        保存
                      </button>
                      <span className="text-[10px] font-bold text-gray-400">サムネイル4枚＋図解（最大10）を自動生成します（数分かかる場合があります）</span>
                    </div>
                  )}

                  {promptOpen && (
                    <div className="mb-6 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-sm font-black text-gray-900">生成プロンプト（貼り付けOK）</p>
                        <button
                          type="button"
                          onClick={() => {
                            setBannerPromptTemplate(DEFAULT_BANNER_PROMPT_TEMPLATE)
                            setDiagramPromptTemplate(DEFAULT_DIAGRAM_PROMPT_TEMPLATE)
                          }}
                          className="text-xs font-black text-gray-600 hover:text-gray-900"
                        >
                          デフォルトに戻す
                        </button>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-black text-gray-600 mb-2">記事バナー用プロンプト</p>
                          <textarea
                            value={bannerPromptTemplate}
                            onChange={(e) => setBannerPromptTemplate(e.target.value)}
                            rows={10}
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-medium text-xs focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="ここに記事バナー用プロンプトを貼り付け"
                          />
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-gray-600 mb-2">図解用プロンプト</p>
                          <textarea
                            value={diagramPromptTemplate}
                            onChange={(e) => setDiagramPromptTemplate(e.target.value)}
                            rows={10}
                            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 font-medium text-xs focus:outline-none focus:border-blue-500 resize-none"
                            placeholder="ここに図解用プロンプトを貼り付け"
                          />
                        </div>
                      </div>
                      <p className="mt-3 text-[10px] font-bold text-gray-500">
                        ※ テンプレ内の「▼ここに…▼」部分は自動で記事本文に置き換えて生成します（サーバ側で処理）。
                      </p>
                    </div>
                  )}

                  {mediaError && (
                    <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold">
                      {mediaError}
                    </div>
                  )}

                  {/* サムネイル（BANNER）選択セクション */}
                  {(() => {
                    const bannerImages = (article.images?.filter((img) => img.kind === 'BANNER') || [])
                      .slice()
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    if (!bannerImages.length) return null
                    const selectedId = bannerImageId
                    return (
                      <div className="mb-8">
                        <h4 className="text-sm font-black text-gray-700 mb-2 flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-orange-100 text-orange-600">
                            <ImageIcon className="w-3.5 h-3.5" />
                          </span>
                          サムネイルを選択
                          <span className="text-xs font-bold text-gray-400 ml-1">({bannerImages.length}枚から選択)</span>
                        </h4>
                        <p className="text-[10px] font-bold text-gray-400 mb-4">クリックでメインサムネイルに設定されます。記事プレビューのカバー画像に使用されます。</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {bannerImages.map((img, idx) => {
                            const isSelected = img.id === selectedId
                            const isLoaded = imgLoaded[img.id]
                            const isGenerating = !isLoaded && (mediaBusy || !!imgGenerating[img.id])
                            return (
                              <button
                                key={img.id}
                                type="button"
                                onClick={async () => {
                                  if (isMediaLocked) { router.push(upgradeHref); return }
                                  if (isSelected) { setImageDetail(img); return }
                                  try {
                                    await fetch(`/api/seo/articles/${id}/images/select-banner`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ imageId: img.id }),
                                    })
                                    await load({ showLoading: false })
                                  } catch {}
                                }}
                                className={`group relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                                  isSelected
                                    ? 'border-blue-500 ring-2 ring-blue-200 shadow-lg'
                                    : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                                }`}
                              >
                                <div className="aspect-video relative bg-gray-50">
                                  <img
                                    src={`/api/seo/images/${img.id}?v=${imgRetry[img.id] || 0}`}
                                    className="w-full h-full object-cover"
                                    alt={img.title || `候補${idx + 1}`}
                                    onLoad={(e) => {
                                      const el = e.currentTarget
                                      if (!el?.naturalWidth || !el?.naturalHeight) {
                                        setImgLoaded((prev) => ({ ...prev, [img.id]: false }))
                                        setImgGenerating((prev) => ({ ...prev, [img.id]: true }))
                                        setTimeout(() => bumpRetry(img.id), 1200)
                                        return
                                      }
                                      setImgLoaded((prev) => ({ ...prev, [img.id]: true }))
                                      setImgGenerating((prev) => ({ ...prev, [img.id]: false }))
                                    }}
                                    onError={() => {
                                      setImgLoaded((prev) => ({ ...prev, [img.id]: false }))
                                      setImgGenerating((prev) => ({ ...prev, [img.id]: true }))
                                      setTimeout(() => bumpRetry(img.id), 1200)
                                    }}
                                  />
                                  {isGenerating && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/80">
                                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center shadow">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  )}
                                  {!isSelected && !isGenerating && (
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-black bg-black/50 px-2 py-1 rounded-lg">
                                        メインに設定
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="px-2 py-1.5 bg-white">
                                  <p className={`text-[10px] font-black truncate ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                                    {isSelected ? 'メイン' : `候補${idx + 1}`}
                                  </p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                        {/* 選択中バナーの操作ボタン */}
                        {selectedId && (() => {
                          const selectedImg = bannerImages.find((img) => img.id === selectedId)
                          if (!selectedImg) return null
                          return (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button type="button" onClick={() => setImageDetail(selectedImg)} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs hover:bg-gray-50">
                                <Eye className="w-4 h-4" /> 拡大表示
                              </button>
                              <button type="button" onClick={() => downloadImage(selectedImg)} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs hover:bg-gray-50" disabled={isMediaLocked}>
                                <Download className="w-4 h-4" /> ダウンロード
                              </button>
                              <button type="button" onClick={() => copyToClipboard(`![${selectedImg.title || 'banner'}](/api/seo/images/${selectedImg.id})`)} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white border border-gray-200 text-gray-800 font-black text-xs hover:bg-gray-50" disabled={isMediaLocked}>
                                <Copy className="w-4 h-4" /> Markdownコピー
                              </button>
                              {entitlements?.canUseSeoImages && (
                                <button type="button" onClick={() => { setRegenImage(selectedImg); setRegenPrompt(sanitizeLegacyBannerPrompt(String(selectedImg.prompt || ''))); setRegenOpen(true) }} className="inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700">
                                  <Wand2 className="w-4 h-4" /> 再生成
                                </button>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    )
                  })()}

                  {/* 図解（DIAGRAM）セクション */}
                  {(() => {
                    const diagramImages = article.images?.filter((img) => img.kind === 'DIAGRAM') || []
                    return diagramImages.length > 0 ? (
                      <div className="mb-8">
                        <h4 className="text-sm font-black text-gray-700 mb-4 flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-blue-100 text-blue-600">
                            <LayoutGrid className="w-3.5 h-3.5" />
                          </span>
                          図解
                          <span className="text-xs font-bold text-gray-400 ml-1">({diagramImages.length}枚)</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                          {diagramImages.map((img) => (
                            <ImageCard
                              key={img.id}
                              img={img}
                              isMediaLocked={isMediaLocked}
                              mediaLockLabel={mediaLockLabel}
                              upgradeHref={upgradeHref}
                              mediaBusy={mediaBusy}
                              imgLoaded={imgLoaded}
                              imgGenerating={imgGenerating}
                              imgRetry={imgRetry}
                              bumpRetry={bumpRetry}
                              setImgLoaded={setImgLoaded}
                              setImgGenerating={setImgGenerating}
                              setImageDetail={setImageDetail}
                              downloadImage={downloadImage}
                              copyToClipboard={copyToClipboard}
                              setRegenImage={setRegenImage}
                              setRegenPrompt={setRegenPrompt}
                              setRegenOpen={setRegenOpen}
                              sanitizeLegacyBannerPrompt={sanitizeLegacyBannerPrompt}
                              entitlements={entitlements}
                              router={router}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  })()}

                  {/* 画像がない場合のメッセージ */}
                  {!article.images?.length && (
                    <div className="py-16 sm:py-20 text-center bg-gray-50 rounded-2xl sm:rounded-3xl border-2 border-dashed border-gray-100 font-black text-gray-300 text-sm sm:text-base">
                      画像は有料プランで生成できます（上のボタンから生成）
                    </div>
                  )}
                </div>

                {/* 画像詳細モーダル（クリックで拡大＆操作） */}
                <AnimatePresence>
                  {imageDetail && (
                    <motion.div
                      key="imageDetailModal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6"
                    >
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setImageDetail(null)} />
                      <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 14, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-4xl rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden"
                      >
                        <div className="p-5 sm:p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像プレビュー</p>
                            <p className="text-lg font-black text-gray-900 mt-1 truncate">{imageDetail.title || '画像'}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <Badge tone={imageDetail.kind === 'BANNER' ? 'orange' : 'blue'}>{imageDetail.kind}</Badge>
                              <span className="text-[10px] font-bold text-gray-400">{new Date(imageDetail.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setImageDetail(null)}
                            className="h-10 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-xs hover:bg-gray-50"
                          >
                            閉じる
                          </button>
                        </div>
                        <div className="p-5 sm:p-6">
                          <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-50 relative">
                            <img src={`/api/seo/images/${imageDetail.id}`} className="w-full h-full object-contain" alt={imageDetail.title || ''} />
                            {isMediaLocked && (
                              <div className="absolute inset-0 bg-black/55 flex items-center justify-center p-4">
                                <div className="rounded-2xl bg-black/55 border border-white/20 backdrop-blur-[2px] p-4 text-center">
                                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-black">
                                    <Lock className="w-4 h-4" />
                                    {mediaLockLabel}
                                  </div>
                                  <p className="mt-3 text-white text-sm font-black">ダウンロード/コピーは有料プラン限定です</p>
                                  <Link href={upgradeHref} className="inline-flex mt-3">
                                    <span className="h-10 px-5 rounded-xl bg-white text-gray-900 font-black text-xs inline-flex items-center gap-2 hover:bg-gray-100">
                                      料金プランを見る
                                    </span>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => (isMediaLocked ? router.push(upgradeHref) : downloadImage(imageDetail))}
                              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl border font-black text-xs transition-colors ${
                                isMediaLocked
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                              }`}
                              disabled={isMediaLocked}
                            >
                              <Download className="w-4 h-4" />
                              ダウンロード
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                isMediaLocked
                                  ? router.push(upgradeHref)
                                  : copyToClipboard(`![${imageDetail.title || 'image'}](/api/seo/images/${imageDetail.id})`)
                              }
                              className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl border font-black text-xs transition-colors ${
                                isMediaLocked
                                  ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'bg-white border-gray-200 text-gray-800 hover:bg-gray-50'
                              }`}
                              disabled={isMediaLocked}
                            >
                              <Copy className="w-4 h-4" />
                              Markdownコピー
                            </button>
                            <Link
                              href={
                                isMediaLocked || !entitlements?.isLoggedIn ? upgradeHref : `/seo/images/${imageDetail.id}`
                              }
                              className="inline-flex"
                            >
                              <span
                                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl font-black text-xs transition-colors ${
                                  isMediaLocked ? 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800'
                                }`}
                              >
                                <ExternalLink className="w-4 h-4" />
                                {isMediaLocked || !entitlements?.isLoggedIn ? '料金プラン' : '詳細ページ'}
                              </span>
                            </Link>
                            {entitlements?.canUseSeoImages && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRegenImage(imageDetail)
                                  const p = String(imageDetail.prompt || '')
                                  setRegenPrompt(imageDetail.kind === 'BANNER' ? sanitizeLegacyBannerPrompt(p) : p)
                                  setRegenOpen(true)
                                }}
                                className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700"
                              >
                                <Wand2 className="w-4 h-4" />
                                プロンプト編集→再生成
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {regenOpen && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => !mediaBusy && setRegenOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                      <div className="p-6 sm:p-8 border-b border-gray-100">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像を再生成</p>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-2">{regenImage?.title || '画像'}</h3>
                        <p className="text-xs font-bold text-gray-500 mt-2">プロンプトを修正して再生成します（テキストの有無/量はプロンプト次第です）</p>
                      </div>
                      <div className="p-6 sm:p-8 space-y-3">
                        <textarea
                          value={regenPrompt}
                          onChange={(e) => setRegenPrompt(e.target.value)}
                          rows={8}
                          className="w-full px-5 py-4 rounded-2xl bg-gray-50 border-2 border-gray-100 text-gray-900 font-bold text-sm placeholder:text-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-all resize-none"
                          placeholder="プロンプトを編集してください"
                        />
                        <div className="flex flex-col sm:flex-row gap-3 justify-end">
                          <button
                            onClick={() => {
                              if (mediaBusy) return
                              setRegenOpen(false)
                              setRegenImage(null)
                            }}
                            className="h-11 px-5 rounded-xl bg-white border border-gray-200 text-gray-700 font-black text-sm hover:bg-gray-50 transition-colors"
                          >
                            閉じる
                          </button>
                          <button
                            onClick={regenerateImage}
                            disabled={mediaBusy || !regenPrompt.trim()}
                            className="h-11 px-6 rounded-xl bg-gray-900 text-white font-black text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                          >
                            {mediaBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            再生成する
                          </button>
                        </div>
                      </div>
                    </div>

                {/* 画像生成中ポップアップ */}
                <AnimatePresence>
                  {mediaBusy && (
                    <motion.div
                      key="mediaBusyModal"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[140] flex items-center justify-center p-4"
                    >
                      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                      <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 14, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="relative w-full max-w-md rounded-3xl bg-white border border-gray-100 shadow-2xl overflow-hidden"
                      >
                        <div className="p-6 border-b border-gray-100">
                          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像生成中</p>
                          <h3 className="text-lg font-black text-gray-900 mt-2">バナー＋図解を生成しています</h3>
                          <p className="text-xs font-bold text-gray-500 mt-2 leading-relaxed">
                            記事内容を解析して最大14枚（サムネイル4枚＋図解最大10枚）を作ります。内容によっては数分かかることがあります（そのまま待ってOKです）。
                          </p>
                        </div>
                        <div className="p-6 flex items-center gap-3">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          <p className="text-sm font-black text-gray-700">生成しています…</p>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                  </div>
                )}
              </div>
            )}

            {tab === 'edit' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl overflow-hidden p-6 sm:p-8 space-y-6">
                <textarea
                  className="w-full min-h-[400px] sm:min-h-[600px] p-6 sm:p-8 rounded-2xl sm:rounded-[32px] border-2 border-gray-50 bg-gray-50/30 text-gray-900 font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                  value={markdownDraft}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setMarkdownDraft(article.finalMarkdown || '')} className="font-black text-sm">元に戻す</Button>
                  <Button variant="primary" onClick={() => act('save', async () => {
                    await fetch(`/api/seo/articles/${id}/content`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ finalMarkdown: markdownDraft, normalize: true }),
                    })
                  })} className="bg-gray-900 text-white px-8 sm:px-10 h-12 sm:h-14 rounded-xl sm:rounded-2xl font-black shadow-xl text-sm sm:text-base">保存する</Button>
                </div>
              </div>
            )}

            {tab === 'export' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
                <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-6 sm:mb-8">ダウンロード</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <a
                    href={`/api/seo/articles/${id}/export/markdown`}
                    download
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-blue-500 bg-gray-50/30 hover:bg-white transition-all group"
                  >
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-blue-500 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">Markdown (.md)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">GitHub, Notion, Qiita等に最適</p>
                  </a>

                  <a
                    href={`/api/seo/articles/${id}/export/txt`}
                    download
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-slate-500 bg-gray-50/30 hover:bg-white transition-all group"
                  >
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-slate-600 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">Text (.txt)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">プレーンテキスト（メール/Docs貼り付け用）</p>
                  </a>

                  <a
                    href={`/api/seo/articles/${id}/export/html`}
                    download
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-amber-500 bg-gray-50/30 hover:bg-white transition-all group"
                  >
                    <Layout className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-amber-600 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">HTML (.html)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">ブラウザ表示/社内共有用（基本CSS付き）</p>
                  </a>

                  <a
                    href={`/api/seo/articles/${id}/export/note`}
                    download
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-rose-500 bg-gray-50/30 hover:bg-white transition-all group"
                  >
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-rose-600 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">note用Markdown (.md)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">note向けに見出し/画像/表を調整</p>
                  </a>

                  <a
                    href={`/api/seo/articles/${id}/export/json`}
                    download
                    className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-violet-500 bg-gray-50/30 hover:bg-white transition-all group"
                  >
                    <Braces className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-violet-600 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">JSON (.json)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">連携/自動処理用（markdown + text入り）</p>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - コンパクト化 */}
          <div className="hidden lg:block space-y-4">
            {/* 記事情報 - コンパクト */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm sticky top-[7rem]">
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">文字数</p>
                  <p className="text-sm font-black text-gray-900">{score.charCount.toLocaleString()} <span className="text-xs text-gray-400">/ {article.targetChars.toLocaleString()}字</span></p>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(100, charProgress)}%` }} />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {((article.keywords as string[]) || []).slice(0, 3).map((k, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[8px] font-black border border-blue-100 truncate max-w-full">{k}</span>
                  ))}
                </div>
              </div>
              
              {/* クイックアクション */}
              <div className="mt-4 pt-4 border-t border-gray-100 grid gap-2">
                <button onClick={() => setTab('edit')} className="w-full px-3 py-2 rounded-lg bg-purple-50 text-purple-700 font-black text-[10px] flex items-center justify-between hover:bg-purple-100 transition-all">
                  編集 <Edit3 className="w-3 h-3" />
                </button>
                <button onClick={() => setTab('export')} className="w-full px-3 py-2 rounded-lg bg-gray-50 text-gray-700 font-black text-[10px] flex items-center justify-between hover:bg-gray-100 transition-all">
                  DL <Download className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
    </main>
  )
}

export default function SeoArticlePage() {
  return (
    <ClientErrorBoundary title="エラーが発生しました">
      <SeoArticleInner />
    </ClientErrorBoundary>
  )
}
