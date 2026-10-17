'use client'

// ドヤポップアップ ログイン後のトップ: 提案の作成とサイト一覧
// 流れ: URL → 読み取り＋質問リンク＋3案（十数秒〜数十秒）→ サイト詳細へ
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Globe, Loader2, PanelTopOpen, Sparkles } from 'lucide-react'
import type { SiteDto } from '@/lib/popup/dto'
import { fmt, pct } from '@/components/popup/ui'

const LOADING_STEPS = ['サイトを読み取っています', '「AIに聞く」の質問文を作っています', 'ポップアップの案をまとめています']

function SiteCard({ s }: { s: SiteDto }) {
  return (
    <Link
      href={`/popup/sites/${s.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-900">{s.name}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-bold text-slate-500">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            {s.domain}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-[#ff5a36]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
        {s.lastSeenAt ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            タグ設置済み
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            <CircleDashed className="h-3 w-3" />
            タグ未設置
          </span>
        )}
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">公開中 {s.liveCount}件</span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
        <div>
          <dt className="text-[10px] font-black text-slate-400">表示（30日）</dt>
          <dd className="text-lg font-black tabular-nums text-slate-900">{fmt(s.totals.impressions)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black text-slate-400">クリック</dt>
          <dd className="text-lg font-black tabular-nums text-slate-900">{fmt(s.totals.clicks)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-black text-slate-400">クリック率</dt>
          <dd className="text-lg font-black tabular-nums text-[#e0442c]">{pct(s.totals.ctr)}</dd>
        </div>
      </dl>
    </Link>
  )
}

export default function PopupTool() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [manualText, setManualText] = useState('')
  const [needManual, setNeedManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState<{ message: string; upgradeUrl?: string } | null>(null)
  const [sites, setSites] = useState<SiteDto[] | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/popup/sites', { cache: 'no-store' })
    if (res.status === 401) {
      window.location.href = '/auth/signin?callbackUrl=/popup'
      return
    }
    const data = await res.json().catch(() => ({}))
    setSites(Array.isArray(data?.sites) ? data.sites : [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!loading) return
    setStep(0)
    const t = setInterval(() => setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)), 7000)
    return () => clearInterval(t)
  }, [loading])

  const create = async () => {
    if (loading || !url.trim()) return
    setLoading(true)
    setError(null)
    setLimit(null)
    try {
      const res = await fetch('/api/popup/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, manualText: needManual ? manualText : undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        window.location.href = '/auth/signin?callbackUrl=/popup'
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
      if (!res.ok || !data?.site?.id) {
        setError(data?.error || '提案の作成に失敗しました。時間をおいてもう一度お試しください。')
        return
      }
      window.dispatchEvent(new Event('popup:generated'))
      router.push(`/popup/sites/${data.site.id}?created=1`)
    } catch {
      setError('通信に失敗しました。接続を確かめてもう一度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5a36] to-[#b8202f] text-white shadow">
          <PanelTopOpen className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-black text-slate-900 md:text-2xl">ドヤポップアップ</h1>
          <p className="text-xs font-bold text-slate-500 md:text-sm">URLを入れるだけで、AIがサイトに合ったポップアップを提案します。</p>
        </div>
        <span className="ml-auto rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-[#d9362b]">BETA</span>
      </div>

      <section className="mt-6 rounded-3xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/60 p-5 shadow-sm md:p-7">
        <label htmlFor="popup-url" className="text-sm font-black text-slate-800">
          ポップアップを出したいサイトのURL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="popup-url"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) void create()
            }}
            placeholder="https://example.co.jp/"
            disabled={loading}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#ff5a36] focus:ring-2 focus:ring-orange-100"
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={loading || !url.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff5a36] px-6 py-3 text-sm font-black text-white shadow-md transition-colors hover:bg-[#e8482a] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            提案を作る
          </button>
        </div>

        {needManual && (
          <div className="mt-3">
            <label htmlFor="popup-manual" className="text-xs font-black text-slate-700">
              サービスの説明（サイトを読み取れなかったときの手入力。20〜3000字）
            </label>
            <textarea
              id="popup-manual"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#ff5a36]"
              placeholder="何を提供しているか、強み、対象のお客さまなど"
            />
          </div>
        )}

        {loading && (
          <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-600" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-[#ff5a36]" />
            {LOADING_STEPS[step]}（30秒ほどかかります）
          </p>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}
        {limit && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800" role="alert">
            {limit.message}
            {limit.upgradeUrl && (
              <Link href={limit.upgradeUrl} className="ml-2 underline">
                料金プランを見る
              </Link>
            )}
          </div>
        )}
        <p className="mt-3 text-[11px] font-bold text-slate-400">
          「AIに聞く」・相談や申し込みへの案内・おすすめページの3案を、下書きで作ります。公開するまでサイトには何も出ません。
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-black text-slate-800">あなたのサイト</h2>
        {sites === null ? (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
            <PanelTopOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-black text-slate-700">まだサイトがありません</p>
            <p className="mt-1 text-xs font-bold text-slate-500">上にURLを入れると、最初の提案ができます。</p>
          </div>
        ) : (
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {sites.map((s) => (
              <SiteCard key={s.id} s={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
