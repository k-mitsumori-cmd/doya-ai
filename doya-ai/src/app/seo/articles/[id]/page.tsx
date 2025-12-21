'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { ClientErrorBoundary } from '@seo/components/ClientErrorBoundary'
import { GenerationProgress } from '@seo/components/GenerationProgress'
import { Button } from '@seo/components/ui/Button'
import { Badge } from '@seo/components/ui/Badge'
import { analyzeMarkdown } from '@seo/lib/score'
import { DashboardLayout } from '@/components/DashboardLayout'
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
} from 'lucide-react'

type SeoImage = {
  id: string
  kind: string
  title?: string | null
  description?: string | null
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
  sections?: { id: string; status: string }[]
  requestText?: string | null
  referenceImages?: { name: string; dataUrl: string }[] | null
  createdAt: string
}

const TABS = [
  { id: 'preview', label: 'プレビュー', icon: Eye, color: 'text-blue-500' },
  { id: 'edit', label: '編集', icon: Edit3, color: 'text-purple-500' },
  { id: 'note', label: 'note記事', icon: PenTool, color: 'text-amber-500' },
  { id: 'research', label: 'リサーチ', icon: Compass, color: 'text-cyan-500' },
  { id: 'outline', label: 'アウトライン', icon: Layout, color: 'text-gray-500' },
  { id: 'meta', label: 'メタ', icon: Tag, color: 'text-pink-500' },
  { id: 'audit', label: '監査', icon: CheckCircle, color: 'text-emerald-500' },
  { id: 'media', label: '画像', icon: ImageIcon, color: 'text-orange-500' },
  { id: 'links', label: 'リンク', icon: Link2, color: 'text-indigo-500' },
  { id: 'export', label: '出力', icon: Download, color: 'text-gray-500' },
] as const

type DiagramSuggestion = {
  title: string
  description: string
  insertAfterHeading?: string
  priority: 'high' | 'medium' | 'low'
  selected?: boolean
}

function DiagramSuggestions({
  articleId,
  onGenerated,
  busy,
  setBusy,
  setMessage,
}: {
  articleId: string
  onGenerated: () => void
  busy: string | null
  setBusy: (v: string | null) => void
  setMessage: (v: string | null) => void
}) {
  const [suggestions, setSuggestions] = useState<DiagramSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSuggestions() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}/images/suggest`, { method: 'POST' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '提案の取得に失敗しました')
      setSuggestions((json.suggestions || []).map((s: DiagramSuggestion) => ({ ...s, selected: true })))
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setLoading(false)
    }
  }

  async function generateSelected() {
    const selected = suggestions.filter((s) => s.selected)
    if (!selected.length) return

    setGenerating(true)
    setBusy('batch-diagrams')
    setError(null)
    try {
      const res = await fetch(`/api/seo/articles/${articleId}/images/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagrams: selected.map((s) => ({ title: s.title, description: s.description })) }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || '生成に失敗しました')
      
      const summary = json.summary || {}
      setMessage(`${summary.success || 0}個の図解を生成しました ✓`)
      setTimeout(() => setMessage(null), 3000)
      onGenerated()
      setSuggestions([]) // 生成後はクリア
    } catch (e: any) {
      setError(e?.message || '不明なエラー')
    } finally {
      setGenerating(false)
      setBusy(null)
    }
  }

  const toggleSelection = (index: number) => {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    )
  }

  const selectedCount = suggestions.filter((s) => s.selected).length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={fetchSuggestions}
          disabled={loading || !!busy}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-2xl px-6 h-12"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          {loading ? '分析中...' : '記事を分析して図解を提案'}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-4 animate-fade-in-up">
          <div className="grid gap-4">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-5 rounded-3xl border-2 transition-all cursor-pointer ${
                  s.selected
                    ? 'border-purple-200 bg-purple-50/50 shadow-sm'
                    : 'border-gray-50 bg-white opacity-60 grayscale'
                }`}
                onClick={() => toggleSelection(i)}
              >
                <div className="flex items-start gap-4">
                  <div className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${s.selected ? 'bg-purple-600 border-purple-600' : 'border-gray-200'}`}>
                    {s.selected && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-black text-gray-900 tracking-tight">{s.title}</p>
                      <Badge
                        tone={s.priority === 'high' ? 'red' : s.priority === 'medium' ? 'amber' : 'gray'}
                      >
                        {s.priority === 'high' ? '優先度高' : s.priority === 'medium' ? '優先度中' : '優先度低'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 font-bold leading-relaxed">{s.description}</p>
                    {s.insertAfterHeading && (
                      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <Layers className="w-3 h-3" />
                        挿入位置: {s.insertAfterHeading}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between p-6 rounded-[32px] bg-gray-900 text-white shadow-xl shadow-purple-500/20">
            <div>
              <p className="text-sm font-black">{selectedCount}個の図解を選択中</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Nano Banner Pro連携</p>
            </div>
            <Button
              variant="primary"
              onClick={generateSelected}
              disabled={generating || selectedCount === 0 || !!busy}
              className="bg-white text-gray-900 hover:bg-gray-100 rounded-2xl px-8 h-12 font-black shadow-lg"
            >
              <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
              {generating ? '生成中...' : '選択中をまとめて生成'}
            </Button>
          </div>
        </div>
      )}

      {!suggestions.length && !loading && (
        <div className="p-8 rounded-[40px] bg-gray-50/50 border-2 border-dashed border-gray-100 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <h4 className="text-sm font-black text-gray-900 mb-2">図解の自動提案機能</h4>
          <p className="text-xs text-gray-400 font-bold leading-relaxed max-w-sm mx-auto">
            記事内容をAIが分析し、読者の理解を深めるための図解を最大5つまで提案します。
            複雑な関係性やプロセスを視覚化しましょう。
          </p>
        </div>
      )}
    </div>
  )
}

