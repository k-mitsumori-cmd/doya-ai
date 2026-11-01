'use client'
// ============================================
// パネル: パソコンでは右から出る（ドロワー）、スマホでは下から出る（ボトムシート）
// ============================================
// - Esc と背景のタップで閉じる。開いている間、フォーカスはパネルの中に残り、閉じたら押した所へ戻る。
// - 動きは位置と透明度だけ（cubic-bezier(0.22,1,0.36,1)・500ms）。動きを減らす設定では、位置は動かさず透明度だけ。
// - URL のハッシュ（#p=<鍵>）で開閉する。戻るボタンで、パネルだけが閉じる（panel-hash.ts）。
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { panelHash, readPanelKey } from './panel-hash'
import styles from './shell-next.module.css'

/** パネルを開閉する状態。key が null なら閉じている。ハッシュと同期する */
export function usePanelKey(): { key: string | null; open: (key: string) => void; close: () => void } {
  const [key, setKey] = useState<string | null>(null)
  // 開いた最初の履歴か（戻るで閉じるか、履歴を足さずに閉じるかを分ける）
  const pushed = useRef(false)

  useEffect(() => {
    setKey(readPanelKey(window.location.hash))
    const sync = () => {
      const k = readPanelKey(window.location.hash)
      if (!k) pushed.current = false
      setKey(k)
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => { window.removeEventListener('popstate', sync); window.removeEventListener('hashchange', sync) }
  }, [])

  const open = useCallback((k: string) => {
    const h = panelHash(k)
    if (!h) return
    // 開いたまま別のパネルへ移るときは、履歴を足さずに置き換える（戻るボタンは1回で元の画面へ）
    if (readPanelKey(window.location.hash)) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search + h)
    else { window.history.pushState(window.history.state, '', window.location.pathname + window.location.search + h); pushed.current = true }
    setKey(k)
  }, [])

  const close = useCallback(() => {
    if (readPanelKey(window.location.hash)) {
      if (pushed.current) window.history.back()
      else { window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search); setKey(null) }
    } else setKey(null)
  }, [])

  return { key, open, close }
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

export function Panel({ open, onClose, title, subtitle, children }: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
}) {
  // 閉じる動きのあいだも描く（mounted）。開く動きは、描いたあとの次の枠で始める（shown）
  const [mounted, setMounted] = useState(open)
  const [shown, setShown] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const returnTo = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setMounted(true)
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)))
      return () => cancelAnimationFrame(r)
    }
    setShown(false)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setMounted(false), reduced ? 0 : 450)
    return () => window.clearTimeout(t)
  }, [open])

  // 開いたらパネルの中へフォーカス、閉じたら押した所へ戻す。後ろの画面は動かさない
  useEffect(() => {
    if (!shown) return
    const el = panelRef.current
    el?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? el?.focus()
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      returnTo.current?.focus?.()
    }
  }, [shown])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab') return
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null)
    if (!nodes.length) return
    const first = nodes[0], last = nodes[nodes.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  if (!mounted) return null
  return (
    <div className={styles.panelRoot} data-open={shown ? 'true' : undefined}>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={onKeyDown}>
        <span className={styles.grab} aria-hidden="true" />
        <header className={styles.panelHead}>
          <div className={styles.panelTitleBox}>
            {subtitle ? <p className={styles.sub}>{subtitle}</p> : null}
            <h2 className={styles.panelTitle}>{title}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる" data-autofocus>
            <span aria-hidden="true">×</span>
          </button>
        </header>
        <div className={styles.panelBody}>{children}</div>
      </div>
    </div>
  )
}
