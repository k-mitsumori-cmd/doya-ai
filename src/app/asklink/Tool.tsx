'use client'

// ドヤAI質問リンク 作成画面（ログイン後）
// 流れ: URL → 抽出＋質問リンク2本（数秒〜十数秒）→ バナー3枚を1枚ずつ（1枚1〜2分）
import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Link2, Loader2, MessageCircleQuestion } from 'lucide-react'
import RunResult from '@/components/asklink/RunResult'
import { useBannerQueue } from '@/components/asklink/useBannerQueue'
import type { RunDto } from '@/lib/asklink/dto'

export default function AskLinkTool() {
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [needManual, setNeedManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<{ message: string; upgradeUrl?: string } | null>(null)
  const [run, setRun] = useState<RunDto | null>(null)
  const queue = useBannerQueue(setRun)

  const create = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    setLimit(null)
    try {
      const res = await fetch('/api/asklink/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, manualText: needManual ? manualText : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        window.location.href = '/auth/signin?callbackUrl=/asklink'
        return
      }
      if (res.status === 429 && data?.limitReached) {
        setLimit({ message: data.error, upgradeUrl: data.upgradeUrl })
        return
      }
      if (res.status === 422 && data?.canUseManualInput) {
        setNeedManual(true)
        setError(data.error)
        return
      }
      if (!res.ok || !data?.run) throw new Error(data?.error || '作成に失敗しました。')
      setRun(data.run)
      setNeedManual(false)
      setManualText('')
      window.dispatchEvent(new Event('asklink:generated'))
      // リンクを先に見せ、画像は順に作る
      void queue.generate(data.run.id, data.run.banners.map((b: { kind: string }) => b.kind))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-[#0066ff] to-[#0a0f3c] text-white shadow">
          <MessageCircleQuestion className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-slate-900">ドヤAI質問リンク</h1>
          <p className="text-sm font-bold text-slate-500">サイトのURLから「AIに聞く」リンク2本とポップアップ用バナー3枚を作ります。</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <label htmlFor="asklink-url" className="text-sm font-black text-slate-800">
          自社サイトのURL
        </label>
        <div className="mt-2 flex flex-col gap-2 md:flex-row">
          <div className="relative flex-1">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="asklink-url"
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.co.jp/"
              className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-3 text-sm font-bold text-slate-800 focus:border-[#0066ff] focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading || !url.trim() || (needManual && manualText.trim().length < 20)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066ff] px-6 py-3 text-sm font-black text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? '作成しています' : '作成する'}
          </button>
        </div>

        {needManual && (
          <div className="mt-4">
            <label htmlFor="asklink-manual" className="text-sm font-black text-slate-800">
              サービスの説明（サイトを読み取れなかったときの手入力）
            </label>
            <textarea
              id="asklink-manual"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={5}
              maxLength={3000}
              placeholder="会社名・サービスの内容・強み・対象のお客さまなどを、20字以上で入力してください。"
              className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-800 focus:border-[#0066ff] focus:outline-none"
            />
            <p className="mt-1 text-xs font-bold text-slate-500">
              手入力のときは、質問文に入れるURLは上で入力したURLだけになります。
            </p>
          </div>
        )}

        {loading && (
          <p className="mt-3 text-xs font-bold text-slate-500">サイトを読み取り、質問リンクを作っています。十数秒ほどかかります。</p>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {limit && (
          <div className="mt-3 rounded-xl bg-blue-50 p-4 text-sm font-bold text-slate-700">
            <p>{limit.message}</p>
            {limit.upgradeUrl && (
              <Link href={limit.upgradeUrl} className="mt-2 inline-block font-black text-[#0066ff] hover:underline">
                料金プランを見る
              </Link>
            )}
          </div>
        )}
      </form>

      {run && (
        <div className="mt-8">
          {queue.busy && (
            <p className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 p-3 text-sm font-bold text-[#0066ff]">
              <Loader2 className="h-4 w-4 animate-spin" />
              バナー画像を作成しています（{run.banners.findIndex((b) => b.kind === queue.busy) + 1}/{run.banners.length}）。リンクは先にお使いいただけます。
            </p>
          )}
          {queue.error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{queue.error}</p>}
          <RunResult
            run={run}
            onChange={setRun}
            bannerBusy={queue.busy}
            onGenerateBanner={(kind) => void queue.generate(run.id, [kind])}
          />
        </div>
      )}
    </div>
  )
}
