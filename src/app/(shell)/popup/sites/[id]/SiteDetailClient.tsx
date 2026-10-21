'use client'

// ドヤポップアップ サイト詳細: 設置タグ・案の一覧（公開の切り替え・並び順）・集計
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, CircleDashed, Copy as CopyIcon, ImagePlus, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import type { PopupDto } from '@/lib/popup/dto'
import type { SiteDetail } from '@/lib/popup/popup-read'
import { isId } from '@/lib/popup/schema'
import { safeSignInCallbackUrl } from '@/lib/safe-signin-callback'
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
type Lease = { scope: string; epoch: number; siteId: string }
type ActionLease = Lease & { token: number }

function isSiteDetail(value: unknown, siteId: string, days: number): value is SiteDetail {
  if (!value || typeof value !== 'object') return false
  const detail = value as Partial<SiteDetail>
  const site = detail.site
  const totals = site?.totals
  return detail.days === days && site?.id === siteId && typeof site.name === 'string' &&
    typeof site.sourceUrl === 'string' && typeof site.embedCode === 'string' &&
    totals !== undefined && typeof totals.impressions === 'number' &&
    typeof totals.clicks === 'number' && typeof totals.closes === 'number' &&
    (totals.ctr === null || typeof totals.ctr === 'number') &&
    Array.isArray(detail.popups) && detail.popups.every(p => p && isId(p.id) &&
      typeof p.name === 'string' && p.totals && typeof p.totals.impressions === 'number')
}

function InstallCard({ site, readOnly = false }: { site: SiteDetail['site']; readOnly?: boolean }) {
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
            {readOnly ? <button type="button" className="pd-btn-primary" disabled>タグをコピー（見本）</button> : <CopyButton text={site.embedCode} label="タグをコピー" primary />}
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

function PopupRow({ p, first, last, busy, readOnly = false, onAction }: { p: PopupDto; first: boolean; last: boolean; busy: boolean; readOnly?: boolean; onAction?: (a: Action) => void }) {
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
            {readOnly ? (
              <button type="button" className="pd-btn-outline" disabled><Pencil className="h-4 w-4" aria-hidden />編集・プレビュー（見本）</button>
            ) : (
              <Link href={`/popup/edit/${p.id}`} className="pd-btn-outline"><Pencil className="h-4 w-4" aria-hidden />編集・プレビュー</Link>
            )}
            {p.status === 'live' ? (
              <button type="button" disabled={busy || readOnly} onClick={() => onAction?.('paused')} className="pd-btn-outline">
                <Pause className="h-4 w-4" aria-hidden />
                停止する
              </button>
            ) : (
              <button type="button" disabled={busy || readOnly || p.issues.length > 0} onClick={() => onAction?.('live')} className="pd-btn-outline !text-[color:var(--blue)]">
                <Play className="h-4 w-4" aria-hidden />
                公開する
              </button>
            )}
            <div className="ml-auto flex items-center">
              <button type="button" disabled={busy || readOnly || first} onClick={() => onAction?.('up')} aria-label="上へ（優先して表示）" className="pd-btn-ghost">
                <ArrowUp className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy || readOnly || last} onClick={() => onAction?.('down')} aria-label="下へ" className="pd-btn-ghost">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy || readOnly} onClick={() => onAction?.('duplicate')} aria-label="複製" className="pd-btn-ghost">
                <CopyIcon className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" disabled={busy || readOnly} onClick={() => onAction?.('delete')} aria-label="削除" className="pd-btn-danger">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>
        <div ref={node => {
          if (!node) return
          if (readOnly) node.setAttribute('inert', '')
          else node.removeAttribute('inert')
        }} className={`border-t border-[color:var(--line)] bg-[var(--surface-2)] p-3 lg:border-l lg:border-t-0 ${readOnly ? 'pointer-events-none' : ''}`}>
          <PopupPreview popup={p} device="pc" height={300} />
        </div>
      </div>
    </article>
  )
}

