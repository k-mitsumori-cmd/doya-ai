'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
  { id: 'score', label: 'SEOスコア', icon: BarChart3, color: 'text-emerald-500' },
  { id: 'outline', label: '見出し編集', icon: Layers, color: 'text-indigo-500' },
  { id: 'edit', label: '本文編集', icon: Edit3, color: 'text-purple-500' },
  { id: 'media', label: '画像', icon: ImageIcon, color: 'text-orange-500' },
  { id: 'export', label: 'ダウンロード', icon: Download, color: 'text-gray-500' },
] as const

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
      const res = await fetch(`/api/seo/articles/${id}/images/ensure`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) throw new Error(json?.error || `生成に失敗しました (${res.status})`)
      await load({ showLoading: false })
    } catch (e: any) {
      setMediaError(e?.message || '画像生成に失敗しました')
    } finally {
      setMediaBusy(false)
    }
  }

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
                <ScorePanel article={article} />
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
                {(!article.sections || article.sections.length === 0) && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                    <p className="text-sm font-bold text-amber-800">
                      💡 見出し単位の再生成・強化は、記事生成完了後に利用可能です。現在は本文編集タブから全体を編集できます。
                    </p>
                  </div>
                )}
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
                      <Link href="/pricing" className="inline-block mt-3">
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
                      <span className="text-[10px] font-bold text-gray-400">バナー＋図解（最大2）を自動生成します</span>
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
                          <img src={`/api/seo/images/${img.id}`} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt={img.title || ''} />
                          <div className="absolute top-3 sm:top-4 left-3 sm:left-4 flex gap-2">
                            <Badge tone={img.kind === 'BANNER' ? 'orange' : 'blue'}>{img.kind}</Badge>
                          </div>
                          <div className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button onClick={() => copyToClipboard(`![${img.title || 'image'}](/api/seo/images/${img.id})`)} className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform"><Copy className="w-5 h-5" /></button>
                            {entitlements?.canUseSeoImages && (
                              <button
                                onClick={() => {
                                  setRegenImage(img)
                                  setRegenPrompt(String(img.prompt || ''))
                                  setRegenOpen(true)
                                }}
                                className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform"
                                title="プロンプトを編集して再生成"
                              >
                                <Wand2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="p-4 sm:p-5">
                          <p className="font-black text-gray-900 truncate text-sm sm:text-base">{img.title || '無題の画像'}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{new Date(img.createdAt).toLocaleDateString()}</p>
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

                {regenOpen && (
                  <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px]" onClick={() => !mediaBusy && setRegenOpen(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                      <div className="p-6 sm:p-8 border-b border-gray-100">
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">画像を再生成</p>
                        <h3 className="text-lg sm:text-xl font-black text-gray-900 mt-2">{regenImage?.title || '画像'}</h3>
                        <p className="text-xs font-bold text-gray-500 mt-2">プロンプトを修正して再生成します（画像内にテキストは入れません）</p>
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
