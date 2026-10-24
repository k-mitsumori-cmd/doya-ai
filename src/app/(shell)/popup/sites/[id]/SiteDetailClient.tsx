'use client'

// ドヤポップアップ サイト詳細: 設置タグ・案の一覧（公開の切り替え・並び順）・集計
import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleDashed, Copy as CopyIcon, ImagePlus, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import type { SiteDetail } from '@/lib/popup/popup-read'
import PopupPreview from '@/components/popup/PopupPreview'
import {
  ConfirmDialog,
  CopyButton,
  DaysSwitch,
  EmptyState,
  ErrorState,
  KindBadge,
  PageHeader,
  SkeletonDetail,
  StatTile,
  StatusBadge,
  fmt,
  frequencyText,
  pct,
  summaryText,
  targetingText,
  useToast,
} from '@/components/popup/ui'

type Action = 'live' | 'paused' | 'up' | 'down' | 'duplicate' | 'delete'

function InstallCard({ site }: { site: SiteDetail['site'] }) {
  return (
    <section className="pd-card" aria-labelledby="popup-install">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="popup-install" className="pd-h2">
          設置タグ
        </h2>
        {site.lastSeenAt ? (
          <span className="pd-chip pd-chip-ok">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            設置を確認しました（{new Date(site.lastSeenAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）
          </span>
        ) : (
          <span className="pd-chip pd-chip-note">
            <CircleDashed className="h-3.5 w-3.5" aria-hidden />
            まだ設置を確認できていません
          </span>
        )}
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <p className="text-[15px]">
            サイトの全ページの <code className="pd-tabular rounded bg-[var(--track)] px-1">&lt;head&gt;</code> の中に、次の1行を貼ってください。1度貼れば、ポップアップを足したり直したりするたびに貼り直す必要はありません。
          </p>
          <pre className="mt-4 whitespace-pre-wrap break-all rounded-[var(--r-sm)] bg-[var(--navy)] px-4 py-3 text-[13px] leading-relaxed text-[color:var(--bar)]">
            <code>{site.embedCode}</code>
          </pre>
          <div className="mt-4">
            <CopyButton text={site.embedCode} label="タグをコピー" primary />
          </div>
          <ul className="pd-label mt-4 list-disc space-y-1 pl-5">
            <li>
              表示されるのは <b className="text-[color:var(--ink)]">{site.domain}</b> とそのサブドメインのページだけです。ほかのドメインに貼っても、表示も計測もされません。
            </li>
            <li>WordPress・Studio・Wix などは「ヘッダーにコードを追加」の設定から貼れます。Google タグマネージャーのカスタムHTMLでも動きます。</li>
            <li>公開・停止の切り替えは、サイトに1分ほどで反映されます。</li>
          </ul>
        </div>
        <figure className="hidden lg:block">
          <Image src="/popup/install-example.webp" alt="サイトの上にポップアップが表示されている例" width={1600} height={900} className="h-auto w-full rounded-[var(--r-sm)] border border-[color:var(--line)]" />
          <figcaption className="pd-label mt-2">設置するとこのように表示されます</figcaption>
        </figure>
      </div>
    </section>
  )
}

function PopupRow({ p, first, last, busy, onAction }: { p: PopupDto; first: boolean; last: boolean; busy: boolean; onAction: (a: Action) => void }) {
  return (
    <article className="pd-card overflow-hidden" style={{ padding: 0 }} aria-label={p.name}>
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={p.status} />
            <KindBadge kind={p.kind} />
          </div>
          <h3 className="pd-h2 mt-2 break-words">{p.name}</h3>
          {p.reason && <p className="mt-2 text-[15px] text-[color:var(--sub)]">{p.reason}</p>}
          <dl className="pd-label mt-4 space-y-1">
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-[color:var(--muted)]">出し方</dt>
              <dd>{summaryText(p)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-[color:var(--muted)]">対象</dt>
              <dd>{targetingText(p.targeting)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-14 shrink-0 text-[color:var(--muted)]">頻度</dt>
              <dd>{frequencyText(p.frequency)}</dd>
            </div>
          </dl>
          <dl className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['表示', fmt(p.totals.impressions)],
              ['クリック', fmt(p.totals.clicks)],
              ['クリック率', pct(p.totals.ctr)],
            ].map(([k, v]) => (
              <div key={k} className="pd-soft px-3 py-2">
                <dt className="pd-label">{k}</dt>
                <dd className="pd-tabular text-lg font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          {p.issues.length > 0 && (
            <p className="pd-note mt-4 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              公開する前に: {p.issues.join(' / ')}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link href={`/popup/edit/${p.id}`} className="pd-btn-outline">
              <Pencil className="h-4 w-4" aria-hidden />
              編集・プレビュー
            </Link>
            {p.status === 'live' ? (
              <button type="button" disabled={busy} onClick={() => onAction('paused')} className="pd-btn-outline">
                <Pause className="h-4 w-4" aria-hidden />
                停止する
              </button>
            ) : (
              <button type="button" disabled={busy || p.issues.length > 0} onClick={() => onAction('live')} className="pd-btn-outline !text-[color:var(--blue)]">
                <Play className="h-4 w-4" aria-hidden />
                公開する
              </button>
            )}
            <div className="ml-auto flex items-center">
              <button type="button" disabled={busy || first} onClick={() => onAction('up')} aria-label="上へ（優先して表示）" className="pd-btn-ghost">
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy || last} onClick={() => onAction('down')} aria-label="下へ" className="pd-btn-ghost">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy} onClick={() => onAction('duplicate')} aria-label="複製" className="pd-btn-ghost">
                <CopyIcon className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy} onClick={() => onAction('delete')} aria-label="削除" className="pd-btn-danger">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div className="border-t border-[color:var(--line)] bg-[var(--surface-2)] p-3 lg:border-l lg:border-t-0">
          <PopupPreview popup={p} device="pc" height={300} />
        </div>
      </div>
    </article>
  )
}

export default function SiteDetailClient({ initial, created }: { initial: SiteDetail; created: boolean }) {
  const router = useRouter()
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<SiteDetail>(initial)
  const [loadError, setLoadError] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ message: string; issues: string[] } | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'popup'; p: PopupDto } | { kind: 'site' }>(null)
  const { show, node: toast } = useToast()
  const first = useRef(true)

  useEffect(() => {
    if (created) show({ message: 'ポップアップの案ができました。プレビューで確かめて、使う案を公開してください。' })
  }, [created, show])

  const load = useCallback(
    async (d: number) => {
      setLoadError(false)
      // 300ms 未満で終わるなら骨組みを出さない（§11）
      const t = setTimeout(() => setSwitching(true), 300)
      try {
        const res = await fetch(`/api/popup/sites/${initial.site.id}?days=${d}`, { cache: 'no-store' })
        if (res.status === 401) {
          window.location.href = `/auth/signin?callbackUrl=/popup/sites/${initial.site.id}`
          return
        }
        if (!res.ok) throw new Error('load')
        setData(await res.json())
      } catch {
        setLoadError(true)
      } finally {
        clearTimeout(t)
        setSwitching(false)
      }
    },
    [initial.site.id]
  )

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    void load(days)
  }, [days, load])

  const patchPopup = async (popupId: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/popup/popups/${popupId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw Object.assign(new Error(json?.error || '操作に失敗しました。'), { issues: Array.isArray(json?.issues) ? json.issues : [] })
  }

  const run = async (p: PopupDto, action: Action) => {
    if (busy) return
    setBusy(p.id)
    setActionError(null)
    try {
      if (action === 'live' || action === 'paused') {
        await patchPopup(p.id, { status: action })
        show({
          message: action === 'live' ? `「${p.name}」を公開しました。サイトに1分ほどで反映されます。` : `「${p.name}」を停止しました。`,
          undo: () => void patchPopup(p.id, { status: p.status }).then(() => load(days)),
        })
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
        show({ message: `「${p.name}」を複製しました（下書き）。` })
      } else if (action === 'delete') {
        const res = await fetch(`/api/popup/popups/${p.id}`, { method: 'DELETE' })
        if (!res.ok) throw new Error('削除に失敗しました。')
        show({ message: `「${p.name}」を削除しました。` })
      }
      await load(days)
    } catch (e) {
      setActionError({ message: (/[ぁ-んァ-ヶ一-龠]/.test(String((e as Error)?.message ?? '')) ? (e as Error).message : '操作に失敗しました。'), issues: (e as { issues?: string[] }).issues || [] })
    } finally {
      setBusy(null)
    }
  }

  const addPopup = async (kind: 'image' | 'cta') => {
    if (busy) return
    setBusy('add')
    try {
      const res = await fetch(`/api/popup/sites/${data.site.id}/popups`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.popup?.id) throw new Error(json?.error || '追加に失敗しました。')
      router.push(`/popup/edit/${json.popup.id}`)
    } catch (e) {
      setActionError({ message: (e as Error).message, issues: [] })
      setBusy(null)
    }
  }

  const deleteSite = async () => {
    const res = await fetch(`/api/popup/sites/${data.site.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/popup')
    else setActionError({ message: '削除に失敗しました。', issues: [] })
  }

  const { site, popups } = data
  return (
    <div className="pd-page mx-auto max-w-6xl px-4 py-8 md:px-8">
      {toast}
      <PageHeader
        back={{ href: '/popup', label: 'サイト一覧' }}
        title={site.name}
        sub={
          <a href={site.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">
            {site.sourceUrl}
          </a>
        }
        action={<DaysSwitch value={days} onChange={setDays} />}
      />

      {actionError && (
        <div className="pd-error mt-6 flex items-start gap-2" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            {actionError.message}
            {actionError.issues.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {actionError.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {loadError ? (
        <div className="mt-6">
          <ErrorState message="集計を読み込めませんでした。少し待ってからもう一度お試しください。" onRetry={() => void load(days)} />
        </div>
      ) : switching ? (
        <div className="mt-6">
          <SkeletonDetail />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label={`表示（${data.days}日）`} value={fmt(site.totals.impressions)} unit="回" />
            <StatTile label="クリック" value={fmt(site.totals.clicks)} unit="回" />
            <StatTile label="クリック率" value={site.totals.ctr === null ? '—' : site.totals.ctr.toFixed(1)} unit={site.totals.ctr === null ? undefined : '%'} />
            <StatTile label="閉じた" value={fmt(site.totals.closes)} unit="回" />
          </div>

          <div className="mt-12">
            <InstallCard site={site} />
          </div>

          <section className="mt-12" aria-labelledby="popup-list">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="popup-list" className="pd-h2">
                  ポップアップ
                </h2>
                <p className="pd-label mt-1">1ページに出るのは1つだけです。条件に合う公開中のもののうち、上にあるものが優先されます。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!busy} onClick={() => void addPopup('image')} className="pd-btn-outline">
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  画像で作る
                </button>
                <button type="button" disabled={!!busy} onClick={() => void addPopup('cta')} className="pd-btn-outline">
                  <Plus className="h-4 w-4" aria-hidden />
                  一から作る
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              {popups.length === 0 ? (
                <EmptyState
                  image="/popup/empty-sites.webp"
                  title="ポップアップがありません"
                  body="手持ちの画像から作るか、文言を入れて一から作れます。"
                  action={
                    <button type="button" className="pd-btn-outline" onClick={() => void addPopup('cta')}>
                      一から作る
                    </button>
                  }
                />
              ) : (
                popups.map((p, i) => (
                  <PopupRow
                    key={p.id}
                    p={p}
                    first={i === 0}
                    last={i === popups.length - 1}
                    busy={busy === p.id}
                    onAction={(a) => (a === 'delete' ? setConfirm({ kind: 'popup', p }) : void run(p, a))}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}

      <section className="mt-12 border-t border-[color:var(--line)] pt-6">
        <button type="button" onClick={() => setConfirm({ kind: 'site' })} className="pd-btn-danger">
          <Trash2 className="h-4 w-4" aria-hidden />
          このサイトを削除する
        </button>
      </section>

      {confirm?.kind === 'popup' && (
        <ConfirmDialog
          title={`「${confirm.p.name}」を削除しますか？`}
          body="計測の数字も一緒に消え、元に戻せません。"
          confirmLabel="削除する"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const p = confirm.p
            setConfirm(null)
            void run(p, 'delete')
          }}
        />
      )}
      {confirm?.kind === 'site' && (
        <ConfirmDialog
          title={`「${site.name}」を削除しますか？`}
          body="公開中のポップアップもすべて止まります。貼ってある設置タグは、外しておくことをおすすめします。"
          confirmLabel="削除する"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null)
            void deleteSite()
          }}
        />
      )}
    </div>
  )
}