type ViewActions = {
  onDaysChange: (days: 7 | 30 | 90) => void
  onRetry: (days: 7 | 30 | 90) => void
  onAddPopup: (kind: 'image' | 'cta') => void
  onPopupAction: (popup: PopupDto, action: Action) => void
  onRequestSiteDelete: () => void
  onCancelConfirm: () => void
  onConfirmPopupDelete: (popup: PopupDto) => void
  onConfirmSiteDelete: () => void
}

type ViewProps = {
  data: SiteDetail
  days: 7 | 30 | 90
  busy?: string | null
  actionError?: { message: string; issues: string[] } | null
  loadError?: boolean
  switching?: boolean
  confirm?: null | { kind: 'popup'; p: PopupDto } | { kind: 'site' }
  toast?: ReactNode
  actions?: ViewActions
}

// Presentation only. Without actions this renders a visibly disabled fixture preview;
// the authenticated controller below remains the sole owner of reads and writes.
export function SiteDetailView({ data, days, busy = null, actionError = null, loadError = false,
  switching = false, confirm = null, toast = null, actions }: ViewProps) {
  const interactive = Boolean(actions)
  const { site, popups } = data
  return (
    <>
      {toast}
      {!interactive && <p className="pd-note mb-4" role="status">開発用の見本です。操作はできません。</p>}
      <PageHeader
        back={interactive ? { href: '/popup', label: 'サイト一覧' } : undefined}
        title={site.name}
        sub={
          interactive ? <a href={site.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline-offset-2 hover:underline">{site.sourceUrl}</a> : <span>{site.sourceUrl}</span>
        }
        action={interactive ? <DaysSwitch value={days} onChange={actions!.onDaysChange} /> :
          <div className="pd-soft inline-flex p-1" role="group" aria-label="集計の期間（見本）">
            {([7, 30, 90] as const).map(d => <button key={d} type="button" disabled aria-pressed={days === d}
              className={`min-h-[44px] min-w-[52px] rounded-[10px] px-3 text-[13px] font-bold ${days === d ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-[var(--shadow)]' : 'text-[color:var(--sub)]'}`}>{d}日</button>)}
          </div>}
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
          <ErrorState message="集計を読み込めませんでした。少し待ってからもう一度お試しください。" onRetry={interactive ? () => actions!.onRetry(days) : undefined} />
        </div>
      ) : switching || data.days !== days ? (
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
            <InstallCard site={site} readOnly={!interactive} />
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
                <button type="button" disabled={!!busy || !interactive} onClick={() => actions?.onAddPopup('image')} className="pd-btn-outline">
                  <ImagePlus className="h-4 w-4" aria-hidden />
                  画像で作る
                </button>
                <button type="button" disabled={!!busy || !interactive} onClick={() => actions?.onAddPopup('cta')} className="pd-btn-outline">
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
                    <button type="button" className="pd-btn-outline" disabled={!interactive} onClick={() => actions?.onAddPopup('cta')}>
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
                    busy={!!busy}
                    readOnly={!interactive}
                    onAction={(a) => actions?.onPopupAction(p, a)}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}

      <section className="mt-12 border-t border-[color:var(--line)] pt-6">
        <button type="button" disabled={!!busy || !interactive} onClick={() => actions?.onRequestSiteDelete()} className="pd-btn-danger">
          <Trash2 className="h-4 w-4" aria-hidden />
          このサイトを削除する
        </button>
      </section>

      {interactive && confirm?.kind === 'popup' && (
        <ConfirmDialog
          title={`「${confirm.p.name}」を削除しますか？`}
          body="計測の数字も一緒に消え、元に戻せません。"
          confirmLabel="削除する"
          danger
          onCancel={() => actions?.onCancelConfirm()}
          onConfirm={() => actions?.onConfirmPopupDelete(confirm.p)}
        />
      )}
      {interactive && confirm?.kind === 'site' && (
        <ConfirmDialog
          title={`「${site.name}」を削除しますか？`}
          body="公開中のポップアップもすべて止まります。貼ってある設置タグは、外しておくことをおすすめします。"
          confirmLabel="削除する"
          danger
          onCancel={() => actions?.onCancelConfirm()}
          onConfirm={() => actions?.onConfirmSiteDelete()}
        />
      )}
    </>
  )
}

