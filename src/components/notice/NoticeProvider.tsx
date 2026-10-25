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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useDoyaPowerFx } from '@/components/doya-power/fx-context'
import { usePrefersReducedMotion } from '@/components/ds/motion'
import { EMPTY_QUEUE, closeNotice, enqueueNotice, pauseNotice, showNextNotice, type Notice, type NoticeAction, type NoticeQueueState } from '@/lib/notice/queue'
import { addSeen, loadSeen, saveSeen } from '@/lib/notice/seen'
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
}

const noop = () => {}
const NoticeContext = createContext<NoticeApi>({ enabled: false, ready: false, push: noop, notify: noop, tip: noop, hasSeen: () => false, holdBusy: () => noop })

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

/** 同じサイトの /api/ への POST が終わっていない間は「作業中」 */
function useApiBusy(): number {
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
      try { return await original(input, init) } finally { setPending((p) => Math.max(0, p - 1)) }
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
  useEffect(() => { const s = loadSeen(userKey); setSeen(s); seenRef.current = new Set(s); setReady(true) }, [userKey])
  const remember = useCallback((id: string) => {
    setSeen((cur) => { const next = addSeen(cur, id); saveSeen(userKey, next); seenRef.current = new Set(next); return next })
  }, [userKey])

  // ---- 作業中（入力中・保存や生成の通信中・ツールが holdBusy した間） ----
  const apiBusy = useApiBusy()
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
  const push = useCallback((n: Notice) => setQ((s) => enqueueNotice(s, n, seenRef.current)), [])
  // 同時に来たものをまとめてから、順番どおりに出す。作業中になったら、表示中のエラー以外を列に戻す
  useEffect(() => {
    if (busy) { setQ((s) => pauseNotice(s)); }
    const t = setTimeout(() => setQ((s) => showNextNotice(s, busy)), busy ? 0 : 400)
    return () => clearTimeout(t)
  }, [busy, q.queue.length, q.current])
  const current = q.current
  useEffect(() => {
    setPage(0)
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
  const notify = useCallback((t: ToastInput) => {
    setToast({ ...t, key: Date.now() }); setToastOpen(true)
  }, [])
  useEffect(() => {
    if (!toast) return
    clearTimeout(toastTimer.current)
    const hide = () => { if (hover.current) { toastTimer.current = setTimeout(hide, 800); return } setToastOpen(false) }
    toastTimer.current = setTimeout(hide, toast.durationMs ?? 5000)
    return () => clearTimeout(toastTimer.current)
  }, [toast])

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
  const api = useMemo<NoticeApi>(() => ({ enabled: true, ready, push, notify, tip, hasSeen: (id) => seenSet.has(id), holdBusy }), [ready, push, notify, tip, seenSet, holdBusy])

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
              <div className={styles.foot}>
                {current.pages ? <span className={styles.dots} aria-label={`${page + 1} / ${current.pages.length}`}>{current.pages.map((_, i) => <i key={i} data-on={i === page ? 'true' : undefined} />)}</span> : null}
                <span className={styles.actions}>
                  {current.pages ? (
                    <>
                      {page > 0 ? <button type="button" className={`${styles.btn} ${styles.plain}`} onClick={() => setPage(page - 1)}>戻る</button> : null}
                      <button type="button" className={styles.btn} onClick={() => (last ? close(true) : setPage(page + 1))}>{last ? (current.primary?.label ?? 'はじめる') : '次へ'}</button>
                    </>
                  ) : (
                    <>
                      {current.secondary ? <ActionButton a={current.secondary} className={`${styles.btn} ${styles.ghost}`} onDone={() => act(current.secondary, false)} /> : null}
                      <ActionButton a={current.primary ?? { label: '閉じる' }} className={styles.btn} onDone={() => act(current.primary, true)} />
                    </>
                  )}
                </span>
              </div>
              {current.once ? <span className={styles.never}>閉じると、この知らせは次から出ません。</span> : null}
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
  return a.href
    ? <Link href={a.href} className={className} onClick={onDone}>{a.label}</Link>
    : <button type="button" className={className} onClick={onDone}>{a.label}</button>
}
