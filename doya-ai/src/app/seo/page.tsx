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
  ImageIcon,
} from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
import { DashboardLayout } from '@/components/DashboardLayout'
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
  RUNNING: { label: '生成中', icon: Clock, color: 'text-orange-600', bg: 'bg-orange-100' },
  DONE: { label: '完成', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ERROR: { label: 'エラー', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
} as const

export default function SeoDashboardPage() {
  const [articles, setArticles] = useState<SeoArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'RUNNING' | 'DONE' | 'ERROR'>('ALL')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/seo/articles', { cache: 'no-store' })
      const json = await res.json()
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
    return articles
      .filter((a) => (statusFilter === 'ALL' ? true : a.status === statusFilter))
      .filter((a) => (!q ? true : a.title.toLowerCase().includes(q)))
  }, [articles, query, statusFilter])

  return (
    <DashboardLayout>
      <main className="max-w-7xl mx-auto py-8">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 mb-10 flex-wrap">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">記事作成ダッシュボード</h1>
            <p className="text-gray-500 mt-1">SEO・LLMOに最適化された高品質記事の管理</p>
          </div>
          <div className="flex items-center gap-3">
            <FeatureGuide 
              featureId="seo-dashboard-overview"
              title="記事作成の流れ"
              description="記事の企画から執筆、そして画像生成までをAIがワンストップでサポートします。"
              steps={[
                "「新規作成」でタイトルとキーワードを入力",
                "生成が始まると、アウトライン・本文・図解が順次作成されます",
                "完成した記事はプレビューで確認し、必要なら調整して公開へ"
              ]}
            />
            <Link href="/seo/new">
              <Button variant="primary" className="bg-[#2563EB] text-white px-8 h-12 rounded-2xl shadow-xl shadow-blue-500/20 font-black">
                <Plus className="w-5 h-5 mr-2" />
                新規記事を作成
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards - Image Like Design */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Articles</p>
              <p className="text-3xl font-black text-gray-900">{counts.total.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-orange-50 flex items-center justify-center text-orange-600 shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">In Progress</p>
              <p className="text-3xl font-black text-gray-900">{counts.running.toLocaleString()}</p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Completed</p>
              <p className="text-3xl font-black text-gray-900">{counts.done.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Filters and List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-2">
              {(['ALL', 'RUNNING', 'DONE', 'DRAFT'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`px-5 py-2 rounded-full text-xs font-black transition-all ${
                    statusFilter === f 
                      ? 'bg-gray-900 text-white shadow-lg' 
                      : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'
                  }`}
                >
                  {f === 'ALL' ? 'すべて' : STATUS_CONFIG[f as keyof typeof STATUS_CONFIG].label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-100 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
                placeholder="タイトルで検索..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400 font-black text-xs uppercase tracking-widest">Loading Projects...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-24 bg-white rounded-[40px] border border-gray-100 border-dashed text-center">
                <FileText className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                <p className="text-gray-400 font-black">記事が見つかりませんでした</p>
                <Link href="/seo/new" className="mt-6 inline-block">
                  <Button variant="ghost" className="text-blue-600 font-black">新しく作成する</Button>
                </Link>
              </div>
            ) : (
              filtered.map((a) => {
                const j = a.jobs?.[0]
                const config = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.DRAFT
                return (
                  <Link key={a.id} href={`/seo/articles/${a.id}${a.status === 'RUNNING' ? '?auto=1' : ''}`}>
                    <div className="group bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-xl hover:translate-y-[-2px] transition-all flex items-center gap-6">
                      <div className={`w-14 h-14 rounded-2xl ${config.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                        <config.icon className={`w-7 h-7 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-gray-900 text-lg truncate group-hover:text-blue-600 transition-colors">{a.title}</h3>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs font-bold text-gray-400">{a.targetChars.toLocaleString()}字</span>
                          <span className="text-xs font-bold text-gray-300">|</span>
                          <span className="text-xs font-bold text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {a.status === 'RUNNING' && j && (
                        <div className="w-48 hidden md:block">
                          <div className="flex justify-between text-[10px] font-black text-orange-600 mb-1 uppercase tracking-wider">
                            <span>{j.step}</span>
                            <span>{j.progress}%</span>
                          </div>
                          <ProgressBar value={j.progress} />
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Badge tone={a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : 'amber'}>
                          {config.label}
                        </Badge>
                        <ArrowRight className="w-5 h-5 text-gray-200 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}
