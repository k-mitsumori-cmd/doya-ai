'use client'

// ドヤポップアップ サイト詳細: 設置タグ・案の一覧（公開の切り替え・並び順）・集計
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, CircleDashed, Copy as CopyIcon,
  ImagePlus, Loader2, Pause, Pencil, Play, Plus, Trash2,
} from 'lucide-react'
import type { PopupDto, SiteDto } from '@/lib/popup/dto'
import PopupPreview from '@/components/popup/PopupPreview'
import {
  CopyButton, DaysSwitch, KindBadge, StatTile, StatusBadge, fmt, frequencyText, pct, summaryText, targetingText,
} from '@/components/popup/ui'

interface Detail {
  days: number
  site: SiteDto
  popups: PopupDto[]
}

function InstallCard({ site }: { site: SiteDto }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900">設置タグ</h2>
        {site.lastSeenAt ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            設置を確認しました（{new Date(site.lastSeenAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">
            <CircleDashed className="h-3.5 w-3.5" />
            まだ設置を確認できていません
          </span>
        )}
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">
        サイトの全ページの <code className="rounded bg-slate-100 px-1">&lt;head&gt;</code> 内に、次の1行を貼ってください。1度貼れば、ポップアップの追加・変更のたびに貼り直す必要はありません。
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold leading-relaxed text-orange-100">
          <code>{site.embedCode}</code>
        </pre>
        <CopyButton text={site.embedCode} label="タグをコピー" className="justify-center sm:self-center" />
      </div>
      <ul className="mt-3 space-y-1 text-[11px] font-bold leading-relaxed text-slate-500">
        <li>表示されるのは <b className="text-slate-700">{site.domain}</b> とそのサブドメインのページだけです。他のドメインに貼っても表示・計測されません。</li>
        <li>WordPress・Studio・Wix などは「ヘッダーにコードを追加」の設定から貼れます。Google タグマネージャーのカスタムHTMLでも動きます。</li>
        <li>公開・停止の切り替えは、サイトに1分ほどで反映されます。</li>
      </ul>
    </section>
  )
}