export default function SiteDetailClient({ initial, serverActorId, created }: {
  initial: SiteDetail; serverActorId: string; created: boolean
}) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const sdkActor = status === 'authenticated' && typeof session?.user?.id === 'string' && session.user.id.trim()
    ? session.user.id : null
  const scope = sdkActor === serverActorId ? `${serverActorId}:${initial.site.id}` : null
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [data, setData] = useState<SiteDetail>(initial)
  const [dataEpoch, setDataEpoch] = useState(-1)
  const [loadError, setLoadError] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ message: string; issues: string[] } | null>(null)
  const [confirm, setConfirm] = useState<null | { kind: 'popup'; p: PopupDto } | { kind: 'site' }>(null)
  const { show, node: toast } = useToast()
  const [toastEpoch, setToastEpoch] = useState(-1)
  const [restoreTick, setRestoreTick] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const firstSnapshot = useRef(true)
  const lastPeriod = useRef<{ scope: string | null; days: 7 | 30 | 90 } | null>(null)
  const currentDays = useRef(days)
  currentDays.current = days
  const life = useRef<{ scope: string | null; siteId: string; epoch: number; active: boolean;
    mounted: boolean; readSeq: number; readAbort: AbortController | null;
    readTimer: ReturnType<typeof setTimeout> | null; readCancel: (() => void) | null; nextToken: number;
    busyToken: number | null; undoSeq: number; pending: Set<() => void> }>({
    scope: null, siteId: initial.site.id, epoch: 0, active: false, mounted: true,
    readSeq: 0, readAbort: null, readTimer: null, readCancel: null, nextToken: 0, busyToken: null, undoSeq: 0,
    pending: new Set(),
  })
  const retire = useCallback(() => {
    const state = life.current
    state.epoch++
    state.active = false
    state.readSeq++
    state.readCancel?.()
    state.readCancel = null
    state.readAbort?.abort()
    state.readAbort = null
    if (state.readTimer) clearTimeout(state.readTimer)
    state.readTimer = null
    for (const cancel of state.pending) cancel()
    state.busyToken = null
    state.undoSeq++
  }, [])
  // Render-time scope comparison closes the render → passive-effect gap, including A→B→A.
  if (life.current.scope !== scope || life.current.siteId !== initial.site.id) {
    retire()
    life.current.scope = scope
    life.current.siteId = initial.site.id
    life.current.active = Boolean(scope)
    if (status === 'unauthenticated' || status === 'authenticated' && !scope) firstSnapshot.current = false
  }
  const lease = (): Lease | null => {
    const state = life.current
    return state.mounted && state.active && state.scope ?
      { scope: state.scope, epoch: state.epoch, siteId: state.siteId } : null
  }
  const current = (ticket: Lease | null) => Boolean(ticket && life.current.mounted && life.current.active &&
    life.current.scope === ticket.scope && life.current.epoch === ticket.epoch &&
    life.current.siteId === ticket.siteId)
  const actionCurrent = (ticket: ActionLease) => current(ticket) && life.current.busyToken === ticket.token
  const begin = (label: string): ActionLease | null => {
    const ticket = lease()
    if (!ticket || life.current.busyToken !== null || dataEpoch !== ticket.epoch ||
        data.site.id !== ticket.siteId || data.days !== currentDays.current) return null
    const token = ++life.current.nextToken
    life.current.busyToken = token
    life.current.undoSeq++
    setBusy(label)
    setActionError(null)
    return { ...ticket, token }
  }
  const finish = (ticket: ActionLease) => {
    if (!actionCurrent(ticket)) return
    life.current.busyToken = null
    setBusy(null)
  }
  const notify = (ticket: Lease, message: string, undo?: () => void) => {
    if (!current(ticket)) return
    setToastEpoch(ticket.epoch)
    show({ message, undo })
  }
  const bounded = <T,>(promise: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const pending = life.current.pending
    const uncertain = () => new Error('結果を確認できませんでした。サイトの一覧を確認してください。')
    const cancel = () => { clearTimeout(timer); pending.delete(cancel); reject(uncertain()) }
    const timer = setTimeout(cancel, 15_000)
    pending.add(cancel)
    promise.then(value => { clearTimeout(timer); pending.delete(cancel); resolve(value) },
      error => { clearTimeout(timer); pending.delete(cancel); reject(error) })
  })
  const load = useCallback(async (d: 7 | 30 | 90) => {
    const state = life.current
    const ticket = state.mounted && state.active && state.scope ?
      { scope: state.scope, epoch: state.epoch, siteId: state.siteId } : null
    if (!ticket) return
    const seq = ++state.readSeq
    state.readCancel?.()
    state.readCancel = null
    state.readAbort?.abort()
    if (state.readTimer) clearTimeout(state.readTimer)
    const controller = new AbortController()
    state.readAbort = controller
    let transportActive = true
    let timedOut = false
    let deadlineTimer: ReturnType<typeof setTimeout> | null = null
    const isLatestRead = () => state.mounted && state.active && state.scope === ticket.scope &&
      state.epoch === ticket.epoch && state.siteId === ticket.siteId && state.readSeq === seq
    const isReadCurrent = () => transportActive && isLatestRead()
    const deadline = new Promise<never>((_, reject) => {
      deadlineTimer = setTimeout(() => {
        if (!transportActive) return
        transportActive = false
        timedOut = true
        controller.abort()
        reject(new Error('read deadline'))
      }, 15_000)
      state.readCancel = () => {
        if (!transportActive) return
        transportActive = false
        if (deadlineTimer) clearTimeout(deadlineTimer)
        controller.abort()
        reject(new Error('read retired'))
      }
    })
    setLoadError(false)
    setSwitching(false)
    state.readTimer = setTimeout(() => { if (isReadCurrent()) setSwitching(true) }, 300)
    try {
      const res = await Promise.race([fetch(`/api/popup/sites/${encodeURIComponent(ticket.siteId)}?days=${d}`, {
        cache: 'no-store', signal: controller.signal,
      }), deadline])
      if (!isReadCurrent()) return
      if (res.status === 401) {
        const callback = safeSignInCallbackUrl(`/popup/sites/${encodeURIComponent(ticket.siteId)}`)
        window.location.href = `/auth/signin?callbackUrl=${encodeURIComponent(callback)}`
        return
      }
      if (!res.ok) throw new Error('load')
      const body: unknown = await Promise.race([res.json(), deadline])
      if (!isReadCurrent()) return
      if (!isSiteDetail(body, ticket.siteId, d)) throw new Error('load')
      setData(body)
      setDataEpoch(ticket.epoch)
      if (container.current) { container.current.hidden = false; container.current.removeAttribute('inert') }
    } catch {
      if (isLatestRead() && (transportActive || timedOut)) setLoadError(true)
    } finally {
      transportActive = false
      if (deadlineTimer) clearTimeout(deadlineTimer)
      if (isLatestRead()) {
        if (state.readTimer) clearTimeout(state.readTimer)
        state.readTimer = null
        state.readCancel = null
        state.readAbort = null
        setSwitching(false)
      }
    }
  }, [])

  // Mount the lifecycle before any effect can start a read. StrictMode replays
  // setup after cleanup, where cleanup has retired and marked it unmounted.
  useEffect(() => {
    const state = life.current
    state.mounted = true
    const hide = () => {
      retire()
      if (container.current) { container.current.hidden = true; container.current.setAttribute('inert', '') }
    }
    const restore = (event: PageTransitionEvent) => { if (event.persisted) { hide(); setRestoreTick(x => x + 1) } }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', restore)
    return () => {
      state.mounted = false
      retire()
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', restore)
    }
  }, [retire])

  useEffect(() => {
    if (!scope) return
    life.current.active = true
    // A BFCache return renders a neutral skeleton first; make that retry surface
    // visible even when the fresh private read fails.
    if (container.current) { container.current.hidden = false; container.current.removeAttribute('inert') }
    setBusy(null)
    setConfirm(null)
    setActionError(null)
    if (firstSnapshot.current && initial.days === currentDays.current && initial.site.id === life.current.siteId) {
      firstSnapshot.current = false
      setData(initial)
      setDataEpoch(life.current.epoch)
      if (created) {
        setToastEpoch(life.current.epoch)
        show({ message: 'ポップアップの案ができました。プレビューで確かめて、使う案を公開してください。' })
      }
    } else {
      firstSnapshot.current = false
      void load(currentDays.current)
    }
  }, [scope, restoreTick, initial, created, load, show])

  useEffect(() => {
    const previous = lastPeriod.current
    lastPeriod.current = { scope, days }
    if (scope && previous?.scope === scope && previous.days !== days) void load(days)
  }, [days, scope, load])

  const patchPopup = async (ticket: ActionLease, popupId: string, body: Record<string, unknown>) => {
    if (!actionCurrent(ticket) || !isId(popupId)) return
    const res = await bounded(fetch(`/api/popup/popups/${encodeURIComponent(popupId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }))
    if (!actionCurrent(ticket)) return
    const json = await bounded(res.json().catch(() => ({})))
    if (!actionCurrent(ticket)) return
    if (!res.ok) throw Object.assign(new Error(json?.error || '操作に失敗しました。'),
      { issues: Array.isArray(json?.issues) ? json.issues : [] })
  }

  const run = async (p: PopupDto, action: Action) => {
    const ticket = begin(p.id)
    if (!ticket || !isId(p.id) || !data.popups.some(x => x.id === p.id)) { if (ticket) finish(ticket); return }
    const captured = { id: p.id, name: p.name, status: p.status, siteId: ticket.siteId }
    try {
      if (action === 'live' || action === 'paused') {
        await patchPopup(ticket, captured.id, { status: action })
        if (!actionCurrent(ticket)) return
        const undoSeq = life.current.undoSeq
        notify(ticket, action === 'live' ? `「${captured.name}」を公開しました。サイトに1分ほどで反映されます。` :
          `「${captured.name}」を停止しました。`, () => {
          if (!current(ticket) || life.current.undoSeq !== undoSeq || life.current.busyToken !== null) return
          void (async () => {
            const undoTicket = begin(captured.id)
            if (!undoTicket) return
            try { await patchPopup(undoTicket, captured.id, { status: captured.status }); if (actionCurrent(undoTicket)) await load(currentDays.current) }
            catch (e) { if (actionCurrent(undoTicket)) setActionError({ message: (e as Error).message || '操作に失敗しました。', issues: [] }) }
            finally { finish(undoTicket) }
          })()
        })
      } else if (action === 'up' || action === 'down') {
        const list = [...data.popups]
        const i = list.findIndex(x => x.id === captured.id)
        const j = action === 'up' ? i - 1 : i + 1
        if (j < 0 || j >= list.length) return
        ;[list[i], list[j]] = [list[j], list[i]]
        await Promise.all(list.map((x, idx) => x.sortOrder === idx ? null : patchPopup(ticket, x.id, { sortOrder: idx })))
      } else if (action === 'duplicate') {
        const res = await bounded(fetch(`/api/popup/sites/${encodeURIComponent(captured.siteId)}/popups`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ duplicateOf: captured.id }),
        }))
        if (!actionCurrent(ticket)) return
        const json = await bounded(res.json().catch(() => ({})))
        if (!actionCurrent(ticket)) return
        if (!res.ok) throw new Error(json?.error || '複製に失敗しました。')
        notify(ticket, `「${captured.name}」を複製しました（下書き）。`)
      } else if (action === 'delete') {
        const res = await bounded(fetch(`/api/popup/popups/${encodeURIComponent(captured.id)}`, { method: 'DELETE' }))
        if (!actionCurrent(ticket)) return
        if (!res.ok) throw new Error('削除に失敗しました。')
        notify(ticket, `「${captured.name}」を削除しました。`)
      }
      if (actionCurrent(ticket)) await load(currentDays.current)
    } catch (e) {
      if (actionCurrent(ticket)) setActionError({ message: (e as Error).message || '操作に失敗しました。', issues: (e as { issues?: string[] }).issues || [] })
    } finally { finish(ticket) }
  }

  const addPopup = async (kind: 'image' | 'cta') => {
    const ticket = begin('add')
    if (!ticket) return
    try {
      const res = await bounded(fetch(`/api/popup/sites/${encodeURIComponent(ticket.siteId)}/popups`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }),
      }))
      if (!actionCurrent(ticket)) return
      const json = await bounded(res.json().catch(() => ({})))
      if (!actionCurrent(ticket)) return
      if (!res.ok || !isId(json?.popup?.id)) throw new Error(json?.error || '追加に失敗しました。')
      router.push(`/popup/edit/${encodeURIComponent(json.popup.id)}`)
    } catch (e) {
      if (actionCurrent(ticket)) setActionError({ message: (e as Error).message || '結果を確認できませんでした。サイトの一覧を確認してください。', issues: [] })
    } finally { finish(ticket) }
  }

  const deleteSite = async () => {
    const ticket = begin('site')
    if (!ticket) return
    try {
      const res = await bounded(fetch(`/api/popup/sites/${encodeURIComponent(ticket.siteId)}`, { method: 'DELETE' }))
      if (!actionCurrent(ticket)) return
      if (!res.ok) throw new Error('削除に失敗しました。')
      router.push('/popup')
    } catch (e) {
      if (actionCurrent(ticket)) setActionError({ message: (e as Error).message || '結果を確認できませんでした。サイトの一覧を確認してください。', issues: [] })
    } finally { finish(ticket) }
  }

  if (!scope) return (
    <div className="pd-page mx-auto max-w-3xl px-4 py-12 md:px-8" role="status">
      {status === 'loading' ? 'ログイン状態を確認しています。' : 'ログイン状態が変わりました。最新の画面を開き直してください。'}
    </div>
  )
  if (!life.current.active || dataEpoch !== life.current.epoch || data.site.id !== initial.site.id) return (
    <div ref={container} className="pd-page mx-auto max-w-6xl px-4 py-8 md:px-8">
      {loadError ? <ErrorState message="サイトを確認できませんでした。少し待ってからもう一度お試しください。" onRetry={() => void load(currentDays.current)} /> : <SkeletonDetail />}
    </div>
  )
  return <div ref={container} className="pd-page mx-auto max-w-6xl px-4 py-8 md:px-8"><SiteDetailView data={data} days={days} busy={busy} actionError={actionError} loadError={loadError}
    switching={switching} confirm={confirm} toast={toastEpoch === life.current.epoch ? toast : null}
    actions={{
      onDaysChange: setDays,
      onRetry: d => { void load(d) },
      onAddPopup: kind => { void addPopup(kind) },
      onPopupAction: (p, a) => { if (a === 'delete') { if (life.current.busyToken === null) setConfirm({ kind: 'popup', p }) } else void run(p, a) },
      onRequestSiteDelete: () => { if (life.current.busyToken === null) setConfirm({ kind: 'site' }) },
      onCancelConfirm: () => setConfirm(null),
      onConfirmPopupDelete: p => { setConfirm(null); void run(p, 'delete') },
      onConfirmSiteDelete: () => { setConfirm(null); void deleteSite() },
    }} /></div>
}
