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
  { id: 'chat', label: 'AI修正チャット', icon: MessageCircle, color: 'text-indigo-500' },
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

  const [entitlements, setEntitlements] = useState<null | { canUseChatEdit: boolean; plan: string; isLoggedIn: boolean }>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [headings, setHeadings] = useState<string[]>([])
  const [targetHeading, setTargetHeading] = useState<string>('')

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

  // Chat権限はタブを開いた時だけ取得（/api/auth/session 連打を避ける）
  useEffect(() => {
    if (tab !== 'chat') return
    if (entitlements) return
    ;(async () => {
      try {
        const res = await fetch('/api/seo/entitlements', { cache: 'no-store' })
        const json = await res.json()
        if (json?.success) setEntitlements(json)
      } catch {
        setEntitlements({ canUseChatEdit: false, plan: 'UNKNOWN', isLoggedIn: false })
      }
    })()
  }, [tab, entitlements])

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
          <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Loading Content...</p>
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
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-sm text-gray-400 font-bold">
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
              { label: 'Score', val: score.score, icon: BarChart3, color: score.score >= 70 ? 'text-emerald-500' : 'text-amber-500' },
              { label: 'Characters', val: score.charCount.toLocaleString(), sub: `/ ${charProgress}%`, icon: FileText, color: 'text-blue-500' },
              { label: 'Headings', val: score.headingCount, icon: Layers, color: 'text-purple-500' },
              { label: 'Assets', val: article.images?.length || 0, icon: ImageIcon, color: 'text-orange-500' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-[32px] border border-gray-100 shadow-sm">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{s.label}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-1">
                    <p className={`text-xl sm:text-3xl font-black ${s.color}`}>{s.val}</p>
                    {s.sub && <span className="text-[9px] sm:text-[10px] font-bold text-gray-300">{s.sub}</span>}
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
                  tab === t.id ? 'bg-[#2563EB] text-white shadow-lg shadow-blue-500/30' : 'text-gray-400 hover:bg-gray-50'
                }`}
              >
                <t.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-2">
            {tab === 'preview' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl overflow-hidden min-h-[400px] sm:min-h-[600px]">
                <div className="p-6 sm:p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Eye className="w-5 h-5 text-blue-500" /> 記事プレビュー
                  </h2>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(markdown)} className="bg-white border border-gray-100 font-black h-9 sm:h-10 px-3 sm:px-4">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="p-6 sm:p-8 lg:p-12">
                  {markdown ? <MarkdownPreview markdown={markdown} /> : (
                    <div className="py-20 sm:py-32 text-center text-gray-300 font-black text-sm sm:text-base">本文が生成されるまでお待ちください...</div>
                  )}
                </div>
              </div>
            )}

            {tab === 'media' && (
              <div className="space-y-6 sm:space-y-8">
                <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl p-6 sm:p-8">
                  <h2 className="text-lg sm:text-xl font-black text-gray-900 mb-6 sm:mb-8 flex items-center gap-3">
                    <ImageIcon className="w-6 h-6 text-orange-500" /> 生成されたクリエイティブ
                  </h2>
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
                        画像は記事完成後に自動生成されます
                      </div>
                    )}
                  </div>
                </div>
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
                  <Button variant="ghost" onClick={() => setMarkdownDraft(article.finalMarkdown || '')} className="font-black text-sm">Discard</Button>
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

            {tab === 'chat' && (
              <div className="bg-white rounded-2xl sm:rounded-[40px] border border-gray-100 shadow-xl overflow-hidden p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-indigo-500" />
                      AI修正チャット（完成記事）
                    </h2>
                    <p className="text-xs text-gray-400 font-bold mt-1">
                      有料プラン限定。修正案を確認して「適用して保存」できます。
                    </p>
                  </div>
                </div>

                {article.status !== 'DONE' ? (
                  <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100 text-amber-800">
                    <p className="font-black text-sm">記事が完成してから利用できます</p>
                    <p className="text-xs font-bold mt-1 opacity-80">生成中の間は「編集」タブをご利用ください。</p>
                  </div>
                ) : !entitlements ? (
                  <div className="py-16 text-center">
                    <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Loading...</p>
                  </div>
                ) : !entitlements.canUseChatEdit ? (
                  <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-sm font-black text-gray-900">この機能は有料プラン限定です</p>
                    <p className="text-xs font-bold text-gray-500 mt-2">
                      プラン：{entitlements.plan || 'FREE'} ／ ログイン：{entitlements.isLoggedIn ? '済' : '未'}
                    </p>
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <Link href="/pricing" className="flex-1">
                        <button className="w-full h-11 rounded-xl bg-[#2563EB] text-white text-xs font-black shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-colors">
                          プランを見る
                        </button>
                      </Link>
                      <button
                        onClick={() => setEntitlements(null)}
                        className="flex-1 h-11 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-black hover:bg-gray-100 transition-colors"
                      >
                        再読み込み
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatError && (
                      <div className="mb-4 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700">
                        <p className="font-black text-xs">エラー</p>
                        <p className="text-xs font-bold mt-1 opacity-80">{chatError}</p>
                      </div>
                    )}

                    {headings.length > 0 && (
                      <div className="mb-4 p-4 rounded-2xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-black text-blue-800 mb-2">長文記事のため「修正したい見出し」を選択してください</p>
                        <select
                          value={targetHeading}
                          onChange={(e) => setTargetHeading(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white border border-blue-100 text-sm font-bold text-gray-900 focus:outline-none focus:border-blue-500"
                        >
                          <option value="">見出しを選択…</option>
                          {headings.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="rounded-2xl border border-gray-100 bg-gray-50/30 p-4 sm:p-6 min-h-[320px] max-h-[520px] overflow-y-auto space-y-3">
                      {chatMessages.length === 0 ? (
                        <div className="text-center py-10">
                          <p className="text-sm font-black text-gray-500">例）「結論を先に、箇条書きを増やして読みやすくして」</p>
                          <p className="text-xs font-bold text-gray-400 mt-2">修正内容を送ると、AIが修正案を作ります。</p>
                        </div>
                      ) : (
                        chatMessages.map((m, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-2xl ${
                              m.role === 'user' ? 'bg-white border border-gray-100' : 'bg-indigo-50 border border-indigo-100'
                            }`}
                          >
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                              {m.role === 'user' ? 'YOU' : 'AI'}
                            </p>
                            <p className="text-sm font-bold text-gray-800 whitespace-pre-wrap">{m.content}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="修正したい内容を入力…"
                        className="flex-1 min-h-[90px] p-4 rounded-2xl border border-gray-100 bg-white text-sm font-bold text-gray-900 focus:outline-none focus:border-indigo-500"
                      />
                      <div className="flex flex-col gap-2 sm:w-44">
                        <button
                          disabled={chatBusy || !chatInput.trim()}
                          onClick={async () => {
                            const msg = chatInput.trim()
                            if (!msg) return
                            setChatBusy(true)
                            setChatError(null)
                            setChatMessages((prev) => [...prev, { role: 'user', content: msg }])
                            setChatInput('')
                            try {
                              const res = await fetch(`/api/seo/articles/${id}/chat-edit`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  message: msg,
                                  ...(targetHeading ? { targetHeading } : {}),
                                }),
                              })
                              const json = await res.json().catch(() => ({}))

                              // 長文のため見出し指定が必要
                              if (json?.code === 'NEED_TARGET' && Array.isArray(json?.headings)) {
                                setHeadings(json.headings)
                                setChatMessages((prev) => [
                                  ...prev,
                                  { role: 'assistant', content: '記事が長いので、修正したい見出しを選んでからもう一度送ってください。' },
                                ])
                                return
                              }

                              if (!res.ok || json?.success === false) {
                                if (json?.code === 'PAID_ONLY') {
                                  setChatError('この機能は有料プラン限定です。')
                                } else {
                                  setChatError(json?.error || `API Error: ${res.status}`)
                                }
                                setChatMessages((prev) => [...prev, { role: 'assistant', content: 'すみません、修正案の生成に失敗しました。' }])
                                return
                              }

                              const summary = String(json?.summary || '').trim()
                              const proposedMarkdown = String(json?.proposedMarkdown || '')
                              setChatMessages((prev) => [
                                ...prev,
                                { role: 'assistant', content: summary ? `修正案を作成しました。\n- 要点: ${summary}` : '修正案を作成しました。' },
                              ])

                              // すぐ適用できるよう draft に入れる
                              if (proposedMarkdown) {
                                setMarkdownDraft(proposedMarkdown)
                                setMessage('修正案を「編集」タブの本文に反映しました。必要なら「保存する」で確定できます。')
                                setTimeout(() => setMessage(null), 3500)
                              }
                            } catch (e: any) {
                              setChatError(e?.message || '不明なエラー')
                              setChatMessages((prev) => [...prev, { role: 'assistant', content: '通信エラーが発生しました。時間を置いて再試行してください。' }])
                            } finally {
                              setChatBusy(false)
                            }
                          }}
                          className="h-11 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                          {chatBusy ? '生成中…' : '修正案を作る'}
                        </button>

                        <button
                          disabled={chatBusy || !markdownDraft.trim()}
                          onClick={() =>
                            act('save', async () => {
                              await fetch(`/api/seo/articles/${id}/content`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ finalMarkdown: markdownDraft, normalize: true, updateOutline: true }),
                              })
                            })
                          }
                          className="h-11 rounded-xl bg-white border border-gray-200 text-gray-700 text-xs font-black hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          適用して保存
                        </button>
                      </div>
                    </div>
                  </>
                )}
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

          {/* Sidebar */}
          <div className="space-y-6 sm:space-y-8">
            <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-lg">
              <h3 className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Article Information</h3>
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2"><Target className="w-3 h-3" /> Target Keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {((article.keywords as string[]) || []).map((k, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] sm:text-[10px] font-black border border-blue-100">{k}</span>
                    ))}
                  </div>
                </div>
                {article.requestText && (
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-2"><MessageSquare className="w-3 h-3" /> Request Memo</p>
                    <div className="p-4 rounded-xl sm:rounded-2xl bg-gray-50 text-[10px] sm:text-[11px] font-bold text-gray-500 border border-gray-100 leading-relaxed line-clamp-6">{article.requestText}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-lg">
              <h3 className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Work Memo</h3>
              <textarea
                className="w-full min-h-32 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-gray-50 border border-gray-100 text-[11px] sm:text-xs font-bold text-gray-600 focus:outline-none focus:border-blue-500 focus:bg-white transition-all shadow-inner mb-4"
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
              })} className="w-full h-11 sm:h-12 bg-gray-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs shadow-lg">Save Memo</Button>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-[32px] border border-gray-100 p-6 sm:p-8 shadow-lg">
              <h3 className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Quick Actions</h3>
              <div className="grid gap-3">
                <button onClick={() => setTab('audit')} className="w-full p-4 rounded-xl sm:rounded-2xl bg-emerald-50 text-emerald-700 font-black text-[10px] sm:text-xs flex items-center justify-between hover:bg-emerald-100 transition-all border border-emerald-100/50">Quality Audit <CheckCircle className="w-4 h-4" /></button>
                <button onClick={() => setTab('media')} className="w-full p-4 rounded-xl sm:rounded-2xl bg-orange-50 text-orange-700 font-black text-[10px] sm:text-xs flex items-center justify-between hover:bg-orange-100 transition-all border border-orange-100/50">Assets Gen <ImageIcon className="w-4 h-4" /></button>
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