function PopupRow({
  p,
  first,
  last,
  busy,
  onAction,
}: {
  p: PopupDto
  first: boolean
  last: boolean
  busy: boolean
  onAction: (action: 'live' | 'paused' | 'up' | 'down' | 'duplicate' | 'delete') => void
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <KindBadge kind={p.kind} />
            <h3 className="min-w-0 truncate text-base font-black text-slate-900">{p.name}</h3>
          </div>
          {p.reason && <p className="mt-2 text-xs font-bold leading-relaxed text-slate-600">{p.reason}</p>}
          <dl className="mt-3 space-y-1 text-[11px] font-bold text-slate-500">
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">出し方</dt><dd>{summaryText(p)}</dd></div>
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">対象</dt><dd>{targetingText(p.targeting)}</dd></div>
            <div className="flex gap-2"><dt className="w-14 shrink-0 text-slate-400">頻度</dt><dd>{frequencyText(p.frequency)}</dd></div>
          </dl>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 py-2">
              <p className="text-[10px] font-black text-slate-400">表示</p>
              <p className="text-base font-black tabular-nums text-slate-900">{fmt(p.totals.impressions)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 py-2">
              <p className="text-[10px] font-black text-slate-400">クリック</p>
              <p className="text-base font-black tabular-nums text-slate-900">{fmt(p.totals.clicks)}</p>
            </div>
            <div className="rounded-xl bg-slate-50 py-2">
              <p className="text-[10px] font-black text-slate-400">クリック率</p>
              <p className="text-base font-black tabular-nums text-[#e0442c]">{pct(p.totals.ctr)}</p>
            </div>
          </div>
          {p.issues.length > 0 && (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              公開する前に: {p.issues.join(' / ')}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/popup/edit/${p.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700"
            >
              <Pencil className="h-3.5 w-3.5" />
              編集・プレビュー
            </Link>
            {p.status === 'live' ? (
              <button type="button" disabled={busy} onClick={() => onAction('paused')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Pause className="h-3.5 w-3.5" />
                停止する
              </button>
            ) : (
              <button
                type="button"
                disabled={busy || p.issues.length > 0}
                onClick={() => onAction('live')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff5a36] px-3 py-2 text-xs font-black text-white hover:bg-[#e8482a] disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5" />
                公開する
              </button>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button type="button" disabled={busy || first} onClick={() => onAction('up')} aria-label="上へ（優先して表示）" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy || last} onClick={() => onAction('down')} aria-label="下へ" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy} onClick={() => onAction('duplicate')} aria-label="複製" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30">
                <CopyIcon className="h-4 w-4" />
              </button>
              <button type="button" disabled={busy} onClick={() => onAction('delete')} aria-label="削除" className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50/60 p-3 lg:border-l lg:border-t-0">
          <PopupPreview popup={p} device="pc" height={300} />
        </div>
      </div>
    </article>
  )
}

function SiteDetail() {
  const params = useParams<{ id: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const id = params?.id
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(search?.get('created') ? 'ポップアップの案ができました。プレビューで確かめて、使う案を「公開する」にしてください。' : null)

  const load = useCallback(async () => {
    if (!id) return
    const res = await fetch(`/api/popup/sites/${id}?days=${days}`, { cache: 'no-store' })
    if (res.status === 401) {
      window.location.href = `/auth/signin?callbackUrl=/popup/sites/${id}`
      return
    }
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json?.error || '読み込めませんでした。')
      return
    }
    setData(json)
  }, [id, days])

  useEffect(() => {
    void load()
  }, [load])

  const patchPopup = async (popupId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/popup/popups/${popupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error([json?.error, ...(json?.issues || [])].filter(Boolean).join(' '))
  }

  const act = async (p: PopupDto, action: 'live' | 'paused' | 'up' | 'down' | 'duplicate' | 'delete') => {
    if (!data || busy) return
    setBusy(p.id)
    setError(null)
    try {
      if (action === 'live' || action === 'paused') {
        await patchPopup(p.id, { status: action })
        setNotice(action === 'live' ? `「${p.name}」を公開しました。サイトに1分ほどで反映されます。` : `「${p.name}」を停止しました。`)
      } else if (action === 'up' || action === 'down') {
        const list = [...data.popups]
        const i = list.findIndex((x) => x.id === p.id)
        const j = action === 'up' ? i - 1 : i + 1
        if (j < 0 || j >= list.length) return
        ;[list[i], list[j]] = [list[j], list[i]]
        await Promise.all(list.map((x, idx) => (x.sortOrder === idx ? null : patchPopup(x.id, { sortOrder: idx }))))
      } else if (action === 'duplicate') {
        const res = await fetch(`/api/popup/sites/${data.site.id}/popups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duplicateOf: p.id }) })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || '複製に失敗しました。')
      } else if (action === 'delete') {
        if (!window.confirm(`「${p.name}」を削除します。計測の数字も消えます。よろしいですか？`)) return
        const res = await fetch(`/api/popup/popups/${p.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('削除に失敗しました。')
      }
      await load()
    } catch (e) {
      setError((e as Error).message || '操作に失敗しました。')
    } finally {
      setBusy(null)
    }
  }

  const addPopup = async (kind: 'image' | 'cta') => {
    if (!data || busy) return
    setBusy('add')
    try {
      const res = await fetch(`/api/popup/sites/${data.site.id}/popups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.popup?.id) throw new Error(json?.error || '追加に失敗しました。')
      router.push(`/popup/edit/${json.popup.id}`)
    } catch (e) {
      setError((e as Error).message)
      setBusy(null)
    }
  }

  const deleteSite = async () => {
    if (!data) return
    if (!window.confirm(`「${data.site.name}」を削除します。公開中のポップアップもすべて止まります。よろしいですか？`)) return
    const res = await fetch(`/api/popup/sites/${data.site.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/popup')
    else setError('削除に失敗しました。')
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>
        <Link href="/popup" className="mt-4 inline-block text-sm font-black text-slate-600 underline">一覧に戻る</Link>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#ff5a36]" />
      </div>
    )
  }

  const { site, popups } = data
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
      <Link href="/popup" className="inline-flex items-center gap-1 text-xs font-black text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" />
        サイト一覧
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-black text-slate-900 md:text-2xl">{site.name}</h1>
          <a href={site.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 underline-offset-2 hover:underline">
            {site.sourceUrl}
          </a>
        </div>
        <DaysSwitch value={days} onChange={setDays} />
      </div>

      {notice && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={`表示（${data.days}日）`} value={fmt(site.totals.impressions)} />
        <StatTile label="クリック" value={fmt(site.totals.clicks)} />
        <StatTile label="クリック率" value={pct(site.totals.ctr)} accent />
        <StatTile label="閉じた" value={fmt(site.totals.closes)} />
      </div>

      <div className="mt-5">
        <InstallCard site={site} />
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">ポップアップ</h2>
            <p className="text-[11px] font-bold text-slate-500">1ページに出るのは1つだけです。条件に合う公開中のもののうち、上にあるものが優先されます。</p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={!!busy} onClick={() => void addPopup('image')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <ImagePlus className="h-3.5 w-3.5" />
              画像で作る
            </button>
            <button type="button" disabled={!!busy} onClick={() => void addPopup('cta')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" />
              一から作る
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-4">
          {popups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm font-bold text-slate-500">ポップアップがありません。右上から追加できます。</p>
          ) : (
            popups.map((p, i) => (
              <PopupRow key={p.id} p={p} first={i === 0} last={i === popups.length - 1} busy={busy === p.id} onAction={(a) => void act(p, a)} />
            ))
          )}
        </div>
      </section>

      <section className="mt-12 border-t border-slate-200 pt-6">
        <button type="button" onClick={() => void deleteSite()} className="inline-flex items-center gap-1.5 text-xs font-black text-rose-600 hover:underline">
          <Trash2 className="h-3.5 w-3.5" />
          このサイトを削除する
        </button>
      </section>
    </div>
  )
}

export default function SiteDetailPage() {
  // ⚠️ useSearchParams は Suspense の中で使う（Next.js の静的書き出しで落ちる）
  return (
    <Suspense fallback={null}>
      <SiteDetail />
    </Suspense>
  )
}
