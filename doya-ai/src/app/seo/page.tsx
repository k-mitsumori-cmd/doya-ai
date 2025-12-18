'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FileText, RefreshCcw, Search, ExternalLink, Plus } from 'lucide-react'
import { Button } from '@seo/components/ui/Button'
import { Card, CardBody, CardHeader, CardTitle, CardDesc } from '@seo/components/ui/Card'
import { Badge } from '@seo/components/ui/Badge'
import { ProgressBar } from '@seo/components/ui/ProgressBar'
import { StatCard } from '@seo/components/ui/StatCard'

type SeoArticleRow = {
  id: string
  title: string
  status: string
  targetChars: number
  createdAt: string
  jobs?: { id: string; status: string; progress: number; step: string }[]
}

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
    return articles
      .filter((a) => (statusFilter === 'ALL' ? true : a.status === statusFilter))
      .filter((a) => (!q ? true : a.title.toLowerCase().includes(q)))
  }, [articles, query, statusFilter])

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">ドヤ記事作成（SEO Studio）</h1>
          <p className="text-gray-600 mt-1">
            5万字〜6万字でも崩れにくい「アウトライン→分割生成→統合」パイプライン
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" onClick={load}>
            <RefreshCcw className="w-4 h-4" />
          </Button>
          <Link href="/seo/new">
            <Button variant="primary">
              <Plus className="w-4 h-4" />
              新規作成
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
        <p className="font-bold">注意</p>
        <ul className="text-sm mt-1 space-y-1">
          <li>・参考URLの文章を丸写ししません（要点化・言い換え・独自化）。</li>
          <li>・生成結果は必ず「ユーザー最終確認」を前提にしています。</li>
        </ul>
      </div>

      <div className="mt-6 grid md:grid-cols-5 gap-3">
        <StatCard label="Total" value={counts.total} tone="gray" />
        <StatCard label="Draft" value={counts.draft} tone="blue" />
        <StatCard label="Running" value={counts.running} tone="amber" />
        <StatCard label="Done" value={counts.done} tone="green" />
        <StatCard label="Error" value={counts.errorCount} tone="red" />
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>記事一覧</CardTitle>
                <CardDesc>検索・フィルタして、制作中の記事にすぐ戻れます。</CardDesc>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm"
                    placeholder="タイトル検索"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  className="px-3 py-2 rounded-xl border border-gray-200 text-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="ALL">すべて</option>
                  <option value="DRAFT">下書き</option>
                  <option value="RUNNING">生成中</option>
                  <option value="DONE">完成</option>
                  <option value="ERROR">エラー</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {error ? (
              <div className="mb-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800 text-sm">
                <p className="font-bold">読み込みエラー</p>
                <p className="mt-1 whitespace-pre-wrap">{error}</p>
              </div>
            ) : null}

            {loading ? (
              <div className="text-gray-500">読み込み中...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 border border-gray-200 rounded-2xl text-center text-gray-600">
                <FileText className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                <p className="font-bold">該当する記事がありません</p>
                <p className="text-sm mt-1">「新規作成」から始めましょう。</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((a) => {
                  const j = a.jobs?.[0]
                  const tone =
                    a.status === 'DONE' ? 'green' : a.status === 'ERROR' ? 'red' : a.status === 'RUNNING' ? 'amber' : 'blue'
                  return (
                    <div key={a.id} className="h-full p-5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all bg-white">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/seo/articles/${a.id}`} className="block">
                            <p className="font-bold text-gray-900 line-clamp-2 hover:underline">{a.title}</p>
                          </Link>
                          <div className="mt-2 flex flex-wrap gap-2 items-center">
                            <Badge tone={tone as any}>{a.status}</Badge>
                            <Badge tone="gray">目標 {a.targetChars.toLocaleString('ja-JP')}</Badge>
                          </div>
                        </div>
                        <Link href={`/seo/articles/${a.id}`} className="text-gray-400 hover:text-gray-700">
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>

                      {j ? (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-xs text-gray-600">
                            <span className="font-bold">job: {j.status}</span>
                            <span>{j.progress}%</span>
                          </div>
                          <ProgressBar value={j.progress} className="mt-2" />
                          <div className="mt-3 flex gap-2">
                            <Link href={`/seo/jobs/${j.id}`}>
                              <Button variant="secondary" size="sm">
                                <ExternalLink className="w-4 h-4" />
                                ジョブ
                              </Button>
                            </Link>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 text-xs text-gray-500">（ジョブ情報なし）</div>
                      )}

                      <p className="mt-4 text-xs text-gray-400">
                        作成: {new Date(a.createdAt).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  )
}


