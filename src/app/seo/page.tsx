'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  FileText,
  RefreshCcw,
  Search,
  Plus,
  Zap,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  LayoutGrid,
  List,
  Copy,
  MoreHorizontal,
  Play,
  Trash2,
  Eye,
} from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'

type SeoArticleRow = {
  id: string
  title: string
  status: string
  targetChars: number
  createdAt: string
  jobs?: { id: string; status: string; progress: number; step: string }[]
}

const STATUS_CONFIG = {
  DRAFT: { label: '下書き', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  RUNNING: { label: '生成中', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  DONE: { label: '完成', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ERROR: { label: 'エラー', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
} as const

export default function SeoDashboardPage() {
  const [articles, setArticles] = useState<SeoArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'RUNNING' | 'DONE' | 'ERROR'>('ALL')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status'>('date')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo/articles', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `API Error: ${res.status}`)
      }
      setArticles(json.articles || [])
    } catch (e: any) {
      setArticles([])
      setError(e?.message || '読み込みに失敗しました')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const total = articles.length
    const running = articles.filter((a) => a.status === 'RUNNING').length
    const done = articles.filter((a) => a.status === 'DONE').length
    const draft = articles.filter((a) => a.status === 'DRAFT').length
    const errorCount = articles.filter((a) => a.status === 'ERROR').length
    const totalChars = articles.filter((a) => a.status === 'DONE').reduce((sum, a) => sum + a.targetChars, 0)
    return { total, running, done, draft, errorCount, totalChars }
  }, [articles])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = articles
      .filter((a) => (statusFilter === 'ALL' ? true : a.status === statusFilter))
      .filter((a) => (!q ? true : a.title.toLowerCase().includes(q)))

    if (sortBy === 'title') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortBy === 'status') {
      const order = { RUNNING: 0, DRAFT: 1, DONE: 2, ERROR: 3 }
      list = [...list].sort((a, b) => (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4))
    } else {
      list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return list
  }, [articles, query, statusFilter, sortBy])

  const runningArticles = useMemo(() => articles.filter((a) => a.status === 'RUNNING'), [articles])

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500/20 via-gray-900 to-gray-900 p-8 mb-8 border border-emerald-500/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-gray-900" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  ドヤ記事作成
                </h1>
              </div>
              <p className="text-white/70 mt-2 max-w-xl">
                5万字〜6万字でも崩れにくい「アウトライン→分割生成→統合」パイプライン。<br />
                日本最強レベルのSEO+LLMO記事を安定生成します。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={load} className="text-white/70 hover:text-white">
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Link href="/seo/new">
                <Button variant="primary" className="shadow-lg shadow-emerald-500/25">
                  <Plus className="w-4 h-4" />
                  新規作成
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-4 rounded-2xl border transition-all ${statusFilter === 'ALL' ? 'border-white/30 bg-white/5' : 'border-white/10 hover:border-white/20'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{counts.total}</p>
              <p className="text-xs text-white/50">全記事</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter('RUNNING')}
          className={`p-4 rounded-2xl border transition-all ${statusFilter === 'RUNNING' ? 'border-amber-500/50 bg-amber-500/10' : 'border-white/10 hover:border-amber-500/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{counts.running}</p>
              <p className="text-xs text-amber-400/70">生成中</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter('DONE')}
          className={`p-4 rounded-2xl border transition-all ${statusFilter === 'DONE' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/10 hover:border-emerald-500/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{counts.done}</p>
              <p className="text-xs text-emerald-400/70">完成</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter('DRAFT')}
          className={`p-4 rounded-2xl border transition-all ${statusFilter === 'DRAFT' ? 'border-blue-500/50 bg-blue-500/10' : 'border-white/10 hover:border-blue-500/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{counts.draft}</p>
              <p className="text-xs text-blue-400/70">下書き</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => setStatusFilter('ERROR')}
          className={`p-4 rounded-2xl border transition-all ${statusFilter === 'ERROR' ? 'border-red-500/50 bg-red-500/10' : 'border-white/10 hover:border-red-500/30'}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-left">
              <p className="text-2xl font-bold text-white">{counts.errorCount}</p>
              <p className="text-xs text-red-400/70">エラー</p>
            </div>
          </div>
        </button>
      </div>

      {/* Running Articles (if any) */}
      {runningArticles.length > 0 && (
        <div className="mb-8 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
            <p className="text-sm font-bold text-amber-400">生成中の記事</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {runningArticles.map((a) => {
              const j = a.jobs?.[0]
              return (
                <Link key={a.id} href={`/seo/articles/${a.id}?auto=1`}>
                  <div className="p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <p className="font-medium text-white truncate">{a.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={j?.progress || 0} className="flex-1" />
                      <span className="text-xs text-white/60">{j?.progress || 0}%</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Notice Banner */}
      <div className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="font-bold text-amber-300">ご注意</p>
            <ul className="text-sm text-amber-200/80 mt-1 space-y-0.5">
              <li>• 参考URLの文章を丸写ししません（要点化・言い換え・独自化）。</li>
              <li>• 生成結果は必ず「ユーザー最終確認」を前提にしています。</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Article List */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>記事一覧</CardTitle>
              <CardDesc>
                {filtered.length}件の記事
                {statusFilter !== 'ALL' && ` (${STATUS_CONFIG[statusFilter]?.label})`}
              </CardDesc>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  className="pl-9 pr-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 text-sm w-48"
                  placeholder="タイトル検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 rounded-xl border border-gray-700 bg-gray-800 text-white text-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="date">新しい順</option>
                <option value="title">タイトル順</option>
                <option value="status">ステータス順</option>
              </select>
              <div className="flex rounded-xl border border-gray-700 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500 hover:text-white'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {error ? (
            <div className="mb-4 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
              <p className="font-bold">読み込みエラー</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 border border-gray-700 rounded-2xl text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <p className="font-bold text-white text-lg">該当する記事がありません</p>
              <p className="text-sm text-gray-400 mt-2">「新規作成」から始めましょう。</p>
              <Link href="/seo/new" className="mt-4 inline-block">
                <Button variant="primary">
                  <Plus className="w-4 h-4" />
                  新規作成
                </Button>
              </Link>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((a) => {
                const j = a.jobs?.[0]
                const config = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT
                const StatusIcon = config.icon
                return (
                  <div
                    key={a.id}
                    className="group relative h-full p-5 rounded-2xl border border-gray-700 hover:border-gray-600 hover:bg-white/5 transition-all bg-gray-800/50"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center`}>
                        <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/seo/articles/${a.id}`}>
                          <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                            <Eye className="w-4 h-4" />
                          </button>
                        </Link>
                        <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <Link href={`/seo/articles/${a.id}`} className="block">
                      <p className="font-bold text-white line-clamp-2 hover:text-emerald-400 transition-colors">
                        {a.title}
                      </p>
                    </Link>

                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <Badge tone={a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : a.status === 'RUNNING' ? 'amber' : 'blue'}>
                        {config.label}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {a.targetChars.toLocaleString('ja-JP')}字
                      </span>
                    </div>

                    {j && a.status === 'RUNNING' ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          <span>{j.step}</span>
                          <span>{j.progress}%</span>
                        </div>
                        <ProgressBar value={j.progress} />
                      </div>
                    ) : null}

                    <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {new Date(a.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                      {a.status === 'RUNNING' && j ? (
                        <Link href={`/seo/articles/${a.id}?auto=1`}>
                          <Button variant="secondary" size="sm">
                            <Play className="w-3 h-3" />
                            続行
                          </Button>
                        </Link>
                      ) : (
                        <Link href={`/seo/articles/${a.id}`}>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                            <ArrowRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filtered.map((a) => {
                const j = a.jobs?.[0]
                const config = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT
                const StatusIcon = config.icon
                return (
                  <div key={a.id} className="py-4 flex items-center gap-4 hover:bg-white/5 -mx-4 px-4 transition-colors">
                    <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/seo/articles/${a.id}`}>
                        <p className="font-medium text-white truncate hover:text-emerald-400 transition-colors">
                          {a.title}
                        </p>
                      </Link>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{a.targetChars.toLocaleString('ja-JP')}字</span>
                        <span className="text-xs text-gray-500">{new Date(a.createdAt).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                    {j && a.status === 'RUNNING' ? (
                      <div className="w-32">
                        <ProgressBar value={j.progress} />
                        <p className="text-xs text-gray-500 mt-1 text-center">{j.progress}%</p>
                      </div>
                    ) : null}
                    <Badge tone={a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : a.status === 'RUNNING' ? 'amber' : 'blue'}>
                      {config.label}
                    </Badge>
                    <Link href={`/seo/articles/${a.id}`}>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Quick Tips */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <h3 className="font-bold text-white">クイック生成</h3>
          <p className="text-sm text-gray-400 mt-1">
            タイトルとキーワードを入力するだけで、ペルソナ・検索意図を自動推定します。
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="font-bold text-white">50,000字対応</h3>
          <p className="text-sm text-gray-400 mt-1">
            分割生成パイプラインで、長文記事でも構造が崩れにくい安定した出力。
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-700 bg-gray-800/50">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="font-bold text-white">品質監査</h3>
          <p className="text-sm text-gray-400 mt-1">
            二重チェック機能で弱点を洗い出し、自動修正で品質を向上させます。
          </p>
        </div>
      </div>
    </main>
  )
}
