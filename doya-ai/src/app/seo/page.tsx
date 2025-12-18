'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, FileText } from 'lucide-react'

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

  async function load() {
    setLoading(true)
    const res = await fetch('/api/seo/articles', { cache: 'no-store' })
    const json = await res.json()
    setArticles(json.articles || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">ドヤ記事作成</h1>
          <p className="text-gray-600 mt-1">
            5万字〜6万字でも崩れにくい「アウトライン→分割生成→統合」パイプライン
          </p>
        </div>
        <Link
          href="/seo/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
        >
          新規作成
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="mt-6 p-4 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900">
        <p className="font-bold">注意</p>
        <ul className="text-sm mt-1 space-y-1">
          <li>・参考URLの文章を丸写ししません（要点化・言い換え・独自化）。</li>
          <li>・生成結果は必ず「ユーザー最終確認」を前提にしています。</li>
        </ul>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">記事一覧</h2>

        {loading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : articles.length === 0 ? (
          <div className="p-8 border border-gray-200 rounded-2xl text-center text-gray-600">
            <FileText className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <p className="font-bold">まだ記事がありません</p>
            <p className="text-sm mt-1">「新規作成」から始めましょう。</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {articles.map((a) => {
              const j = a.jobs?.[0]
              return (
                <Link key={a.id} href={`/seo/articles/${a.id}`} className="group">
                  <div className="h-full p-5 rounded-2xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-gray-900 line-clamp-2">{a.title}</p>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded-full bg-gray-100">status: {a.status}</span>
                      <span className="px-2 py-1 rounded-full bg-gray-100">目標: {a.targetChars}</span>
                      {j ? (
                        <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                          job: {j.status} {j.progress}%
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-xs text-gray-400">
                      作成: {new Date(a.createdAt).toLocaleString('ja-JP')}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}


