'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MarkdownPreview } from '@seo/components/MarkdownPreview'
import { ClientErrorBoundary } from '@seo/components/ClientErrorBoundary'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
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
  Clock,
  Target,
  BarChart3,
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
}

const TABS = [
  { id: 'preview', label: 'プレビュー', icon: Eye, color: 'text-blue-400' },
  { id: 'edit', label: '編集', icon: Edit3, color: 'text-purple-400' },
  { id: 'research', label: 'リサーチ', icon: Compass, color: 'text-cyan-400' },
  { id: 'outline', label: 'アウトライン', icon: Layout, color: 'text-amber-400' },
  { id: 'meta', label: 'メタ', icon: Tag, color: 'text-pink-400' },
  { id: 'audit', label: '監査', icon: CheckCircle, color: 'text-emerald-400' },
  { id: 'media', label: '画像', icon: ImageIcon, color: 'text-orange-400' },
  { id: 'links', label: 'リンク', icon: Link2, color: 'text-indigo-400' },
  { id: 'export', label: '出力', icon: Download, color: 'text-gray-400' },
] as const

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

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">読み込み中...</p>
          </div>
        </div>
      </main>
    )
  }

  if (!article) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div>
              <p className="font-bold text-red-300">読み込みに失敗しました</p>
              <pre className="text-xs text-red-200/80 whitespace-pre-wrap mt-2">{loadError || '不明なエラー'}</pre>
              <p className="text-xs mt-3 text-red-200/60">
                環境変数（<code className="bg-red-500/20 px-1 rounded">GOOGLE_GENAI_API_KEY</code> / <code className="bg-red-500/20 px-1 rounded">DATABASE_URL</code>）とDB接続状態を確認してください。
              </p>
            </div>
          </div>
          <button
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
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
  const isComplete = article.status === 'DONE' && score.charCount >= article.targetChars * 0.9

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link href="/seo" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          一覧へ戻る
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : article.status === 'RUNNING' ? 'amber' : 'blue'}>
                {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : article.status === 'RUNNING' ? '生成中' : '下書き'}
              </Badge>
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
                {article.title}
              </h1>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              目標 {article.targetChars.toLocaleString('ja-JP')}字 → 現在 {score.charCount.toLocaleString('ja-JP')}字 ({charProgress}%)
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {latestJobId && latestJob?.status !== 'done' && (
              <Button
                variant={autoRun ? 'secondary' : 'primary'}
                onClick={() => setAutoRun((v) => !v)}
                className={autoRun ? 'animate-pulse' : ''}
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

      {/* Progress Banner */}
      {latestJob && latestJob.status !== 'done' && (
        <div className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <p className="font-bold text-amber-300">生成中</p>
                <p className="text-xs text-amber-200/70">ステップ: {latestJob.step}</p>
              </div>
            </div>
            <div className="flex-1 max-w-md">
              <div className="flex items-center justify-between text-xs text-amber-200/70 mb-1">
                <span>進捗</span>
                <span>{latestJob.progress}%</span>
              </div>
              <ProgressBar value={latestJob.progress} />
            </div>
          </div>
          {latestJob.error && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/20 text-red-300 text-sm">
              <p className="font-bold">エラー</p>
              <pre className="text-xs whitespace-pre-wrap mt-1">{latestJob.error}</pre>
            </div>
          )}
        </div>
      )}

      {/* Action Error */}
      {actionError && (
        <div className="mb-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <p className="font-bold">実行エラー</p>
          <pre className="text-xs whitespace-pre-wrap mt-1">{actionError}</pre>
        </div>
      )}

      {/* Success Message */}
      {message && (
        <div className="mb-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${score.score >= 70 ? 'bg-emerald-500/20' : score.score >= 50 ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
              <BarChart3 className={`w-5 h-5 ${score.score >= 70 ? 'text-emerald-400' : score.score >= 50 ? 'text-amber-400' : 'text-red-400'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{score.score}</p>
              <p className="text-xs text-gray-500">Content Score</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${charProgress >= 90 ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}>
              <Target className={`w-5 h-5 ${charProgress >= 90 ? 'text-emerald-400' : 'text-blue-400'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{score.charCount.toLocaleString()}</p>
              <p className="text-xs text-gray-500">文字数 ({charProgress}%)</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{score.headingCount}</p>
              <p className="text-xs text-gray-500">見出し</p>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{article.images?.length || 0}</p>
              <p className="text-xs text-gray-500">画像</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-1 p-1 rounded-2xl bg-gray-800/50 border border-gray-700 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gray-700 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
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
                      <Eye className="w-5 h-5 text-blue-400" />
                      プレビュー
                    </CardTitle>
                    <CardDesc>Markdownをレンダリングします（表/画像/リンク）。</CardDesc>
                  </div>
                  {markdown && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(markdown)}
                    >
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {copied ? 'コピー済み' : 'コピー'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardBody>
                {markdown ? (
                  <MarkdownPreview markdown={markdown} />
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>最終稿がありません</p>
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
                  <Edit3 className="w-5 h-5 text-purple-400" />
                  最終稿（貼り付け・編集）
                </CardTitle>
                <CardDesc>ここに本文を貼り付けて保存できます。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <textarea
                  className="w-full min-h-[520px] font-mono text-sm p-4 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
                  value={markdownDraft}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                  placeholder="ここにMarkdown/テキストを貼り付け…"
                />

                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={normalizeOnSave}
                      onChange={(e) => setNormalizeOnSave(e.target.checked)}
                      className="rounded"
                    />
                    Markdown整形して保存
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={updateOutlineOnSave}
                      onChange={(e) => setUpdateOutlineOnSave(e.target.checked)}
                      className="rounded"
                    />
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

          {tab === 'research' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-cyan-400" />
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
                    <div key={r.id} className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-bold text-white truncate">{r.title || r.url}</p>
                          <a className="text-xs text-blue-400 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                            {r.url}
                          </a>
                        </div>
                        <Badge tone="purple">参考</Badge>
                      </div>
                      {r.summary && <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{r.summary}</p>}
                    </div>
                  ))}
                  {(article.references || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Compass className="w-10 h-10 mx-auto mb-2 opacity-50" />
                      <p>参考URL解析結果がありません</p>
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
                  <Layout className="w-5 h-5 text-amber-400" />
                  アウトライン（編集可）
                </CardTitle>
                <CardDesc>アウトラインを整えると分割生成が安定します。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
                <textarea
                  className="w-full min-h-[380px] font-mono text-sm p-4 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
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
                  <Tag className="w-5 h-5 text-pink-400" />
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
                  <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-gray-800 border border-gray-700 text-gray-300">
                    {metaItem.content}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Tag className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>メタがありません</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'audit' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
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
                  <pre className="text-sm whitespace-pre-wrap p-4 rounded-xl bg-gray-800 border border-gray-700 text-gray-300">
                    {latestAudit.report}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>監査レポートがありません</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'media' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-orange-400" />
                  画像（バナー / 図解）
                </CardTitle>
                <CardDesc>Geminiで生成し、Markdownリンクで記事に挿入できます。</CardDesc>
              </CardHeader>
              <CardBody className="space-y-4">
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
                  {busy === 'banner' ? '生成中...' : 'バナー生成'}
                </Button>

                <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/50 space-y-3">
                  <p className="text-sm font-bold text-gray-400">図解を生成</p>
                  <input
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder:text-gray-500 text-sm"
                    value={diagramTitle}
                    onChange={(e) => setDiagramTitle(e.target.value)}
                    placeholder="図解タイトル（例：施策マップ）"
                  />
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-gray-600 bg-gray-700 text-white placeholder:text-gray-500 text-sm min-h-20"
                    value={diagramDesc}
                    onChange={(e) => setDiagramDesc(e.target.value)}
                    placeholder="図解で表現する内容（例：入力→解析→生成→監査→公開の流れ）"
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
                    {busy === 'diagram' ? '生成中...' : '図解生成'}
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  {article.images?.map((img) => (
                    <div key={img.id} className="p-4 rounded-xl border border-gray-700 bg-gray-800/50">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-white">
                          {img.kind}: {img.title || img.id}
                        </p>
                        <a className="text-xs text-blue-400 hover:underline" href={`/api/seo/images/${img.id}`} target="_blank" rel="noreferrer">
                          表示
                        </a>
                      </div>
                      <div className="mt-2 p-2 rounded bg-gray-700 text-xs text-gray-400 font-mono">
                        ![{img.title || 'image'}](/api/seo/images/{img.id})
                      </div>
                    </div>
                  ))}
                </div>
                {!article.images?.length && (
                  <div className="text-center py-8 text-gray-500">
                    <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>画像がありません</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'links' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-indigo-400" />
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
                  <div className="max-h-[420px] overflow-auto rounded-xl border border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800 text-gray-400 sticky top-0">
                        <tr>
                          <th className="text-left p-3">URL</th>
                          <th className="text-left p-3 w-24">結果</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {article.linkChecks.map((r) => (
                          <tr key={r.url} className="hover:bg-gray-800/50">
                            <td className="p-3">
                              <a className="text-blue-400 hover:underline truncate block" href={r.url} target="_blank" rel="noreferrer">
                                {r.url}
                              </a>
                              {r.finalUrl && r.finalUrl !== r.url && (
                                <div className="text-xs text-gray-500 mt-1">→ {r.finalUrl}</div>
                              )}
                            </td>
                            <td className={`p-3 ${r.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                              {r.ok ? '✓ OK' : '✗ NG'} {r.statusCode ? `(${r.statusCode})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Link2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>リンクチェック未実行</p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'export' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-gray-400" />
                  エクスポート
                </CardTitle>
                <CardDesc>用途別にダウンロードできます。</CardDesc>
              </CardHeader>
              <CardBody>
                <div className="grid sm:grid-cols-3 gap-4">
                  <a href={`/api/seo/articles/${id}/export/markdown`} className="block">
                    <div className="p-4 rounded-xl border border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center">
                      <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="font-bold text-white">Markdown</p>
                      <p className="text-xs text-gray-500 mt-1">.md形式</p>
                    </div>
                  </a>
                  <a href={`/api/seo/articles/${id}/export/html`} className="block">
                    <div className="p-4 rounded-xl border border-gray-700 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-center">
                      <Layers className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="font-bold text-white">HTML</p>
                      <p className="text-xs text-gray-500 mt-1">.html形式</p>
                    </div>
                  </a>
                  <a href={`/api/seo/articles/${id}/export/wp`} className="block">
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all text-center">
                      <ExternalLink className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
                      <p className="font-bold text-emerald-300">WordPress</p>
                      <p className="text-xs text-emerald-400/70 mt-1">クリーンHTML</p>
                    </div>
                  </a>
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
                <MessageSquare className="w-5 h-5 text-gray-400" />
                作業メモ
              </CardTitle>
              <CardDesc>AIっぽさ対策のメモ</CardDesc>
            </CardHeader>
            <CardBody className="space-y-3">
              <textarea
                className="w-full min-h-28 px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 text-sm focus:outline-none focus:border-emerald-500"
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                ナレッジ（自動生成）
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {['intro_ab', 'internal_link', 'sns'].flatMap((t) => knowledgeByType(t)).map((k) => (
                <details key={k.id} className="p-3 rounded-xl bg-gray-800/50 border border-gray-700 group">
                  <summary className="text-sm font-bold text-white cursor-pointer flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    {k.title || k.type}
                  </summary>
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap mt-3 pt-3 border-t border-gray-700">{k.content}</pre>
                </details>
              ))}
              {!article.knowledgeItems?.length && (
                <p className="text-sm text-gray-500 text-center py-4">ナレッジがありません</p>
              )}
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-400" />
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
                <CheckCircle className="w-4 h-4 text-emerald-400" />
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
                <Tag className="w-4 h-4 text-pink-400" />
                メタ生成
              </Button>
              <Button
                variant="secondary"
                className="w-full justify-start"
                onClick={() =>
                  act('banner', async () => {
                    const res = await fetch(`/api/seo/articles/${id}/images/banner`, { method: 'POST' })
                    const json = await res.json()
                    if (!json.success) throw new Error(json.error || '失敗しました')
                  })
                }
                disabled={!!busy}
              >
                <ImageIcon className="w-4 h-4 text-orange-400" />
                バナー生成
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </main>
  )
}
