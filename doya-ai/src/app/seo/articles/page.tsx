'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  FileText,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'

type SeoArticleRow = {
  id: string
  title: string
  keywords?: string[]
  status: string
  targetChars: number
  createdAt: string
  updatedAt: string
  jobs?: { id: string; status: string; progress: number; step: string }[]
}

const STATUS_CONFIG = {
  DRAFT: { label: '構成済み', tone: 'blue' as const },
  RUNNING: { label: '生成中', tone: 'amber' as const },
  EDITING: { label: '編集中', tone: 'purple' as const },
  DONE: { label: '完成', tone: 'green' as const },
  EXPORTED: { label: '出力済', tone: 'green' as const },
  ERROR: { label: 'エラー', tone: 'red' as const },
} as const

// ジョブステップ名を日本語に変換（一覧のサブ情報用）
const STEP_LABELS: Record<string, string> = {
  init: '準備中',
  outline: '構成生成',
  sections: '本文執筆',
  integrate: '記事統合',
  media: '図解生成',
  done: '完成',
  OUTLINE: '構成生成',
  SECTIONS: '本文執筆',
  INTEGRATE: '記事統合',
  MEDIA: '図解生成',
  DONE: '完成',
  cmp_ref: '参考記事解析',
  cmp_candidates: '候補収集',
  cmp_crawl: 'サイト巡回',
  cmp_extract: '情報抽出',
  cmp_sources: '出典整形',
  cmp_tables: '比較表生成',
  cmp_outline: '章立て生成',
  cmp_polish: '校正中',
}

function formatDate(s: string) {
  const d = new Date(s)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function getResumeLink(a: SeoArticleRow): string {
  if (a.status === 'RUNNING') return `/seo/jobs/${a.jobs?.[0]?.id || a.id}?auto=1`
  if (a.status === 'DRAFT') return `/seo/articles/${a.id}/outline`
  if (a.status === 'EDITING') return `/seo/articles/${a.id}/edit`
  if (a.status === 'DONE') return `/seo/articles/${a.id}`
  if (a.status === 'EXPORTED') return `/seo/articles/${a.id}/export`
  return `/seo/articles/${a.id}`
}

export default function SeoArticlesIndexPage() {
  const [articles, setArticles] = useState<SeoArticleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DONE' | 'RUNNING' | 'DRAFT'>('DONE')
  const isLoadingRef = useRef(false)

  async function load(opts?: { showLoading?: boolean }) {
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    if (opts?.showLoading) {
      setLoading(true)
      setError(null)
    }
    try {
      const res = await fetch('/api/seo/articles', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.success === false) throw new Error(json.error || `API Error: ${res.status}`)
      setArticles(json.articles || [])
    } catch (e: any) {
      setError(e?.message || '読み込みに失敗しました')
    } finally {
      if (opts?.showLoading) setLoading(false)
      isLoadingRef.current = false
    }
  }

  useEffect(() => {
    load({ showLoading: true })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return articles
      .filter((a) => {
        if (statusFilter === 'ALL') return true
        if (statusFilter === 'DONE') return a.status === 'DONE' || a.status === 'EXPORTED'
        return a.status === statusFilter
      })
      .filter((a) => {
        if (!q) return true
        return (
          a.title.toLowerCase().includes(q) ||
          (a.keywords || []).some((k) => k.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
  }, [articles, query, statusFilter])

  const counts = useMemo(() => {
    const total = articles.length
    const running = articles.filter((a) => a.status === 'RUNNING').length
    const done = articles.filter((a) => a.status === 'DONE' || a.status === 'EXPORTED').length
    const draft = articles.filter((a) => a.status === 'DRAFT').length
    return { total, running, done, draft }
  }, [articles])

  return (
    <main className="max-w-6xl mx-auto py-6 sm:py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">記事一覧</h1>
          <p className="text-sm font-bold text-gray-500 mt-1">
            完成記事にすぐ辿り着けるように整理しました（検索・絞り込み対応）。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/seo">
            <Button variant="ghost" size="sm">ダッシュボード</Button>
          </Link>
          <Link href="/seo/create">
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              新規作成
            </Button>
          </Link>
        </div>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">合計</p>
            <p className="text-2xl font-black text-gray-900">{counts.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Clock className="w-6 h-6 text-orange-600 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">生成中</p>
            <p className="text-2xl font-black text-gray-900">{counts.running}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">完成</p>
            <p className="text-2xl font-black text-gray-900">{counts.done}</p>
          </div>
        </div>
      </div>

      {/* 検索・絞り込み */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトル / キーワードで検索"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-100 font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            {(
              [
                { id: 'DONE', label: `完成（${counts.done}）` },
                { id: 'RUNNING', label: `生成中（${counts.running}）` },
                { id: 'DRAFT', label: `構成済み（${counts.draft}）` },
                { id: 'ALL', label: `すべて（${counts.total}）` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setStatusFilter(t.id)}
                className={`px-3 py-2 rounded-xl text-xs font-black border transition-colors ${
                  statusFilter === t.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => load({ showLoading: true })}>
              更新
            </Button>
          </div>
        </div>
      </div>

      {/* エラー */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-bold flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 mt-0.5" />
            <div>
              <p>読み込みに失敗しました</p>
              <p className="text-xs font-semibold text-red-600/80 mt-1">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 一覧 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
              <div className="h-5 w-3/4 bg-gray-100 rounded mb-3" />
              <div className="h-3 w-1/2 bg-gray-100 rounded mb-5" />
              <div className="h-10 w-full bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center">
          <p className="text-lg font-black text-gray-900">記事が見つかりません</p>
          <p className="text-sm font-bold text-gray-500 mt-2">検索条件を変えるか、新規作成から始めましょう。</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="ghost" onClick={() => { setQuery(''); setStatusFilter('DONE') }}>条件をリセット</Button>
            <Link href="/seo/create"><Button className="gap-2"><Plus className="w-4 h-4" /> 新規作成</Button></Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => {
            const s = (STATUS_CONFIG as any)[a.status] || { label: a.status, tone: 'gray' as const }
            const job = a.jobs?.[0]
            const jobStepLabel = job?.step ? (STEP_LABELS[job.step] || job.step) : null
            const progress = typeof job?.progress === 'number' ? Math.max(0, Math.min(100, job.progress)) : null

            return (
              <div key={a.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 leading-tight line-clamp-2">{a.title}</p>
                      <p className="text-xs font-bold text-gray-500 mt-1">
                        更新: {formatDate(a.updatedAt || a.createdAt)} ・ 目標: {a.targetChars?.toLocaleString?.() || a.targetChars}字
                      </p>
                    </div>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>

                  {a.keywords?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {a.keywords.slice(0, 3).map((k) => (
                        <span key={k} className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-700">
                          {k}
                        </span>
                      ))}
                      {a.keywords.length > 3 && (
                        <span className="px-2.5 py-1 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-bold text-gray-500">
                          +{a.keywords.length - 3}
                        </span>
                      )}
                    </div>
                  ) : null}

                  {a.status === 'RUNNING' && progress !== null && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-black text-gray-500 mb-2">
                        <span>{jobStepLabel ? `${jobStepLabel}` : '生成中'}</span>
                        <span>{progress}%</span>
                      </div>
                      <ProgressBar value={progress} />
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50/40">
                  <Link href={getResumeLink(a)}>
                    <Button className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md hover:shadow-lg transition-all">
                      {a.status === 'RUNNING' ? (
                        <>
                          <Play className="w-4 h-4" />
                          生成状況を見る
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          開く
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}


