'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
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
}

type TocItem = { id: string; text: string; level: 2 | 3 }

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
  { id: 'score', label: 'SEOスコア', icon: BarChart3, color: 'text-emerald-500' },
  { id: 'outline', label: '見出し編集', icon: Layers, color: 'text-indigo-500' },
  { id: 'edit', label: '本文編集', icon: Edit3, color: 'text-purple-500' },
  { id: 'export', label: 'ダウンロード', icon: Download, color: 'text-gray-500' },
] as const

const DEFAULT_BANNER_PROMPT_TEMPLATE = `あなたは記事バナー（アイキャッチ）制作に強いアートディレクターです。

【目的】
記事タイトル・見出し・本文要点をもとに、記事内容と一致する「記事アイキャッチ画像」を生成してください。
（※広告バナーではありません）

【重要ルール】
- CTAは禁止（詳しくはこちら/今すぐ等は入れない）
- 画像内に文字は一切入れない（日本語/英語/数字/記号を含む）
- 後から文字を載せられる大きな余白（ネガティブスペース）を確保する
- 情報を詰め込みすぎない（最大3ブロックの構図）
- 記事内容とズレた煽りは禁止

【ジャンル別デザイン指針】
- IT/転職/スクール: 信頼感、コントラスト強、青/ネイビー、情報整理型
- 美容/健康/D2C: 余白多め、明るい配色、清潔感、質感重視
- EC/セール: 視認性最優先、強い色アクセント、整理された強弱

【元となる記事内容】
{{ARTICLE_CONTENT}}

【記事タイトル】
{{ARTICLE_TITLE}}

【記事見出し（要点）】
{{HEADINGS}}

【キーワード】
{{KEYWORDS}}

【用途】
{{USAGE}}

【記事ジャンル（推定でOK）】
{{GENRE}}`

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
  const [imageDetail, setImageDetail] = useState<SeoImage | null>(null)

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
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      setArticle(json.article || null)
      setMemo(json.article?.memo?.content || '')
      setMarkdownDraft(json.article?.finalMarkdown || '')
    } catch (e: any) {
      setLoadError(e?.message || '読み込みに失敗しました')
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

  useEffect(() => {
    load({ showLoading: true })
    const t = setInterval(() => {
      load({ showLoading: false })
    }, 3000)
    return () => clearInterval(t)
  }, [load])

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
      if (tpl?.banner) setBannerPromptTemplate(String(tpl.banner))
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
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-black text-gray-900 mb-4">記事が見つかりません</h2>
        <Button variant="primary" onClick={() => load({ showLoading: true })}>再試行</Button>
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
            {isGenerating && (
              <Button variant={autoRun ? 'secondary' : 'primary'} onClick={() => setAutoRun(!autoRun)} className="flex-1 sm:flex-none h-11 sm:h-12 rounded-xl sm:rounded-2xl px-4 sm:px-6 font-black shadow-lg shadow-blue-500/20 text-xs sm:text-sm">
                {autoRun ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {autoRun ? '一時停止' : '生成を再開'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => load({ showLoading: true })} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center">
              <RefreshCcw className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>

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
                    </div>
                  </div>
                </div>

                {/* Body - 記事本文を全幅で表示 */}
                <div className="p-4 sm:p-6 lg:p-10">
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

                      {/* 記事本文 - 全幅で読みやすく */}
                      <article className="max-w-none">
                        <MarkdownPreview markdown={previewMarkdown || markdown} />
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
                        記事に合わせて画像を生成
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
                      <span className="text-[10px] font-bold text-gray-400">バナー＋図解（最大10）を自動生成します（数分かかる場合があります）</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    {article.images?.map((img) => (
                      <div key={img.id} className="group bg-white rounded-2xl sm:rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500">
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
                              src={`/api/seo/images/${img.id}`}
                              className={`w-full h-full object-cover transition-all duration-700 ${isMediaLocked ? 'grayscale-[0.2]' : 'group-hover:scale-105'}`}
                              alt={img.title || ''}
                            />
                          </button>
                          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex gap-2">
                            <Badge tone={img.kind === 'BANNER' ? 'orange' : 'blue'}>{img.kind}</Badge>
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
                            <Link href={isMediaLocked ? upgradeHref : `/seo/images/${img.id}`} className="inline-flex">
                              <span
                                className={`inline-flex items-center gap-2 h-9 px-3 rounded-xl font-black text-xs transition-colors ${
                                  isMediaLocked ? 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800'
                                }`}
                              >
                                <ExternalLink className="w-4 h-4" />
                                {isMediaLocked ? '料金プラン' : '詳細ページ'}
                              </span>
                            </Link>
                            {entitlements?.canUseSeoImages && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRegenImage(img)
                                  setRegenPrompt(String(img.prompt || ''))
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
                    ))}
                    {!article.images?.length && (
                      <div className="sm:col-span-2 py-16 sm:py-20 text-center bg-gray-50 rounded-2xl sm:rounded-3xl border-2 border-dashed border-gray-100 font-black text-gray-300 text-sm sm:text-base">
                        画像は有料プランで生成できます（上のボタンから生成）
                      </div>
                    )}
                  </div>
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
                            <Link href={isMediaLocked ? upgradeHref : `/seo/images/${imageDetail.id}`} className="inline-flex">
                              <span
                                className={`inline-flex items-center gap-2 h-10 px-4 rounded-xl font-black text-xs transition-colors ${
                                  isMediaLocked ? 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800'
                                }`}
                              >
                                <ExternalLink className="w-4 h-4" />
                                {isMediaLocked ? '料金プラン' : '詳細ページ'}
                              </span>
                            </Link>
                            {entitlements?.canUseSeoImages && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRegenImage(imageDetail)
                                  setRegenPrompt(String(imageDetail.prompt || ''))
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
                            記事内容を解析して最大10枚（バナー1枚＋図解最大9枚）を作ります。内容によっては数分かかることがあります（そのまま待ってOKです）。
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
                  <a href={`/api/seo/articles/${id}/export/markdown`} className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-blue-500 bg-gray-50/30 hover:bg-white transition-all group">
                    <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-blue-500 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">Markdown (.md)</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">GitHub, Notion, Qiita等に最適</p>
                  </a>
                  <a href={`/api/seo/articles/${id}/export/wp`} className="p-6 sm:p-8 rounded-2xl sm:rounded-[40px] border-2 border-gray-50 hover:border-emerald-500 bg-gray-50/30 hover:bg-white transition-all group">
                    <Layout className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 group-hover:text-emerald-500 mb-4" />
                    <h4 className="text-base sm:text-lg font-black text-gray-900">WordPress</h4>
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold mt-2">ブロックエディタ用HTML形式</p>
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
