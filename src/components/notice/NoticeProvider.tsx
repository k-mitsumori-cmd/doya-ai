'use client'
// ============================================
// ドヤくんの知らせ（共通の部品）
// ============================================
// 見本: https://claude.ai/artifact/3n7KxcEPrxB1rVbB81sfjj（2026-10-25）
// - シート（767px 以下は下から。下へ引くと閉じる）／カード（768px 以上は右下）: push(notice)
// - トースト（保存・コピー・できました・失敗。取り消す・開くのボタン）: notify({...})
// - 吹き出し（用語の「?」・ボタンを指す案内）: tip(anchor, {...})
// 決まりは src/lib/notice/queue.ts（同時に1つ・順番・作業中は出さない・once は二度と出さない）。
// ⚠️ ドヤくんの表示オフ（DoyaPowerFx の mascot）なら文字だけ。動きを減らす設定では動かさない。絵文字は使わない。
// ⚠️ 旗（GUIDE_POPUPS_ROLLOUT）が出すと決めた人だけ、ShellGate がこの部品で包む。外では useNotice() が何もしない。
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDoyaPowerFx } from '@/components/doya-power/fx-context'
import { usePrefersReducedMotion } from '@/components/ds/motion'
import { EMPTY_QUEUE, NOTICE_LEVELS, closeNotice, enqueueNotice, parseNoticeLevel, pauseNotice, showNextNotice, type Notice, type NoticeAction, type NoticeLevel, type NoticeQueueState } from '@/lib/notice/queue'
import { addSeen, loadLevelRaw, loadSeen, saveLevelRaw, saveSeen } from '@/lib/notice/seen'
import { countsAsDraft, isLeavingLink, shouldNotifyFinished } from '@/lib/notice/leave'
import toastStore from 'react-hot-toast'
import HotToastBridge from './HotToastBridge'
import styles from './notice.module.css'

export interface ToastInput {
  tone?: 'ok' | 'error' | 'info'
  title: string
  sub?: string
  action?: { label: string; href?: string; onClick?: () => void }
  /** 出しておく時間（ミリ秒）。既定 5000。カーソルを乗せている間は止まる */
  durationMs?: number
}

export interface TipInput {
  id: string
  title: string
  body: string
  /** 「わかった」を押したら二度と出さない */
  once?: boolean
}

interface NoticeApi {
  enabled: boolean
  /** 見た記録を読み終えたか（読み終える前に足すと、見た知らせがもう一度出てしまう） */
  ready: boolean
  push: (n: Notice) => void
  notify: (t: ToastInput) => void
  tip: (anchor: HTMLElement, t: TipInput) => void
  /** 見たことがあるか（once の知らせ・吹き出し） */
  hasSeen: (id: string) => boolean
  /** 作業中にする。返り値を呼ぶと戻る（長い生成の間など、ツールから使う） */
  holdBusy: () => () => void
  /** 知らせの量（ふつう・少なめ・エラーだけ） */
  level: NoticeLevel
  setLevel: (l: NoticeLevel) => void
}

const noop = () => {}
const NoticeContext = createContext<NoticeApi>({ enabled: false, ready: false, push: noop, notify: noop, tip: noop, hasSeen: () => false, holdBusy: () => noop, level: 'normal', setLevel: noop })

/** 知らせの部品。旗が off のとき（Provider の外）は、どれも何もしない */
export function useNotice(): NoticeApi {
  return useContext(NoticeContext)
}

// 吹き出しが指している所を、青い縁で示す（元の box-shadow は覚えておいて戻す）
const SPOT = '0 0 0 3px rgba(0, 102, 255, .35)'
function spot(el: HTMLElement) { el.dataset.noticeShadow = el.style.boxShadow; el.style.boxShadow = SPOT }
function unspot(el: HTMLElement | null) { if (!el) return; el.style.boxShadow = el.dataset.noticeShadow ?? ''; delete el.dataset.noticeShadow }

const isEditable = (el: Element | null) =>
  !!el && (el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(el.type)) || (el as HTMLElement).isContentEditable)

type ApiFinish = { startPath: string; ms: number; ok: boolean }

