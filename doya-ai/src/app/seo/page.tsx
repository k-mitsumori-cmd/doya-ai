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
  Play,
} from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
import { FeatureGuide } from '@/components/FeatureGuide'

type SeoArticleRow = {
  id: string
  title: string
  status: string
  targetChars: number
  createdAt: string
  jobs?: { id: string; status: string; progress: number; step: string }[]
}

const STATUS_CONFIG = {
  DRAFT: { label: '下書き', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  RUNNING: { label: '生成中', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  DONE: { label: '完成', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ERROR: { label: 'エラー', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
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
    return { total, running, done, draft, errorCount }
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
      {/* Feature Guide */}
      <div className="mb-6 flex justify-end">
        <FeatureGuide 
          featureId="seo-overview"
          title="ドヤ記事作成"
          description="SEOとLLMO（AI検索エンジン最適化）に特化した、圧倒的な情報量の記事を自動生成するツールです。分割生成パイプラインにより、5万字を超える長文でも構造を崩さず高品質に出力します。"
          steps={[
            "「新規作成」ボタンから記事のタイトルとキーワードを入力します。",
            "AIがターゲット（ペルソナ）と検索意図を自動で推定します。",
            "アウトライン（構成案）を生成し、内容を確認・調整します。",
            "各章を個別に詳細生成し、最後に一つの完璧な記事に統合します。",
            "完成した記事を監査（オーディット）し、弱点を自動修正して公開準備完了です。"
          ]}
        />
      </div>

      {/* Hero Header - よりシンプルに */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-gray-200 p-8 mb-8 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-50" />
        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              ダッシュボード
            </h1>
            <p className="text-gray-500 mt-1">
              現在のプロジェクトの状況をひと目で確認できます。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={load} className="text-gray-500 hover:text-gray-900 hover:bg-gray-100">
              <RefreshCcw className="w-4 h-4" />
            </Button>
            <Link href="/seo/new">
              <Button variant="primary" className="bg-[#2563EB] text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                <Plus className="w-4 h-4" />
                新規作成
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Stats - 画像のようなデザインに */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">全記事数</p>
            <p className="text-2xl font-bold text-gray-900">{counts.total.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">現在進行中の記事数</p>
            <p className="text-2xl font-bold text-gray-900">{counts.running.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">完成記事数</p>
            <p className="text-2xl font-bold text-gray-900">{counts.done.toLocaleString()}</p>
          </div>
        </div>
      </div>


      {/* Running Articles (if any) */}
      {runningArticles.length > 0 && (
        <div className="mb-8 p-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <p className="text-sm font-bold text-amber-700">生成中の記事</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {runningArticles.map((a) => {
              const j = a.jobs?.[0]
              return (
                <Link key={a.id} href={`/seo/articles/${a.id}?auto=1`}>
                  <div className="p-4 rounded-xl bg-white border border-amber-200 hover:border-amber-300 hover:shadow-md transition-all">
                    <p className="font-medium text-gray-900 truncate">{a.title}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <ProgressBar value={j?.progress || 0} className="flex-1" />
                      <span className="text-xs text-amber-600 font-bold">{j?.progress || 0}%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">ステップ: {j?.step || '準備中'}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Notice Banner */}
      <div className="mb-6 p-4 rounded-2xl border border-blue-200 bg-blue-50">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-bold text-blue-800">ご注意</p>
            <ul className="text-sm text-blue-700 mt-1 space-y-0.5">
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
                  className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm w-48 focus:outline-none focus:border-blue-500"
                  placeholder="タイトル検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:border-blue-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="date">新しい順</option>
                <option value="title">タイトル順</option>
                <option value="status">ステータス順</option>
              </select>
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {error ? (
            <div className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-sm">
              <p className="font-bold">読み込みエラー</p>
              <p className="mt-1 whitespace-pre-wrap">{error}</p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 border border-gray-200 rounded-2xl text-center bg-gray-50">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="font-bold text-gray-700 text-lg">該当する記事がありません</p>
              <p className="text-sm text-gray-500 mt-2">「新規作成」から始めましょう。</p>
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
                    className="group relative h-full p-5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all bg-white"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center`}>
                        <StatusIcon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <Badge tone={a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : a.status === 'RUNNING' ? 'amber' : 'blue'}>
                        {config.label}
                      </Badge>
                    </div>

                    <Link href={`/seo/articles/${a.id}`} className="block">
                      <p className="font-bold text-gray-900 line-clamp-2 hover:text-blue-600 transition-colors">
                        {a.title}
                      </p>
                    </Link>

                    <p className="text-xs text-gray-500 mt-2">
                      {a.targetChars.toLocaleString('ja-JP')}字
                    </p>

                    {j && a.status === 'RUNNING' ? (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{j.step}</span>
                          <span className="font-bold text-amber-600">{j.progress}%</span>
                        </div>
                        <ProgressBar value={j.progress} />
                      </div>
                    ) : null}

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                      <p className="text-xs text-gray-400">
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
                          <Button variant="ghost" size="sm">
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
            <div className="divide-y divide-gray-100">
              {filtered.map((a) => {
                const j = a.jobs?.[0]
                const config = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT
                const StatusIcon = config.icon
                return (
                  <div key={a.id} className="py-4 flex items-center gap-4 hover:bg-gray-50 -mx-4 px-4 transition-colors rounded-lg">
                    <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <StatusIcon className={`w-5 h-5 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/seo/articles/${a.id}`}>
                        <p className="font-medium text-gray-900 truncate hover:text-blue-600 transition-colors">
                          {a.title}
                        </p>
                      </Link>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-500">{a.targetChars.toLocaleString('ja-JP')}字</span>
                        <span className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                    {j && a.status === 'RUNNING' ? (
                      <div className="w-32">
                        <ProgressBar value={j.progress} />
                        <p className="text-xs text-amber-600 font-bold mt-1 text-center">{j.progress}%</p>
                      </div>
                    ) : null}
                    <Badge tone={a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : a.status === 'RUNNING' ? 'amber' : 'blue'}>
                      {config.label}
                    </Badge>
                    <Link href={`/seo/articles/${a.id}`}>
                      <Button variant="ghost" size="sm">
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
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-bold text-gray-900">クイック生成</h3>
          <p className="text-sm text-gray-500 mt-1">
            タイトルとキーワードを入力するだけで、ペルソナ・検索意図を自動推定します。
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-violet-600" />
          </div>
          <h3 className="font-bold text-gray-900">50,000字対応</h3>
          <p className="text-sm text-gray-500 mt-1">
            分割生成パイプラインで、長文記事でも構造が崩れにくい安定した出力。
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h3 className="font-bold text-gray-900">品質監査</h3>
          <p className="text-sm text-gray-500 mt-1">
            二重チェック機能で弱点を洗い出し、自動修正で品質を向上させます。
          </p>
        </div>
      </div>
    </main>
  )
}