function SeoArticleInner() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const searchParams = useSearchParams()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [autoRun, setAutoRun] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [tab, setTab] = useState<typeof TABS[number]['id']>('preview')
  const [diagramTitle, setDiagramTitle] = useState('')
  const [diagramDesc, setDiagramDesc] = useState('')
  const [outlineDraft, setOutlineDraft] = useState('')
  const [markdownDraft, setMarkdownDraft] = useState('')
  const [normalizeOnSave, setNormalizeOnSave] = useState(true)
  const [updateOutlineOnSave, setUpdateOutlineOnSave] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const markdown = useMemo(() => article?.finalMarkdown || '', [article])
  const score = useMemo(() => analyzeMarkdown(markdown || ''), [markdown])

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading === true
    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/seo/articles/${id}`, { cache: 'no-store' })
      let json: any = null
      try {
        json = await res.json()
      } catch {
        json = null
      }
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      setArticle(json.article || null)
      setMemo(json.article?.memo?.content || '')
      setOutlineDraft(json.article?.outline || '')
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
    }, 2500)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (searchParams.get('auto') === '1') setAutoRun(true)
  }, [searchParams])

  const latestJob = article?.jobs?.[0]
  const latestJobId = latestJob?.id

  const advanceOnce = useCallback(async () => {
    if (!latestJobId) return
    setActionError(null)
    const res = await fetch(`/api/seo/jobs/${latestJobId}/advance`, { method: 'POST' })
    let json: any = null
    try {
      json = await res.json()
    } catch {
      // ignore
    }
    if (!res.ok || json?.success === false) {
      const msg = json?.error || `advance failed (${res.status})`
      setActionError(msg)
      setAutoRun(false)
      return
    }
    await load({ showLoading: false })
  }, [latestJobId, load])

  useEffect(() => {
    if (!autoRun) return
    if (!latestJob) return
    if (latestJob.status === 'done' || latestJob.status === 'error') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [autoRun, latestJob, advanceOnce])

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Loading Article Content...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!article) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20">
          <div className="p-12 rounded-[48px] bg-red-50 border border-red-100 text-center shadow-2xl shadow-red-500/10">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
            <h2 className="text-2xl font-black text-red-900 mb-4">記事が見つかりません</h2>
            <p className="text-red-700/70 font-bold mb-8 leading-relaxed">
              {loadError || 'URLが正しいか、またはデータベースの接続設定を確認してください。'}
            </p>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white rounded-2xl px-10 h-14"
              onClick={() => load({ showLoading: true })}
            >
              <RefreshCcw className="w-5 h-5 mr-2" />
              再試行する
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const charProgress = Math.min(100, Math.round((score.charCount / article.targetChars) * 100))
  const isGenerating = latestJob && latestJob.status !== 'done' && latestJob.status !== 'error'

  return (
    <DashboardLayout>
      <main className="max-w-7xl mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/seo" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors font-bold">
            <ArrowLeft className="w-4 h-4" />
            一覧へ戻る
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : article.status === 'RUNNING' ? 'amber' : 'blue'}>
                  {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : article.status === 'RUNNING' ? '生成中' : '下書き'}
                </Badge>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight truncate">
                  {article.title}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400 font-bold">
                <p>目標 {article.targetChars.toLocaleString('ja-JP')}字</p>
                <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                <p>現在 {score.charCount.toLocaleString('ja-JP')}字 ({charProgress}%)</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {latestJobId && latestJob?.status !== 'done' && (
                <Button
                  variant={autoRun ? 'secondary' : 'primary'}
                  onClick={() => setAutoRun((v) => !v)}
                  className="h-12 rounded-2xl px-6"
                >
                  {autoRun ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                  {autoRun ? '一時停止' : '生成を再開'}
                </Button>
              )}
              <Button 
                variant="ghost" 
                onClick={() => load({ showLoading: true })}
                className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm"
              >
                <RefreshCcw className="w-5 h-5 text-gray-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Generation Progress Overlay */}
        {isGenerating && (
          <div className="mb-12 bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
            <GenerationProgress
              progress={latestJob.progress}
              step={latestJob.step}
              title={article.title}
            />
            {(latestJob.error || actionError) && (
              <div className="p-8 bg-red-50 border-t border-red-100 text-red-700">
                <div className="flex items-center gap-3 mb-3">
                  <AlertTriangle className="w-6 h-6" />
                  <p className="font-black text-lg">生成エラーが発生しました</p>
                </div>
                <pre className="text-xs bg-white/60 p-6 rounded-3xl whitespace-pre-wrap font-mono leading-relaxed border border-red-100">{latestJob.error || actionError}</pre>
                <div className="mt-6">
                   <Button variant="secondary" onClick={() => advanceOnce()} className="bg-white text-red-600 border-red-200 hover:bg-red-50">
                     <RefreshCcw className="w-4 h-4 mr-2" />
                     このステップを再試行
                   </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {message && (
          <div className="mb-6 p-4 rounded-2xl bg-blue-50 text-blue-700 text-sm font-bold flex items-center gap-3 border border-blue-100 shadow-sm animate-fade-in-up">
            <CheckCircle className="w-5 h-5" />
            {message}
          </div>
        )}

        {/* Stats Cards */}
        {!isGenerating && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Content Score</p>
              <div className="flex items-center gap-3">
                <p className={`text-3xl font-black ${score.score >= 70 ? 'text-emerald-500' : score.score >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                  {score.score}
                </p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${score.score >= 70 ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'}`}>
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Characters</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-black text-gray-900">{score.charCount.toLocaleString()}</p>
                <span className="text-xs font-bold text-gray-400">/ {charProgress}%</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Headings</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-black text-gray-900">{score.headingCount}</p>
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Assets</p>
              <div className="flex items-center gap-3">
                <p className="text-3xl font-black text-gray-900">{article.images?.length || 0}</p>
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-500 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="sticky top-[4.5rem] z-30 mb-8 pb-2 bg-[#F8FAFC]/80 backdrop-blur-md">
          <div className="flex gap-1 p-1.5 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
            {TABS.map((t) => {
              const Icon = t.icon
              const isActive = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {tab === 'preview' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">記事プレビュー</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Markdown Rendering</p>
                  </div>
                  {markdown && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => copyToClipboard(markdown)}
                      className="h-10 rounded-xl px-4 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 font-black shadow-sm"
                    >
                      {copied ? <Check className="w-4 h-4 mr-2 text-emerald-500" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? 'コピー済み' : '全文コピー'}
                    </Button>
                  )}
                </div>
                <div className="p-8 lg:p-12">
                  {markdown ? (
                    <MarkdownPreview markdown={markdown} />
                  ) : (
                    <div className="text-center py-20 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100">
                      <FileText className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                      <p className="text-gray-400 font-black">本文がまだ生成されていません</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {tab === 'edit' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">記事の編集</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Markdown Editor</p>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  <textarea
                    className="w-full min-h-[600px] font-mono text-sm p-8 rounded-[32px] border-2 border-gray-50 bg-gray-50/30 text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all leading-relaxed shadow-inner"
                    value={markdownDraft}
                    onChange={(e) => setMarkdownDraft(e.target.value)}
                    placeholder="ここにMarkdownを入力..."
                  />
                  <div className="flex items-center justify-between gap-4 flex-wrap p-6 rounded-3xl bg-gray-50 border border-gray-100">
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 text-xs font-black text-gray-500 cursor-pointer uppercase tracking-widest">
                        <input type="checkbox" checked={normalizeOnSave} onChange={(e) => setNormalizeOnSave(e.target.checked)} className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500" />
                        Format Markdown
                      </label>
                      <label className="flex items-center gap-2 text-xs font-black text-gray-500 cursor-pointer uppercase tracking-widest">
                        <input type="checkbox" checked={updateOutlineOnSave} onChange={(e) => setUpdateOutlineOnSave(e.target.checked)} className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500" />
                        Sync Outline
                      </label>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="ghost" onClick={() => setMarkdownDraft(article.finalMarkdown || '')} className="font-black text-gray-400 hover:text-gray-900">
                        Discard Changes
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => act('content', async () => {
                           const res = await fetch(`/api/seo/articles/${id}/content`, {
                             method: 'POST',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({ finalMarkdown: markdownDraft, normalize: normalizeOnSave, updateOutline: updateOutlineOnSave }),
                           })
                           const json = await res.json()
                           if (!json.success) throw new Error(json.error || '失敗しました')
                        })}
                        className="bg-gray-900 text-white px-10 h-14 rounded-2xl shadow-xl shadow-gray-900/10 font-black"
                      >
                        保存する
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'note' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-amber-50/30">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">note記事を作成</h2>
                    <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">Note.jp Optimized Content</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => act('note', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/generate-note`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })}
                    disabled={!!busy}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-black h-12 rounded-2xl px-6 shadow-lg shadow-amber-500/20"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {busy === 'note' ? '生成中...' : 'AIで生成する'}
                  </Button>
                </div>
                <div className="p-8 space-y-8">
                  <div className="p-6 rounded-3xl bg-amber-50/50 border border-amber-100">
                    <p className="text-sm font-black text-amber-900 mb-3 flex items-center gap-2">
                       <PenTool className="w-4 h-4" />
                       note.jpの執筆方針
                    </p>
                    <ul className="text-xs text-amber-700 font-bold space-y-2 leading-relaxed">
                      <li>• 読者の心に寄り添う親しみやすいトーン（デスマス調、問いかけ）</li>
                      <li>• 冒頭の「つかみ」で共感と期待値を最大化</li>
                      <li>• 適度な改行と余白による、モバイルでの読みやすさの追求</li>
                      <li>• 筆者の視点や想いが伝わる人間味のある表現</li>
                    </ul>
                  </div>

                  {(() => {
                    const noteItem = (article.knowledgeItems || []).find((k) => k.type === 'note_article')
                    if (!noteItem) {
                      return (
                        <div className="text-center py-20 bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-100">
                          <PenTool className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                          <p className="text-gray-400 font-black">note向けの記事がまだ生成されていません</p>
                        </div>
                      )
                    }
                    return (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-gray-900">生成されたプレビュー</h3>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(noteItem.content)} className="h-10 px-4 rounded-xl bg-gray-50 font-black text-xs">
                               <Copy className="w-3.5 h-3.5 mr-2" /> 全文コピー
                            </Button>
                            <a href={`/api/seo/articles/${id}/export/note`} className="h-10 px-4 rounded-xl bg-amber-100 text-amber-700 flex items-center gap-2 font-black text-xs hover:bg-amber-200 transition-colors">
                               <Download className="w-3.5 h-3.5" /> ダウンロード
                            </a>
                          </div>
                        </div>
                        <div className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-sm">
                          <MarkdownPreview markdown={noteItem.content} />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-8">
                <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h2 className="text-xl font-black text-gray-900 tracking-tight">図解・アセット</h2>
                      <p className="text-xs text-purple-500 font-bold uppercase tracking-wider">Nano Banner Pro Powered</p>
                    </div>
                  </div>
                  
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                         <Wand2 className="w-4 h-4 text-purple-500" /> AI Auto Suggestions
                      </h3>
                      <DiagramSuggestions articleId={id} onGenerated={() => load()} busy={busy} setBusy={setBusy} setMessage={setMessage} />
                    </section>

                    <section className="pt-10 border-t border-gray-50">
                      <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6">Generated Assets</h3>
                      {article.images?.length ? (
                        <div className="grid sm:grid-cols-2 gap-6">
                          {article.images.map((img) => (
                            <div key={img.id} className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500">
                              <div className="aspect-video bg-gray-50 relative overflow-hidden">
                                <img src={`/api/seo/images/${img.id}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={img.title || ''} />
                                <div className="absolute top-4 left-4">
                                  <Badge tone={img.kind === 'banner' ? 'orange' : 'blue'}>
                                    {img.kind === 'banner' ? 'Banner' : 'Diagram'}
                                  </Badge>
                                </div>
                                <div className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                   <a href={`/api/seo/images/${img.id}`} target="_blank" className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform shadow-xl">
                                      <Eye className="w-5 h-5" />
                                   </a>
                                   <button onClick={() => copyToClipboard(`![${img.title || 'image'}](/api/seo/images/${img.id})`)} className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform shadow-xl">
                                      <Copy className="w-5 h-5" />
                                   </button>
                                </div>
                              </div>
                              <div className="p-5">
                                <p className="font-black text-gray-900 mb-1">{img.title || 'Untitled Asset'}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(img.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-20 bg-gray-50/50 rounded-[32px] border-2 border-dashed border-gray-100">
                           <ImageIcon className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                           <p className="text-gray-400 font-black">生成された画像がありません</p>
                        </div>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs like research, outline, etc. can be simplified for now */}
            {tab === 'research' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8">
                 <h2 className="text-xl font-black text-gray-900 mb-6">リサーチ結果</h2>
                 <div className="grid gap-4">
                    {(article.references || []).map((r) => (
                      <div key={r.id} className="p-6 rounded-3xl border border-gray-50 bg-gray-50/30">
                        <div className="flex items-start justify-between mb-3">
                          <h4 className="font-black text-gray-900">{r.title || r.url}</h4>
                          <a href={r.url} target="_blank" className="text-blue-500 hover:scale-110 transition-transform"><ExternalLink className="w-4 h-4" /></a>
                        </div>
                        {r.summary && <p className="text-sm text-gray-500 font-bold leading-relaxed">{r.summary}</p>}
                      </div>
                    ))}
                 </div>
              </div>
            )}
            
            {/* ... other tab contents simplified ... */}
            {tab === 'export' && (
               <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8">
                 <h2 className="text-xl font-black text-gray-900 mb-8">エクスポート</h2>
                 <div className="grid sm:grid-cols-2 gap-6">
                    <a href={`/api/seo/articles/${id}/export/markdown`} className="p-8 rounded-[40px] border-2 border-gray-50 bg-gray-50/30 hover:border-blue-500 hover:bg-white transition-all group">
                       <FileText className="w-12 h-12 text-gray-300 group-hover:text-blue-500 mb-4" />
                       <h4 className="text-lg font-black text-gray-900">Markdown (.md)</h4>
                       <p className="text-xs text-gray-400 font-bold mt-2 leading-relaxed">汎用的なマークダウン形式。GitHub, Qiita, Notion等に最適。</p>
                    </a>
                    <a href={`/api/seo/articles/${id}/export/wp`} className="p-8 rounded-[40px] border-2 border-gray-50 bg-gray-50/30 hover:border-emerald-500 hover:bg-white transition-all group">
                       <Layout className="w-12 h-12 text-gray-300 group-hover:text-emerald-500 mb-4" />
                       <h4 className="text-lg font-black text-gray-900">WordPress</h4>
                       <p className="text-xs text-gray-400 font-bold mt-2 leading-relaxed">ブロックエディタにそのまま貼り付け可能なクリーンなHTML形式。</p>
                    </a>
                 </div>
               </div>
            )}
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            <div className="bg-white rounded-[32px] border border-gray-100 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Quick Actions</h3>
              </div>
              <div className="space-y-3">
                <button onClick={() => setTab('audit')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Quality Audit</span>
                  <CheckCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
                <button onClick={() => setTab('meta')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-pink-50 text-pink-700 hover:bg-pink-100 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Meta Info</span>
                  <Tag className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
                <button onClick={() => setTab('media')} className="w-full flex items-center justify-between p-4 rounded-2xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all group">
                  <span className="text-xs font-black uppercase tracking-widest">Assets Gen</span>
                  <ImageIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Work Memo</h3>
              <textarea
                className="w-full min-h-32 p-5 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white transition-all leading-relaxed mb-4 shadow-inner"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="AIの弱点対策や、執筆時に意識したいポイントをメモ..."
              />
              <Button
                variant="primary"
                onClick={() => act('memo', async () => {
                  const res = await fetch(`/api/seo/articles/${id}/memo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: memo }),
                  })
                  const json = await res.json()
                  if (!json.success) throw new Error(json.error || '失敗しました')
                })}
                className="w-full h-12 rounded-2xl bg-gray-900 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-900/10"
              >
                Save Memo
              </Button>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6">Inputs</h3>
              {article.requestText && (
                <div className="mb-6">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center gap-2">
                     <MessageSquare className="w-3 h-3" /> Request Text
                  </p>
                  <div className="p-5 rounded-2xl bg-gray-50 text-[11px] font-bold text-gray-600 line-clamp-[10] leading-relaxed border border-gray-100">
                    {article.requestText}
                  </div>
                </div>
              )}
              {article.referenceImages && (article.referenceImages as any[]).length > 0 && (
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-3 flex items-center gap-2">
                     <ImageIcon className="w-3 h-3" /> Ref Images
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {(article.referenceImages as any[]).map((img, i) => (
                      <div key={i} className="aspect-square rounded-2xl bg-gray-100 overflow-hidden border border-gray-100 group cursor-pointer relative">
                        <img src={img.dataUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute inset-0 bg-gray-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <h3 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Metadata</h3>
              </div>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Created</span>
                  <span className="text-xs font-black text-gray-900">{new Date(article.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Status</span>
                  <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : 'amber'}>
                    {article.status}
                  </Badge>
                </div>
                <div className="pt-5 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-gray-400 uppercase">Auto Bundle</span>
                  <Badge tone="blue">Enabled</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}

export default function SeoArticlePage() {
  return (
    <ClientErrorBoundary title="記事ページの表示でエラーが発生しました">
      <SeoArticleInner />
    </ClientErrorBoundary>
  )
}
