'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowRight, RefreshCcw, Play, Pause, ExternalLink } from 'lucide-react'

type SeoSection = {
  id: string
  index: number
  headingPath?: string | null
  plannedChars: number
  status: string
  content?: string | null
  consistency?: string | null
}

type SeoJob = {
  id: string
  status: string
  step: string
  progress: number
  error?: string | null
  articleId: string
  article: { id: string; title: string; outline?: string | null; targetChars: number }
  sections: SeoSection[]
}

export default function SeoJobPage() {
  const params = useParams<{ id: string }>()
  const jobId = params.id
  const router = useRouter()
  const [job, setJob] = useState<SeoJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)

  const reviewedCount = useMemo(
    () => (job?.sections || []).filter((s) => s.status === 'reviewed').length,
    [job]
  )

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/seo/jobs/${jobId}`, { cache: 'no-store' })
    const json = await res.json()
    setJob(json.job || null)
    setLoading(false)
  }, [jobId])

  const advanceOnce = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch(`/api/seo/jobs/${jobId}/advance`, { method: 'POST' })
      await load()
    } finally {
      setBusy(false)
    }
  }, [busy, jobId, load])

  useEffect(() => {
    load()
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!auto) return
    if (!job) return
    if (job.status === 'done' || job.status === 'error') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [auto, job, advanceOnce])

  if (loading || !job) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-gray-600">読み込み中...</div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900">生成ジョブ</h1>
          <p className="text-gray-600 mt-1">{job.article.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/seo/articles/${job.articleId}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
          >
            記事ページへ
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60"
            onClick={advanceOnce}
            disabled={busy || job.status === 'done'}
          >
            <Play className="w-4 h-4" />
            次へ進める
          </button>
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50"
            onClick={() => setAuto((v) => !v)}
          >
            {auto ? (
              <>
                <Pause className="w-4 h-4" /> 自動停止
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> 自動実行
              </>
            )}
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
            onClick={load}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-gray-200">
          <p className="text-xs text-gray-500">status</p>
          <p className="font-bold text-gray-900">{job.status}</p>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200">
          <p className="text-xs text-gray-500">step / progress</p>
          <p className="font-bold text-gray-900">
            {job.step} / {job.progress}%
          </p>
        </div>
        <div className="p-4 rounded-2xl border border-gray-200">
          <p className="text-xs text-gray-500">sections</p>
          <p className="font-bold text-gray-900">
            {reviewedCount} / {job.sections.length}
          </p>
        </div>
      </div>

      {job.error ? (
        <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
          <p className="font-bold">エラー</p>
          <pre className="text-xs whitespace-pre-wrap mt-2">{job.error}</pre>
        </div>
      ) : null}

      <div className="mt-8 grid lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">アウトライン</h2>
            <Link
              href={`/seo/articles/${job.articleId}`}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              記事ページへ <ArrowRight className="inline w-4 h-4" />
            </Link>
          </div>
          <div className="mt-3 p-4 rounded-2xl border border-gray-200 bg-gray-50">
            <pre className="text-xs whitespace-pre-wrap">{job.article.outline || '（未生成）'}</pre>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-gray-900">セクション進捗</h2>
          <div className="mt-3 space-y-3">
            {job.sections.map((s) => (
              <div key={s.id} className="p-4 rounded-2xl border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-gray-900">
                    {s.index + 1}. {s.headingPath || '（見出し未設定）'}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                      {s.status}
                    </span>
                    <button
                      className="text-xs px-2 py-1 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await fetch(`/api/seo/sections/${s.id}/regenerate`, { method: 'POST' })
                          await load()
                        } finally {
                          setBusy(false)
                        }
                      }}
                    >
                      このセクション再生成
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">目安: {s.plannedChars}字</p>
                {s.consistency ? (
                  <details className="mt-2">
                    <summary className="text-xs font-bold text-gray-700 cursor-pointer">整合性メモ</summary>
                    <pre className="text-xs whitespace-pre-wrap mt-2 text-gray-700">{s.consistency}</pre>
                  </details>
                ) : null}
                {s.content ? (
                  <details className="mt-2">
                    <summary className="text-xs font-bold text-gray-700 cursor-pointer">生成内容（抜粋）</summary>
                    <pre className="text-xs whitespace-pre-wrap mt-2 text-gray-800">
                      {s.content.slice(0, 1200)}
                      {s.content.length > 1200 ? '\n...(truncated)' : ''}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {job.status === 'done' ? (
        <div className="mt-8 p-5 rounded-2xl border border-green-200 bg-green-50">
          <p className="font-bold text-green-900">完了！</p>
          <p className="text-sm text-green-900 mt-1">
            記事ページでプレビュー・監査・画像生成・リンクチェック・エクスポートができます。
          </p>
          <div className="mt-3">
            <button
              className="px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
              onClick={() => router.push(`/seo/articles/${job.articleId}`)}
            >
              記事ページへ
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}


