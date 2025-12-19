'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const [job, setJob] = useState<SeoJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const reviewedCount = useMemo(
    () => (job?.sections || []).filter((s) => s.status === 'reviewed').length,
    [job]
  )

  const load = useCallback(async (opts?: { showLoading?: boolean }) => {
    const showLoading = opts?.showLoading === true
    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      // ハング対策: Vercelの一時的な遅延で「読み込み中…」が永遠に続かないようtimeoutを入れる
      const controller = new AbortController()
      const timeoutMs = 12000
      const t = setTimeout(() => controller.abort(), timeoutMs)
      const res = await fetch(`/api/seo/jobs/${jobId}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(t)
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        throw new Error(json?.error || `API Error: ${res.status}`)
      }
      setJob(json.job || null)
    } catch (e: any) {
      // ポーリング時は一時的な失敗で画面が点滅しないよう、既存jobがある場合は維持する
      if (showLoading || !job) setJob(null)
      const msg =
        e?.name === 'AbortError'
          ? '読み込みがタイムアウトしました（回線/サーバの一時遅延の可能性）。再読み込みしてください。'
          : e?.message || '読み込みに失敗しました'
      setLoadError(msg)
    }
    if (showLoading) setLoading(false)
  }, [jobId, job])

  const advanceOnce = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      setActionError(null)
      const res = await fetch(`/api/seo/jobs/${jobId}/advance`, { method: 'POST' })
      let json: any = null
      try {
        json = await res.json()
      } catch {
        // ignore
      }
      if (!res.ok || json?.success === false) {
        const msg = json?.error || `advance failed (${res.status})`
        setActionError(msg)
        setAuto(false) // 自動実行中なら止める（無限リトライ防止）
        await load({ showLoading: false })
        return
      }
      await load({ showLoading: false })
    } finally {
      setBusy(false)
    }
  }, [busy, jobId, load])

  useEffect(() => {
    load({ showLoading: true })
    const t = setInterval(() => {
      load({ showLoading: false })
    }, 2500)
    return () => clearInterval(t)
  }, [load])

  // 作成直後 (?auto=1) は自動実行をONにする
  useEffect(() => {
    const a = searchParams.get('auto')
    if (a === '1') setAuto(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!auto) return
    if (!job) return
    if (job.status === 'done' || job.status === 'error') return
    const t = setTimeout(() => {
      advanceOnce()
    }, 700)
    return () => clearTimeout(t)
  }, [auto, job, advanceOnce])

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-white/70">読み込み中...</div>
      </main>
    )
  }

  if (!job) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
          <p className="font-bold">読み込みに失敗しました</p>
          <pre className="text-xs whitespace-pre-wrap mt-2">{loadError || '不明なエラー'}</pre>
          <p className="text-xs mt-2 text-red-800/90">
            まずは環境変数（<code>GOOGLE_GENAI_API_KEY</code> / <code>DATABASE_URL</code>）とDB接続状態を確認してください。
          </p>
        </div>
        <div className="mt-4">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800"
            onClick={() => {
              setLoading(true)
              load({ showLoading: true })
            }}
          >
            再読み込み
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">生成ジョブ</h1>
          <p className="text-white/70 mt-1">{job.article.title}</p>
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
            onClick={() => load({ showLoading: true })}
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800 disabled:opacity-60"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  setActionError(null)
                  const res = await fetch(`/api/seo/jobs/${jobId}/reset`, { method: 'POST' })
                  const json = await res.json().catch(() => ({}))
                  if (!res.ok || json?.success === false) {
                    throw new Error(json?.error || `reset failed (${res.status})`)
                  }
                  setAuto(true)
                  await load({ showLoading: true })
                  // すぐ1ステップ進める（ユーザーが迷わないように）
                  await fetch(`/api/seo/jobs/${jobId}/advance`, { method: 'POST' }).catch(() => {})
                  await load({ showLoading: false })
                } catch (e: any) {
                  setActionError(e?.message || 'リセットに失敗しました')
                } finally {
                  setBusy(false)
                }
              }}
            >
              エラーをリセットして再開
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              disabled={busy}
              onClick={() => {
                setAuto(true)
                advanceOnce()
              }}
            >
              自動実行を再開
            </button>
          </div>
        </div>
      ) : null}
      {actionError ? (
        <div className="mt-4 p-4 rounded-2xl border border-red-200 bg-red-50 text-red-800">
          <p className="font-bold">実行エラー（advance）</p>
          <pre className="text-xs whitespace-pre-wrap mt-2">{actionError}</pre>
          <p className="text-xs mt-2 text-red-800/90">
            まずは環境変数（<code>GOOGLE_GENAI_API_KEY</code> / <code>DATABASE_URL</code>）や参考URLの重さを確認してください。
          </p>
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


