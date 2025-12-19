'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { ClientErrorBoundary } from '@seo/components/ClientErrorBoundary'
import { GenerationProgress } from '@seo/components/GenerationProgress'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { analyzeMarkdown } from '@seo/lib/score'
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
  // 新機能：依頼テキストと参考画像
  requestText?: string | null
  referenceImages?: { name: string; dataUrl: string }[] | null
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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={fetchSuggestions}
          disabled={loading || !!busy}
        >
          <Wand2 className="w-4 h-4" />
          {loading ? '分析中...' : '記事を分析して提案'}
        </Button>
        {suggestions.length > 0 && (
          <span className="text-sm text-gray-500">
            {suggestions.length}個の図解を提案
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {suggestions.length > 0 && (
        <>
          <div className="space-y-3">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  s.selected
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 bg-gray-50 opacity-60'
                }`}
                onClick={() => toggleSelection(i)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={s.selected}
                    onChange={() => toggleSelection(i)}
                    className="mt-1 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{s.title}</p>
                      <Badge
                        tone={s.priority === 'high' ? 'red' : s.priority === 'medium' ? 'amber' : 'gray'}
                      >
                        {s.priority === 'high' ? '優先度高' : s.priority === 'medium' ? '優先度中' : '優先度低'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{s.description}</p>
                    {s.insertAfterHeading && (
                      <p className="text-xs text-gray-400 mt-1">
                        挿入位置: 「{s.insertAfterHeading}」の後
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              {selectedCount}個を選択中
            </p>
            <Button
              variant="primary"
              onClick={generateSelected}
              disabled={generating || selectedCount === 0 || !!busy}
            >
              <Sparkles className="w-4 h-4" />
              {generating ? '生成中...' : `選択した${selectedCount}個を生成`}
            </Button>
          </div>
        </>
      )}

      {!suggestions.length && !loading && (
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-600">
            「記事を分析して提案」ボタンをクリックすると、AIが記事内容を分析して
            読者の理解を助ける図解を3〜5個提案します。
          </p>
          <ul className="text-xs text-gray-500 mt-2 space-y-1">
            <li>• 複雑なプロセスやフロー</li>
            <li>• 比較や対比を示す箇所</li>
            <li>• 概念や関係性の説明</li>
            <li>• 選択肢がある場面</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default function SeoArticlePage() {
  return (
    <ClientErrorBoundary title="記事ページの表示でエラーが発生しました">
      <SeoArticleInner />
    </ClientErrorBoundary>
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

  // セクション進捗を計算
  const sectionsDone = useMemo(() => {
    return (article?.sections || []).filter((s) => s.status === 'reviewed').length
  }, [article])
  const sectionsTotal = useMemo(() => {
    return (article?.sections || []).length
  }, [article])

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 mt-4">読み込み中...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="p-6 rounded-2xl border border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-800">読み込みに失敗しました</p>
              <pre className="text-xs text-red-600 whitespace-pre-wrap mt-2">{loadError || '不明なエラー'}</pre>
              <p className="text-xs mt-3 text-red-500">
                環境変数（<code className="bg-red-100 px-1 rounded">GOOGLE_GENAI_API_KEY</code> / <code className="bg-red-100 px-1 rounded">DATABASE_URL</code>）とDB接続状態を確認してください。
              </p>
            </div>
          </div>
          <button
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors"
            onClick={() => load({ showLoading: true })}
          >
            <RefreshCcw className="w-4 h-4" />
            再読み込み
          </button>
        </div>
      </main>
    )
  }

  const latestAudit = article.audits?.[0]
  const knowledgeByType = (t: string) => (article.knowledgeItems || []).filter((k) => k.type === t)
  const metaItem = knowledgeByType('meta')?.[0]
  const charProgress = Math.min(100, Math.round((score.charCount / article.targetChars) * 100))
  const isGenerating = latestJob && latestJob.status !== 'done' && latestJob.status !== 'error'

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/seo" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          一覧へ戻る
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : article.status === 'RUNNING' ? 'amber' : 'blue'}>
                {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : article.status === 'RUNNING' ? '生成中' : '下書き'}
              </Badge>
              <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight truncate">
                {article.title}
              </h1>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              目標 {article.targetChars.toLocaleString('ja-JP')}字 → 現在 {score.charCount.toLocaleString('ja-JP')}字 ({charProgress}%)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {latestJobId && latestJob?.status !== 'done' && (
              <Button
                variant={autoRun ? 'secondary' : 'primary'}
                onClick={() => setAutoRun((v) => !v)}
              >
                {autoRun ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {autoRun ? '一時停止' : '生成を開始'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => load({ showLoading: true })}>
              <RefreshCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Generation Progress (large, animated) */}
      {isGenerating && (
        <div className="mb-8">
          <GenerationProgress
            status={latestJob.status}
            step={latestJob.step}
            progress={latestJob.progress}
            sectionsDone={sectionsDone}
            sectionsTotal={sectionsTotal}
          />
          {latestJob.error && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <p className="font-bold">エラー詳細</p>
              <pre className="text-xs whitespace-pre-wrap mt-2">{latestJob.error}</pre>
            </div>
          )}
          {actionError && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <p className="font-bold">実行エラー</p>
              <pre className="text-xs whitespace-pre-wrap mt-2">{actionError}</pre>
            </div>
          )}
        </div>
      )}

      {/* Completion/Error Status */}
      {latestJob?.status === 'done' && (
        <div className="mb-6">
          <GenerationProgress status="done" step="done" progress={100} />
        </div>
      )}

      {latestJob?.status === 'error' && (
        <div className="mb-6">
          <GenerationProgress status="error" step="error" progress={latestJob.progress} />
        </div>
      )}

      {/* Success Message */}
      {message && (
        <div className="mb-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Stats Cards (only show when not actively generating) */}
      {!isGenerating && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-2xl border ${score.score >= 70 ? 'bg-emerald-50 border-emerald-200' : score.score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${score.score >= 70 ? 'bg-emerald-100' : score.score >= 50 ? 'bg-amber-100' : 'bg-red-100'}`}>
                <BarChart3 className={`w-5 h-5 ${score.score >= 70 ? 'text-emerald-600' : score.score >= 50 ? 'text-amber-600' : 'text-red-600'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${score.score >= 70 ? 'text-emerald-700' : score.score >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{score.score}</p>
                <p className="text-xs text-gray-500">Content Score</p>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-2xl border ${charProgress >= 90 ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${charProgress >= 90 ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                <Target className={`w-5 h-5 ${charProgress >= 90 ? 'text-emerald-600' : 'text-blue-600'}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${charProgress >= 90 ? 'text-emerald-700' : 'text-blue-700'}`}>{score.charCount.toLocaleString()}</p>
                <p className="text-xs text-gray-500">文字数 ({charProgress}%)</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border bg-purple-50 border-purple-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-700">{score.headingCount}</p>
                <p className="text-xs text-gray-500">見出し</p>
              </div>
            </div>
          </div>
          <div className="p-4 rounded-2xl border bg-orange-50 border-orange-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{article.images?.length || 0}</p>
                <p className="text-xs text-gray-500">画像</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1.5 rounded-2xl bg-gray-100 border border-gray-200 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? t.color : ''}`} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {tab === 'preview' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-500" />
                      プレビュー
                    </CardTitle>
                    <CardDesc>Markdownをレンダリングします（表/画像/リンク）。</CardDesc>
                  </div>
                  {markdown && (
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(markdown)}>
                      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'コピー済み' : 'コピー'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {markdown ? (
                  <MarkdownPreview markdown={markdown} />
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-600 font-medium">最終稿がありません</p>
                    <p className="text-sm mt-1">「生成を開始」ボタンで記事を生成してください</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'edit' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-purple-500" />
                  最終稿（貼り付け・編集）
                </CardTitle>
                <CardDesc>ここに本文を貼り付けて保存できます。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <textarea
                  className="w-full min-h-[520px] font-mono text-sm p-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  value={markdownDraft}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                  placeholder="ここにMarkdown/テキストを貼り付け…"
                />

                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={normalizeOnSave} onChange={(e) => setNormalizeOnSave(e.target.checked)} className="rounded" />
                    Markdown整形して保存
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={updateOutlineOnSave} onChange={(e) => setUpdateOutlineOnSave(e.target.checked)} className="rounded" />
                    アウトラインも更新
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setMarkdownDraft(article.finalMarkdown || '')} disabled={!!busy}>
                    元に戻す
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('content', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/content`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ finalMarkdown: markdownDraft, normalize: normalizeOnSave, updateOutline: updateOutlineOnSave }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy || !markdownDraft.trim()}
                  >
                    <FileText className="w-4 h-4" />
                    保存
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === 'note' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-amber-500" />
                  note記事を作成
                </CardTitle>
                <CardDesc>
                  noteで読まれやすい文体・構成で記事を生成します。
                  パーソナルな語り口、適度な余白、読者への語りかけを重視。
                </CardDesc>
              </CardHeader>
              <CardBody className="space-y-5">
                {/* note記事の特徴説明 */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm font-bold text-amber-800 mb-2">📝 note記事の特徴</p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• 1文が短く、読みやすい（40文字目安）</li>
                    <li>• 「〜ですよね」「〜なんです」のような親しみやすい文体</li>
                    <li>• 冒頭で読者の共感を呼ぶ問いかけ</li>
                    <li>• 体験談や具体的なエピソードを交える</li>
                    <li>• 最後に読者への温かいメッセージ</li>
                  </ul>
                </div>

                {/* 生成ボタン */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('note', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/generate-note`, { method: 'POST' })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <Sparkles className="w-4 h-4" />
                    {busy === 'note' ? 'note記事を生成中...' : 'note記事を生成'}
                  </Button>
                  <span className="text-xs text-gray-500">
                    ※ 記事情報（タイトル、キーワード、ペルソナ）を元に生成します
                  </span>
                </div>

                {/* 生成されたnote記事を表示 */}
                {(() => {
                  const noteItem = (article.knowledgeItems || []).find((k) => k.type === 'note_article')
                  if (!noteItem) {
                    return (
                      <div className="text-center py-12 text-gray-400">
                        <PenTool className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="text-gray-600 font-medium">note記事がまだありません</p>
                        <p className="text-sm mt-1">上のボタンでnote向けの記事を生成できます</p>
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-700">生成されたnote記事</p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(noteItem.content)
                              setMessage('コピーしました ✓')
                              setTimeout(() => setMessage(null), 2000)
                            }}
                          >
                            <Copy className="w-4 h-4" />
                            コピー
                          </Button>
                          <a
                            href={`/api/seo/articles/${id}/export/note`}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-bold text-amber-700 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            ダウンロード
                          </a>
                        </div>
                      </div>
                      <div className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm">
                        <MarkdownPreview markdown={noteItem.content} />
                      </div>
                    </div>
                  )
                })()}

                {/* noteへの投稿ガイド */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-sm font-bold text-gray-600 mb-2">💡 noteに投稿する際のヒント</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• 記事をコピーしてnoteのエディタに貼り付けます</li>
                    <li>• 見出しや太字はそのまま反映されます</li>
                    <li>• 画像は別途noteにアップロードして挿入してください</li>
                    <li>• 冒頭の文章が特に重要です（フィードでの表示に影響）</li>
                    <li>• タグは3〜5個程度がおすすめ</li>
                  </ul>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === 'research' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-cyan-500" />
                  リサーチ
                </CardTitle>
                <CardDesc>参考URLを要点化してナレッジとして蓄積します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    act('research', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/research`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Search className="w-4 h-4" />
                  {busy === 'research' ? '解析中...' : '参考URLを解析'}
                </Button>

                <div className="space-y-3">
                  {(article.references || []).map((r) => (
                    <div key={r.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{r.title || r.url}</p>
                          <a className="text-xs text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                            {r.url}
                          </a>
                        </div>
                        <Badge tone="purple">参考</Badge>
                      </div>
                      {r.summary && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{r.summary}</p>}
                    </div>
                  ))}
                  {(article.references || []).length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                      <Compass className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-gray-600">参考URL解析結果がありません</p>
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {tab === 'outline' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="w-5 h-5 text-amber-500" />
                  アウトライン（編集可）
                </CardTitle>
                <CardDesc>アウトラインを整えると分割生成が安定します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <textarea
                  className="w-full min-h-[380px] font-mono text-sm p-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500"
                  value={outlineDraft}
                  onChange={(e) => setOutlineDraft(e.target.value)}
                  placeholder="（未生成）"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setOutlineDraft(article.outline || '')} disabled={!!busy}>
                    元に戻す
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('outline', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/outline`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ outline: outlineDraft }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <FileText className="w-4 h-4" />
                    保存
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {tab === 'meta' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="w-5 h-5 text-pink-500" />
                  メタ生成
                </CardTitle>
                <CardDesc>SERPスニペット用のメタをGeminiで生成します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="primary"
                  onClick={() =>
                    act('meta', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/meta`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Wand2 className="w-4 h-4" />
                  {busy === 'meta' ? '生成中...' : 'メタを生成'}
                </Button>

                {metaItem ? (
                  <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700">
                    {metaItem.content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Tag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-600">メタがありません</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'audit' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  品質監査（二重チェック）
                </CardTitle>
                <CardDesc>別プロンプトで弱点を洗い出し、自動修正で反映します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('audit', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/audit`, { method: 'POST' })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <BookOpen className="w-4 h-4" />
                    {busy === 'audit' ? '監査中...' : '監査'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act('autofix', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/autofix`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ auditId: latestAudit?.id }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy || !latestAudit}
                  >
                    <Zap className="w-4 h-4" />
                    自動修正
                  </Button>
                </div>
                {latestAudit ? (
                  <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-gray-50 border border-gray-200 text-gray-700">
                    {latestAudit.report}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-600">監査レポートがありません</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'media' && (
            <div className="space-y-6">
              {/* バナー画像 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-orange-500" />
                    バナー画像
                  </CardTitle>
                  <CardDesc>記事のアイキャッチ画像を生成します。SNSシェア時にも使用できます。</CardDesc>
                </CardHeader>
                <CardBody>
                  <Button
                    variant="primary"
                    onClick={() =>
                      act('banner', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/images/banner`, { method: 'POST' })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                      })
                    }
                    disabled={!!busy}
                  >
                    <ImageIcon className="w-4 h-4" />
                    {busy === 'banner' ? '生成中...' : 'バナーを生成'}
                  </Button>
                  {article.images?.filter((img) => img.kind === 'banner').map((img) => (
                    <div key={img.id} className="mt-4 p-4 rounded-xl border border-orange-200 bg-orange-50">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-bold text-gray-900">{img.title || 'バナー画像'}</p>
                        <a className="text-xs text-blue-600 hover:underline" href={`/api/seo/images/${img.id}`} target="_blank" rel="noreferrer">
                          表示
                        </a>
                      </div>
                      <div className="p-2 rounded bg-white text-xs text-gray-600 font-mono border border-gray-200">
                        ![{img.title || 'banner'}](/api/seo/images/{img.id})
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* 図解の自動提案 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-500" />
                    図解を自動提案
                  </CardTitle>
                  <CardDesc>
                    記事の内容を分析して、読者の理解を助ける図解を自動で提案します。
                    提案された図解をまとめて生成できます。
                  </CardDesc>
                </CardHeader>
                <CardBody className="space-y-4">
                  <DiagramSuggestions articleId={id} onGenerated={() => load()} busy={busy} setBusy={setBusy} setMessage={setMessage} />
                </CardBody>
              </Card>

              {/* 手動で図解を作成 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    手動で図解を作成
                  </CardTitle>
                  <CardDesc>特定の内容を図解にしたい場合は、こちらから作成できます。</CardDesc>
                </CardHeader>
                <CardBody className="space-y-3">
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm"
                    value={diagramTitle}
                    onChange={(e) => setDiagramTitle(e.target.value)}
                    placeholder="図解タイトル（例：RPO導入フロー）"
                  />
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm min-h-20"
                    value={diagramDesc}
                    onChange={(e) => setDiagramDesc(e.target.value)}
                    placeholder="図解で表現する内容（例：課題発見→要件定義→業者選定→導入→運用の5ステップ）"
                  />
                  <Button
                    variant="secondary"
                    onClick={() =>
                      act('diagram', async () => {
                        const res = await fetch(`/api/seo/articles/${id}/images/diagram`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: diagramTitle, description: diagramDesc }),
                        })
                        const json = await res.json()
                        if (!json.success) throw new Error(json.error || '失敗しました')
                        setDiagramTitle('')
                        setDiagramDesc('')
                      })
                    }
                    disabled={!!busy || !diagramTitle.trim() || !diagramDesc.trim()}
                  >
                    <Sparkles className="w-4 h-4" />
                    {busy === 'diagram' ? '生成中...' : '図解を生成'}
                  </Button>
                </CardBody>
              </Card>

              {/* 生成済み画像一覧 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-gray-500" />
                    生成済み画像一覧
                  </CardTitle>
                  <CardDesc>
                    画像をクリックして表示。Markdownコードをコピーして記事に挿入できます。
                  </CardDesc>
                </CardHeader>
                <CardBody>
                  {article.images?.length ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {article.images.map((img) => (
                        <div key={img.id} className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <Badge tone={img.kind === 'banner' ? 'orange' : 'blue'}>
                                {img.kind === 'banner' ? 'バナー' : '図解'}
                              </Badge>
                              <p className="text-sm font-bold text-gray-900 mt-1">{img.title || img.id}</p>
                              {img.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{img.description}</p>
                              )}
                            </div>
                            <a
                              href={`/api/seo/images/${img.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-shrink-0 px-2 py-1 text-xs font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                            >
                              表示
                            </a>
                          </div>
                          <div className="p-2 rounded bg-gray-50 border border-gray-100">
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-xs text-gray-600 truncate">
                                ![{img.title || 'image'}](/api/seo/images/{img.id})
                              </code>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`![${img.title || 'image'}](/api/seo/images/${img.id})`)
                                  setMessage('コピーしました ✓')
                                  setTimeout(() => setMessage(null), 2000)
                                }}
                                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p className="text-gray-600">まだ画像がありません</p>
                      <p className="text-sm mt-1">上のボタンから画像を生成できます</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {tab === 'links' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-indigo-500" />
                  リンクチェック
                </CardTitle>
                <CardDesc>記事内リンクを抽出して到達確認します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <Button
                  variant="secondary"
                  onClick={() =>
                    act('linkcheck', async () => {
                      const res = await fetch(`/api/seo/articles/${id}/link-check`, { method: 'POST' })
                      const json = await res.json()
                      if (!json.success) throw new Error(json.error || '失敗しました')
                    })
                  }
                  disabled={!!busy}
                >
                  <Link2 className="w-4 h-4" />
                  {busy === 'linkcheck' ? '確認中...' : 'リンクチェック実行'}
                </Button>
                {article.linkChecks?.length ? (
                  <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-left p-3">URL</th>
                          <th className="text-left p-3 w-24">結果</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {article.linkChecks.map((r) => (
                          <tr key={r.url} className="hover:bg-gray-50">
                            <td className="p-3">
                              <a className="text-blue-600 hover:underline truncate block" href={r.url} target="_blank" rel="noreferrer">
                                {r.url}
                              </a>
                              {r.finalUrl && r.finalUrl !== r.url && (
                                <div className="text-xs text-gray-400 mt-1">→ {r.finalUrl}</div>
                              )}
                            </td>
                            <td className={`p-3 ${r.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                              {r.ok ? '✓ OK' : '✗ NG'} {r.statusCode ? `(${r.statusCode})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-gray-600">リンクチェック未実行</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'export' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-gray-500" />
                  エクスポート
                </CardTitle>
                <CardDesc>用途別にダウンロードできます。プラットフォームに最適化された形式を選択してください。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* 基本フォーマット */}
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-3">📄 基本フォーマット</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <a href={`/api/seo/articles/${id}/export/markdown`} className="block">
                      <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center">
                        <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="font-bold text-gray-900">Markdown</p>
                        <p className="text-xs text-gray-500 mt-1">.md形式</p>
                      </div>
                    </a>
                    <a href={`/api/seo/articles/${id}/export/html`} className="block">
                      <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-center">
                        <Layers className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <p className="font-bold text-gray-900">HTML</p>
                        <p className="text-xs text-gray-500 mt-1">.html形式</p>
                      </div>
                    </a>
                  </div>
                </div>

                {/* プラットフォーム別 */}
                <div>
                  <p className="text-sm font-bold text-gray-600 mb-3">🌐 プラットフォーム別</p>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <a href={`/api/seo/articles/${id}/export/wp`} className="block">
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                            <ExternalLink className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-emerald-700">WordPress</p>
                            <p className="text-xs text-emerald-600 mt-0.5">クリーンHTML</p>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-600/80 mt-3">
                          ブロックエディタ対応。そのまま貼り付けられます。
                        </p>
                      </div>
                    </a>
                    <a href={`/api/seo/articles/${id}/export/note`} className="block">
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                            <span className="text-2xl">📝</span>
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-amber-700">note</p>
                            <p className="text-xs text-amber-600 mt-0.5">最適化Markdown</p>
                          </div>
                        </div>
                        <p className="text-xs text-amber-600/80 mt-3">
                          note向けに見出し・画像を調整済み。
                        </p>
                      </div>
                    </a>
                  </div>
                </div>

                {/* ヒント */}
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-sm font-bold text-gray-600 mb-2">💡 エクスポートのヒント</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <strong>WordPress</strong>: HTMLをそのままクラシックエディタまたはブロックエディタに貼り付け</li>
                    <li>• <strong>note</strong>: ダウンロード後、画像をnoteにアップロードして差し替えてください</li>
                    <li>• <strong>Markdown</strong>: GitHub、Qiita、Zenn、Notion等で使用可能</li>
                  </ul>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-500" />
                作業メモ
              </CardTitle>
              <CardDesc>AIっぽさ対策のメモ</CardDesc>
            </CardHeader>
            <CardBody className="space-y-3">
              <textarea
                className="w-full min-h-28 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-500"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="例）断言が強い。判断基準のトレードオフを追加。失敗談が欲しい。"
              />
              <Button
                variant="secondary"
                onClick={() =>
                  act('memo', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/memo`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: memo }),
                    })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
                disabled={!!busy}
              >
                <Settings className="w-4 h-4" />
                {busy === 'memo' ? '保存中...' : '保存'}
              </Button>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-500" />
                クイックアクション
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-2">
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() =>
                  act('audit', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/audit`, { method: 'POST' })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
                disabled={!!busy}
              >
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                品質チェック
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() =>
                  act('meta', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/meta`, { method: 'POST' })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
                disabled={!!busy}
              >
                <Tag className="w-4 h-4 text-pink-500" />
                メタ生成
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => setTab('media')}
              >
                <ImageIcon className="w-4 h-4 text-orange-500" />
                図解を作成
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() => setTab('note')}
              >
                <PenTool className="w-4 h-4 text-amber-500" />
                note記事を作成
              </Button>
            </CardBody>
          </Card>

          {/* 記事情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-500" />
                記事情報
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ステータス</span>
                <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : article.status === 'RUNNING' ? 'amber' : 'blue'}>
                  {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : article.status === 'RUNNING' ? '生成中' : '下書き'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">目標文字数</span>
                <span className="font-bold text-gray-900">{article.targetChars.toLocaleString()}字</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">現在の文字数</span>
                <span className="font-bold text-gray-900">{score.charCount.toLocaleString()}字</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">見出し数</span>
                <span className="font-bold text-gray-900">{score.headingCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">画像数</span>
                <span className="font-bold text-gray-900">{article.images?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Content Score</span>
                <span className={`font-bold ${score.score >= 70 ? 'text-emerald-600' : score.score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {score.score}点
                </span>
              </div>
            </CardBody>
          </Card>

          {/* 依頼テキスト */}
          {article.requestText && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyan-500" />
                  依頼テキスト
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="max-h-48 overflow-auto">
                  <pre className="text-xs text-gray-700 whitespace-pre-wrap">{article.requestText}</pre>
                </div>
              </CardBody>
            </Card>
          )}

          {/* 参考画像 */}
          {article.referenceImages && (article.referenceImages as any[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-orange-500" />
                  参考画像
                </CardTitle>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-2 gap-2">
                  {(article.referenceImages as { name: string; dataUrl: string }[]).map((img, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-full h-20 object-cover rounded-lg border border-gray-200"
                      />
                      <p className="text-[10px] text-gray-500 truncate mt-1">{img.name}</p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </main>
  )
}