/** 同じサイトの /api/ への POST が終わっていない間は「作業中」。終わったら onFinish を呼ぶ */
function useApiBusy(onFinish: { current: (f: ApiFinish) => void }): number {
  const [pending, setPending] = useState(0)
  useEffect(() => {
    const original = window.fetch
    const watched: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
      let own = false
      try { const u = new URL(url, window.location.origin); own = u.origin === window.location.origin && u.pathname.startsWith('/api/') } catch {}
      if (!own || method === 'GET') return original(input, init)
      setPending((p) => p + 1)
      const startPath = window.location.pathname, t0 = Date.now()
      let ok = false
      try { const res = await original(input, init); ok = res.ok; return res } finally {
        setPending((p) => Math.max(0, p - 1))
        try { onFinish.current({ startPath, ms: Date.now() - t0, ok }) } catch { /* 知らせが失敗しても、通信の結果はそのまま返す */ }
      }
    }
    window.fetch = watched
    return () => { if (window.fetch === watched) window.fetch = original }
  }, [])
  return pending
}

export default function NoticeProvider({ userKey, children }: { userKey: string; children: ReactNode }) {
  const fx = useDoyaPowerFx()
  const reduced = usePrefersReducedMotion()
  const [seen, setSeen] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const seenRef = useRef<Set<string>>(new Set())
  const [level, setLevelState] = useState<NoticeLevel>('normal')
  const levelRef = useRef<NoticeLevel>('normal')
  useEffect(() => {
    const s = loadSeen(userKey); setSeen(s); seenRef.current = new Set(s)
    const l = parseNoticeLevel(loadLevelRaw(userKey)); setLevelState(l); levelRef.current = l
    setReady(true)
  }, [userKey])
  const setLevel = useCallback((l: NoticeLevel) => { setLevelState(l); levelRef.current = l; saveLevelRaw(userKey, l) }, [userKey])
  // 知らせの量を選ぶ画面（シートの中で切り替える）
  const [levelOpen, setLevelOpen] = useState(false)
  const remember = useCallback((id: string) => {
    setSeen((cur) => { const next = addSeen(cur, id); saveSeen(userKey, next); seenRef.current = new Set(next); return next })
  }, [userKey])

  // ---- 作業中（入力中・保存や生成の通信中・ツールが holdBusy した間） ----
  const pathname = usePathname() || '/'
  const router = useRouter()
  const finishRef = useRef<(f: ApiFinish) => void>(() => {})
  const apiBusy = useApiBusy(finishRef)
  const [typing, setTyping] = useState(false)
  const [holds, setHolds] = useState(0)
  useEffect(() => {
    const on = () => setTyping(isEditable(document.activeElement))
    const out = () => setTimeout(on, 0)
    document.addEventListener('focusin', on); document.addEventListener('focusout', out)
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', out) }
  }, [])
  const busy = apiBusy > 0 || typing || holds > 0
  const holdBusy = useCallback(() => { setHolds((h) => h + 1); let done = false; return () => { if (!done) { done = true; setHolds((h) => Math.max(0, h - 1)) } } }, [])

  // ---- シート / カード ----
  const [q, setQ] = useState<NoticeQueueState>(EMPTY_QUEUE)
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(false)
  const push = useCallback((n: Notice) => setQ((s) => enqueueNotice(s, n, seenRef.current, levelRef.current)), [])
  // 同時に来たものをまとめてから、順番どおりに出す。作業中になったら、表示中のエラー以外を列に戻す
  useEffect(() => {
    if (busy) { setQ((s) => pauseNotice(s)); }
    const t = setTimeout(() => setQ((s) => showNextNotice(s, busy)), busy ? 0 : 400)
    return () => clearTimeout(t)
  }, [busy, q.queue.length, q.current])
  const current = q.current
  useEffect(() => {
    setPage(0); setLevelOpen(false)
    if (!current) { setOpen(false); return }
    const r = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(r)
  }, [current])
  const close = useCallback((done: boolean) => {
    setOpen(false)
    setTimeout(() => setQ((s) => {
      const { state, closed } = closeNotice(s)
      if (closed?.once && done) remember(closed.id)
      return state
    }), reduced ? 0 : 260)
  }, [remember, reduced])
  useEffect(() => {
    if (!current) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, close])

  // 下からのシートは、下へ引くと閉じる
  const sheetRef = useRef<HTMLDivElement>(null)
  const drag = useRef<number | null>(null)
  const onPointerDown = (e: React.PointerEvent) => {
    if (window.innerWidth > 767 || (e.target as HTMLElement).closest('button, a')) return
    drag.current = e.clientY
  }
  useEffect(() => {
    const move = (e: PointerEvent) => { if (drag.current == null || !sheetRef.current) return; sheetRef.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current)}px)` }
    const up = (e: PointerEvent) => {
      if (drag.current == null) return
      const d = e.clientY - drag.current; drag.current = null
      if (sheetRef.current) sheetRef.current.style.transform = ''
      if (d > 80) close(false)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [close])

  // ---- トースト（1つずつ。新しいものが来たら入れ替える） ----
  const [toast, setToast] = useState<(ToastInput & { key: number }) | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const hover = useRef(false)
  // 1つずつ: 自分のトーストを出すときは今のトースト（react-hot-toast）を閉じ、向こうが出たらこちらを閉じる
  const notify = useCallback((t: ToastInput) => {
    toastStore.dismiss(); setToast({ ...t, key: Date.now() }); setToastOpen(true)
  }, [])
  const onHotShow = useCallback(() => setToastOpen(false), [])
  useEffect(() => {
    if (!toast) return
    clearTimeout(toastTimer.current)
    const hide = () => { if (hover.current) { toastTimer.current = setTimeout(hide, 800); return } setToastOpen(false) }
    toastTimer.current = setTimeout(hide, toast.durationMs ?? 5000)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

  // ---- (15) 裏で終わった作業の知らせ／(27) 離れる前の下書きの確認 ----
  const dirtyRef = useRef(false)
  const [leaveTo, setLeaveTo] = useState<string | null>(null)
  // 画面が変わったら、書きかけは数え直す
  useEffect(() => { dirtyRef.current = false; setLeaveTo(null) }, [pathname])
  useEffect(() => {
    finishRef.current = (f) => {
      // 保存や生成がうまくいったら、書きかけではなくなったとみなす
      if (f.ok && f.startPath === window.location.pathname) dirtyRef.current = false
      if (shouldNotifyFinished({ ...f, nowPath: window.location.pathname })) {
        notify({ tone: 'ok', title: '裏で進めていた作業が終わりました', sub: '前の画面で始めた作業です', action: { label: '開く', href: f.startPath }, durationMs: 8000 })
      }
    }
  }, [notify])
  useEffect(() => {
    const onInput = (e: Event) => {
      const el = e.target as HTMLElement | null
      if (!el || !el.tagName) return
      const input = el as HTMLInputElement
      if (countsAsDraft({ tagName: el.tagName, type: input.type, readOnly: input.readOnly, contentEditable: el.isContentEditable,
        inDialog: Boolean(el.closest('[role="dialog"], [role="alertdialog"]')), ignored: Boolean(el.closest('[data-notice-ignore]')) })) dirtyRef.current = true
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = '' } }
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0) return
      const a = (e.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null
      if (!a) return
      if (!isLeavingLink({ href: a.getAttribute('href'), origin: window.location.origin, currentPath: window.location.pathname, target: a.target, download: a.hasAttribute('download'), modifier: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey })) return
      e.preventDefault(); e.stopPropagation()
      setLeaveTo(a.href)
    }
    document.addEventListener('input', onInput, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => { document.removeEventListener('input', onInput, true); document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', onBeforeUnload) }
  }, [])
  const leaveNow = () => {
    const to = leaveTo; dirtyRef.current = false; setLeaveTo(null)
    if (to) { const u = new URL(to); router.push(u.pathname + u.search + u.hash) }
  }

  // ---- 吹き出し ----
  const [tipState, setTipState] = useState<(TipInput & { left: number; top: number; arrow: number }) | null>(null)
  const tipAnchor = useRef<HTMLElement | null>(null)
  const tip = useCallback((anchor: HTMLElement, t: TipInput) => {
    if (t.once && seenRef.current.has(t.id)) return
    const r = anchor.getBoundingClientRect()
    const w = Math.min(280, window.innerWidth - 32)
    const left = Math.max(16, Math.min(r.left + r.width / 2 - 28, window.innerWidth - w - 16))
    unspot(tipAnchor.current)
    spot(anchor); tipAnchor.current = anchor
    setTipState({ ...t, left, top: r.bottom + 10, arrow: Math.max(12, r.left + r.width / 2 - left - 6) })
  }, [])
  const hideTip = useCallback((done: boolean) => {
    setTipState((t) => { if (t?.once && done) remember(t.id); return null })
    unspot(tipAnchor.current); tipAnchor.current = null
  }, [remember])
  useEffect(() => {
    if (!tipState) return
    const off = () => hideTip(false)
    window.addEventListener('scroll', off, { passive: true, capture: true }); window.addEventListener('resize', off)
    return () => { window.removeEventListener('scroll', off, { capture: true }); window.removeEventListener('resize', off) }
  }, [tipState, hideTip])

  const seenSet = useMemo(() => new Set(seen), [seen])
  const api = useMemo<NoticeApi>(() => ({ enabled: true, ready, push, notify, tip, hasSeen: (id) => seenSet.has(id), holdBusy, level, setLevel }), [ready, push, notify, tip, seenSet, holdBusy, level, setLevel])

  const p = current ? (current.pages ? current.pages[Math.min(page, current.pages.length - 1)] : current) : null
  const last = !current?.pages || page >= current.pages.length - 1
  const act = (a: NoticeAction | undefined, fallbackDone: boolean) => close(a?.done ?? fallbackDone)

  return (
    <NoticeContext.Provider value={api}>
      {children}
      <div className={styles.root} data-reduce={reduced ? 'true' : undefined}>
        {current && p ? (
          <>
            <div className={styles.scrim} data-open={open ? 'true' : undefined} onClick={() => close(false)} aria-hidden="true" />
            <div ref={sheetRef} className={styles.sheet} data-open={open ? 'true' : undefined} data-tone={current.tone} role="dialog" aria-modal="false" aria-labelledby="doya-notice-title" onPointerDown={onPointerDown}>
              <span className={styles.handle} aria-hidden="true" />
              <div className={styles.head} data-mascot={fx.mascot && p.pose ? 'on' : 'off'}>
                {fx.mascot && p.pose ? <img src={`/character/${p.pose}-256.webp`} alt="" width={72} height={72} className={styles.kun} /> : null}
                <div className={styles.headText}>
                  <span className={styles.eyebrow}>{p.eyebrow}</span>
                  <h2 id="doya-notice-title" className={styles.title}>{p.title}</h2>
                </div>
                <button type="button" className={styles.x} onClick={() => close(true)} aria-label="閉じる">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              {p.body ? <p className={styles.body}>{p.body}</p> : null}
              {p.points?.length ? <ul className={styles.points}>{p.points.map((t) => <li key={t}>{t}</li>)}</ul> : null}
              {p.checklist?.length ? (
                <ol className={styles.check}>
                  {p.checklist.map((c) => (
                    <li key={c.label} data-done={c.done ? 'true' : undefined}>
                      <span className={styles.checkMark} aria-hidden="true" />
                      {c.href && !c.done ? <Link href={c.href} onClick={() => close(false)}>{c.label}</Link> : <span>{c.label}</span>}
                      <span className={styles.checkState}>{c.done ? '済み' : 'まだ'}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {levelOpen ? (
                <fieldset className={styles.level}>
                  <legend>知らせの量</legend>
                  {NOTICE_LEVELS.map((l) => (
                    <label key={l.id} className={styles.levelRow}>
                      <input type="radio" name="doya-notice-level" value={l.id} checked={level === l.id} onChange={() => setLevel(l.id)} />
                      <span><b>{l.label}</b><small>{l.note}</small></span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              {current.content ? <div className={styles.content}>{current.content(close) as ReactNode}</div> : null}
              <div className={styles.foot} hidden={Boolean(current.content) && !current.pages}>
                {current.pages ? <span className={styles.dots} aria-label={`${page + 1} / ${current.pages.length}`}>{current.pages.map((_, i) => <i key={i} data-on={i === page ? 'true' : undefined} />)}</span> : null}
                <span className={styles.actions}>
                  {current.pages ? (
                    <>
                      {page > 0 ? <button type="button" className={`${styles.btn} ${styles.plain}`} onClick={() => setPage(page - 1)}>戻る</button> : null}
                      <button type="button" className={styles.btn} onClick={() => (last ? close(true) : setPage(page + 1))}>{last ? (current.primary?.label ?? 'はじめる') : '次へ'}</button>
                    </>
                  ) : (
                    <>
                      {current.tertiary ? <ActionButton a={current.tertiary} className={`${styles.btn} ${styles.plain}`} onDone={() => act(current.tertiary, false)} /> : null}
                      {current.secondary ? <ActionButton a={current.secondary} className={`${styles.btn} ${styles.ghost}`} onDone={() => act(current.secondary, false)} /> : null}
                      <ActionButton a={current.primary ?? { label: '閉じる' }} className={styles.btn} onDone={() => act(current.primary, true)} />
                    </>
                  )}
                </span>
              </div>
              <span className={styles.never}>
                {current.once ? '閉じると、この知らせは次から出ません。' : ''}
                {current.kind !== 'error' ? <button type="button" className={styles.levelLink} onClick={() => setLevelOpen((v) => !v)} aria-expanded={levelOpen}>{levelOpen ? '量の設定を閉じる' : '知らせの量を変える'}</button> : null}
              </span>
            </div>
          </>
        ) : null}

        {leaveTo ? (
          <>
            <div className={styles.scrim} data-open="true" onClick={() => setLeaveTo(null)} aria-hidden="true" />
            <div className={styles.sheet} data-open="true" data-tone="warn" role="alertdialog" aria-modal="true" aria-labelledby="doya-leave-title" aria-describedby="doya-leave-body">
              <span className={styles.handle} aria-hidden="true" />
              <div className={styles.head} data-mascot={fx.mascot ? 'on' : 'off'}>
                {fx.mascot ? <img src="/character/focus-256.webp" alt="" width={72} height={72} className={styles.kun} /> : null}
                <div className={styles.headText}>
                  <span className={styles.eyebrow}>書きかけの内容</span>
                  <h2 id="doya-leave-title" className={styles.title}>入力した内容は、まだ保存されていません</h2>
                </div>
                <button type="button" className={styles.x} onClick={() => setLeaveTo(null)} aria-label="閉じる">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
                </button>
              </div>
              <p id="doya-leave-body" className={styles.body}>このまま別の画面に移ると、書きかけの内容が消えることがあります。保存してから移るか、このまま移るかを選んでください。</p>
              <div className={styles.foot}>
                <span className={styles.actions}>
                  <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={leaveNow}>このまま移る</button>
                  <button type="button" className={styles.btn} onClick={() => setLeaveTo(null)} autoFocus>この画面に残る</button>
                </span>
              </div>
            </div>
          </>
        ) : null}

        {toast ? (
          <div key={toast.key} className={styles.toast} data-open={toastOpen ? 'true' : undefined} data-tone={toast.tone ?? 'ok'} role="status" aria-live="polite"
            onMouseEnter={() => (hover.current = true)} onMouseLeave={() => (hover.current = false)} style={{ ['--life' as string]: `${toast.durationMs ?? 5000}ms` }}>
            <span className={styles.tIcon} aria-hidden="true">
              {toast.tone === 'error' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
                : toast.tone === 'info' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 11v6M12 7h.01" /></svg>
                : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}
            </span>
            <span className={styles.tText}><b>{toast.title}</b>{toast.sub ? <small>{toast.sub}</small> : null}</span>
            {toast.action ? (toast.action.href
              ? <Link href={toast.action.href} className={styles.tAct} onClick={() => setToastOpen(false)}>{toast.action.label}</Link>
              : <button type="button" className={styles.tAct} onClick={() => { setToastOpen(false); toast.action?.onClick?.() }}>{toast.action.label}</button>) : null}
            <span className={styles.tLife} aria-hidden="true" />
          </div>
        ) : null}

        <HotToastBridge onShow={onHotShow} />

        {tipState ? (
          <div className={styles.tip} role="tooltip" style={{ left: tipState.left, top: tipState.top, ['--ax' as string]: `${tipState.arrow}px` }}>
            <b>{tipState.title}</b>
            <span>{tipState.body}</span>
            <span className={styles.tipRow}><button type="button" onClick={() => hideTip(true)}>わかった</button></span>
          </div>
        ) : null}
      </div>
    </NoticeContext.Provider>
  )
}

function ActionButton({ a, className, onDone }: { a: NoticeAction; className: string; onDone: () => void }) {
  // /api/ への行き先（支払い方法の更新など）は、画面の移動ではなくサーバーへ行くので、ふつうのリンクにする
  if (a.href?.startsWith('/api/')) return <a href={a.href} className={className} onClick={onDone}>{a.label}</a>
  return a.href
    ? <Link href={a.href} className={className} onClick={onDone}>{a.label}</Link>
    : <button type="button" className={className} onClick={onDone}>{a.label}</button>
}
