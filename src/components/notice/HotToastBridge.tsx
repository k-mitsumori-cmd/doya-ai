'use client'
// ============================================
// 今あるトースト（react-hot-toast、約119ファイル）を、知らせのトーストと同じ見た目で出す（提案リスト (17)）
// ============================================
// 各ツールの toast.success / toast.error などは書き換えない。react-hot-toast の中身（useToaster）を読み、
// 知らせの部品と同じ形・同じ場所（下のまん中。スマホは下のタブの上）に、1つずつ出す。
// ⚠️ 旗が出すと決めた人の、枠を開いている画面だけ。その間だけ、ルートの <Toaster>（containerClassName="doya-hot-toaster"）を隠す。
// ⚠️ 管理画面などが自分で置いた <Toaster> は、この class を持たないので、そのまま出る。
// ⚠️ 中身が JSX のトースト（toast(() => <…/>)）も、resolveValue でそのまま描く。
import { useEffect, useRef, useState } from 'react'
import toastStore, { resolveValue, useToaster } from 'react-hot-toast'
import styles from './notice.module.css'

export const HOT_TOASTER_CLASS = 'doya-hot-toaster'

export default function HotToastBridge({ onShow }: { onShow: () => void }) {
  const { toasts, handlers } = useToaster()
  // いちばん新しい、見えているものを1つだけ
  const live = toasts.find((x) => x.visible)
  // 消えるときに縮んで薄くなれるよう、最後のトーストを少しだけ残す（data-open=false の間）
  const last = useRef(live)
  const [leaving, setLeaving] = useState(false)
  if (live) last.current = live
  useEffect(() => {
    if (live) { setLeaving(false); return }
    if (!last.current) return
    setLeaving(true)
    const timer = setTimeout(() => { setLeaving(false); last.current = undefined }, 220)
    return () => clearTimeout(timer)
  }, [live?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = live ?? (leaving ? last.current : undefined)
  const open = Boolean(live)
  useEffect(() => { if (live) onShow() }, [live?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const tone = t?.type === 'error' ? 'error' : t?.type === 'success' ? 'ok' : 'info'
  return (
    <>
      <style>{`.${HOT_TOASTER_CLASS}{display:none!important}`}</style>
      {t ? (
        <div key={t.id} className={styles.toast} data-open={open ? 'true' : 'false'} data-tone={tone} role={t.ariaProps?.role ?? 'status'} aria-live={t.ariaProps?.['aria-live'] ?? 'polite'}
          onMouseEnter={handlers.startPause} onMouseLeave={handlers.endPause} style={{ ['--life' as string]: `${t.duration ?? 4000}ms` }}>
          <span className={styles.tIcon} aria-hidden="true">
            {t.type === 'loading' ? <span className={styles.spin} />
              : tone === 'error' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 7v6M12 17h.01" /></svg>
              : tone === 'ok' ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 11v6M12 7h.01" /></svg>}
          </span>
          <span className={styles.tText}><b className={styles.tHot}>{resolveValue(t.message, t)}</b></span>
          <button type="button" className={styles.tClose} onClick={() => toastStore.dismiss(t.id)} aria-label="閉じる">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          {t.type !== 'loading' && t.duration !== Infinity ? <span className={styles.tLife} aria-hidden="true" /> : null}
        </div>
      ) : null}
    </>
  )
}
