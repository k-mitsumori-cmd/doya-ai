'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
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
  CheckCircle2,
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
  autoBundle?: boolean
  createdAt: string
}

const TABS = [
  { id: 'preview', label: 'プレビュー', icon: Eye, color: 'text-blue-500' },
  { id: 'media', label: '図解・サムネ', icon: ImageIcon, color: 'text-orange-500' },
  { id: 'edit', label: '編集', icon: Edit3, color: 'text-purple-500' },
  { id: 'audit', label: '品質監査', icon: CheckCircle, color: 'text-emerald-500' },
  { id: 'note', label: 'note形式', icon: PenTool, color: 'text-amber-500' },
  { id: 'research', label: 'リサーチ', icon: Compass, color: 'text-cyan-500' },
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

  const markdown = useMemo(() => article?.finalMarkdown || '', [article])
  const score = useMemo(() => analyzeMarkdown(markdown || ''), [markdown])

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
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
            <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Loading Content...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!article) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto py-20 text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-gray-900 mb-4">記事が見つかりません</h2>
          <Button variant="primary" onClick={() => load({ showLoading: true })}>再試行</Button>
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
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button onClick={() => router.push('/seo')} className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-700 text-sm mb-4 font-bold transition-colors">
              <ArrowLeft className="w-4 h-4" /> 一覧へ戻る
            </button>
            <div className="flex items-center gap-3 mb-2">
              <Badge tone={article.status === 'DONE' ? 'green' : article.status === 'ERROR' ? 'red' : 'amber'}>
                {article.status === 'DONE' ? '完成' : article.status === 'ERROR' ? 'エラー' : '生成中'}
              </Badge>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">{article.title}</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400 font-bold">
              <p>目標 {article.targetChars.toLocaleString()}字</p>
              <div className="w-1 h-1 rounded-full bg-gray-200" />
              <p>現在 {score.charCount.toLocaleString()}字 ({charProgress}%)</p>
            </div>
          </div>
          <div className="flex gap-2">
            {isGenerating && (
              <Button variant={autoRun ? 'secondary' : 'primary'} onClick={() => setAutoRun(!autoRun)} className="h-12 rounded-2xl px-6 font-black shadow-lg shadow-blue-500/20">
                {autoRun ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                {autoRun ? '一時停止' : '生成を再開'}
              </Button>
            )}
            <Button variant="ghost" onClick={() => load({ showLoading: true })} className="w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm">
              <RefreshCcw className="w-5 h-5 text-gray-400" />
            </Button>
          </div>
        </div>

        {/* Progress Display */}
        {isGenerating && (
          <div className="mb-12 bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-blue-500/5 overflow-hidden">
            <GenerationProgress progress={latestJob.progress} step={latestJob.step} title={article.title} />
            {actionError && (
              <div className="p-8 bg-red-50 border-t border-red-100 text-red-700">
                <p className="font-black mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> 生成エラー</p>
                <p className="text-xs font-bold opacity-80 mb-4">{actionError}</p>
                <Button variant="secondary" onClick={advanceOnce} className="bg-white text-red-600 border-red-200">再試行</Button>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        {!isGenerating && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            {[
              { label: 'Score', val: score.score, icon: BarChart3, color: score.score >= 70 ? 'text-emerald-500' : 'text-amber-500' },
              { label: 'Characters', val: score.charCount.toLocaleString(), sub: `/ ${charProgress}%`, icon: FileText, color: 'text-blue-500' },
              { label: 'Headings', val: score.headingCount, icon: Layers, color: 'text-purple-500' },
              { label: 'Assets', val: article.images?.length || 0, icon: ImageIcon, color: 'text-orange-500' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <p className={`text-3xl font-black ${s.color}`}>{s.val}</p>
                    {s.sub && <span className="text-[10px] font-bold text-gray-300">{s.sub}</span>}
                  </div>
                  <s.icon className={`w-6 h-6 ${s.color} opacity-20`} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="sticky top-[4.5rem] z-30 mb-8 pb-2 bg-[#F8FAFC]/80 backdrop-blur-md">
          <div className="flex gap-1 p-1.5 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all whitespace-nowrap ${
                  tab === t.id ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {tab === 'preview' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden min-h-[600px]">
                <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Eye className="w-5 h-5 text-blue-500" /> 記事プレビュー
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(markdown)} className="bg-white border border-gray-100 font-black">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="p-8 lg:p-12">
                  {markdown ? <MarkdownPreview markdown={markdown} /> : (
                    <div className="py-32 text-center text-gray-300 font-black">本文が生成されるまでお待ちください...</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-8">
                <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8">
                  <h2 className="text-xl font-black text-gray-900 mb-8 flex items-center gap-3">
                    <ImageIcon className="w-6 h-6 text-orange-500" /> 生成されたクリエイティブ
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-6">
                    {article.images?.map((img) => (
                      <div key={img.id} className="group bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-500">
                        <div className="aspect-video relative overflow-hidden bg-gray-50">
                          <img src={`/api/seo/images/${img.id}`} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700" alt={img.title || ''} />
                          <div className="absolute top-4 left-4 flex gap-2">
                            <Badge tone={img.kind === 'BANNER' ? 'orange' : 'blue'}>{img.kind}</Badge>
                          </div>
                          <div className="absolute inset-0 bg-gray-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button onClick={() => copyToClipboard(`![${img.title || 'image'}](/api/seo/images/${img.id})`)} className="p-3 bg-white rounded-full text-gray-900 hover:scale-110 transition-transform"><Copy className="w-5 h-5" /></button>
                          </div>
                        </div>
                        <div className="p-5">
                          <p className="font-black text-gray-900 truncate">{img.title || '無題の画像'}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase mt-1">{new Date(img.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    {!article.images?.length && (
                      <div className="sm:col-span-2 py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 font-black text-gray-300">
                        画像は記事完成後に自動生成されます
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {tab === 'edit' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden p-8 space-y-6">
                <textarea
                  className="w-full min-h-[600px] p-8 rounded-[32px] border-2 border-gray-50 bg-gray-50/30 text-gray-900 font-mono text-sm focus:outline-none focus:border-blue-500 transition-all shadow-inner"
                  value={markdownDraft}
                  onChange={(e) => setMarkdownDraft(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <Button variant="ghost" onClick={() => setMarkdownDraft(article.finalMarkdown || '')} className="font-black">Discard</Button>
                  <Button variant="primary" onClick={() => act('save', async () => {
                    await fetch(`/api/seo/articles/${id}/content`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ finalMarkdown: markdownDraft, normalize: true }),
                    })
                  })} className="bg-gray-900 text-white px-10 h-14 rounded-2xl font-black shadow-xl">保存する</Button>
                </div>
              </div>
            )}

            {tab === 'export' && (
              <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl p-8">
                <h2 className="text-xl font-black text-gray-900 mb-8">ダウンロード</h2>
                <div className="grid sm:grid-cols-2 gap-6">
                  <a href={`/api/seo/articles/${id}/export/markdown`} className="p-8 rounded-[40px] border-2 border-gray-50 hover:border-blue-500 bg-gray-50/30 hover:bg-white transition-all group">
                    <FileText className="w-12 h-12 text-gray-300 group-hover:text-blue-500 mb-4" />
                    <h4 className="text-lg font-black text-gray-900">Markdown (.md)</h4>
                    <p className="text-xs text-gray-400 font-bold mt-2">GitHub, Notion, Qiita等に最適</p>
                  </a>
                  <a href={`/api/seo/articles/${id}/export/wp`} className="p-8 rounded-[40px] border-2 border-gray-50 hover:border-emerald-500 bg-gray-50/30 hover:bg-white transition-all group">
                    <Layout className="w-12 h-12 text-gray-300 group-hover:text-emerald-500 mb-4" />
                    <h4 className="text-lg font-black text-gray-900">WordPress</h4>
                    <p className="text-xs text-gray-400 font-bold mt-2">ブロックエディタ用HTML形式</p>
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Article Information</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2"><Target className="w-3 h-3" /> Target Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {((article.keywords as string[]) || []).map((k, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black border border-blue-100">{k}</span>
                    ))}
                  </div>
                </div>
                {article.requestText && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Request Memo</p>
                    <div className="p-4 rounded-2xl bg-gray-50 text-[11px] font-bold text-gray-500 border border-gray-100 leading-relaxed line-clamp-6">{article.requestText}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Work Memo</h3>
              <textarea
                className="w-full min-h-32 p-5 rounded-2xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner mb-4"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="AIへの指示や修正ポイントをメモ..."
              />
              <Button variant="primary" onClick={() => act('memo', async () => {
                await fetch(`/api/seo/articles/${id}/memo`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ content: memo }),
                })
              })} className="w-full h-12 bg-gray-900 text-white rounded-2xl font-black text-xs">Save Memo</Button>
            </div>

            <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-lg">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Quick Actions</h3>
              <div className="grid gap-3">
                <button onClick={() => setTab('audit')} className="w-full p-4 rounded-2xl bg-emerald-50 text-emerald-700 font-black text-xs flex items-center justify-between hover:bg-emerald-100 transition-all">Quality Audit <CheckCircle className="w-4 h-4" /></button>
                <button onClick={() => setTab('media')} className="w-full p-4 rounded-2xl bg-orange-50 text-orange-700 font-black text-xs flex items-center justify-between hover:bg-orange-100 transition-all">Assets Gen <ImageIcon className="w-4 h-4" /></button>
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
    <ClientErrorBoundary title="エラーが発生しました">
      <SeoArticleInner />
    </ClientErrorBoundary>
  )
}
