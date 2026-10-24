'use client'
// ============================================
// ds/dialog — 共通のダイアログ（確認・削除・お知らせ・エラー。UX 点検 FIX-PLAN 18）
// ============================================
// window.confirm() / window.alert() の代わりに使う。ブラウザの <dialog> の showModal を使うので、
// role="dialog"・Esc で閉じる・開いている間は後ろを押せない・閉じたら元のボタンにフォーカスが戻る、がそろう。
//
// 使い方（イベントの中から await で呼ぶ。部品を置く必要は無い）:
//   if (!(await confirmDialog({ title: 'この記事を削除しますか？', message: '元に戻せません。', confirmLabel: '削除する', tone: 'danger' }))) return
//   await alertDialog({ title: '保存できませんでした', message: '通信を確かめて、もう一度お試しください。', tone: 'error' })
// 画面の中に置きたいときは <ConfirmDialog open ... /> をそのまま使う。
// ⚠️ message に例外の文・内部のコードをそのまま入れない。利用者向けの日本語の文にする（ds/feedback と同じ決まり）。
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { AlertTriangle, Info, Trash2 } from 'lucide-react'
import tokens from './tokens.module.css'
import styles from './dialog.module.css'

export type DialogTone = 'primary' | 'danger' | 'error'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  /** 決める側のボタン。動詞で終える（例: 削除する・保存する） */
  confirmLabel?: string
  /** やめる側のボタン。null にすると出さない（お知らせのとき） */
  cancelLabel?: string | null
  /** danger: 削除などの戻せない操作。error: 失敗のお知らせ */
  tone?: DialogTone
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'OK', cancelLabel = 'やめる', tone = 'primary', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    if (!open && d.open) d.close()
  }, [open])

  const Icon = tone === 'danger' ? Trash2 : tone === 'error' ? AlertTriangle : Info
  return (
    <dialog
      ref={ref}
      className={`${tokens.ds} ${styles.dialog}`}
      role={tone === 'primary' ? 'dialog' : 'alertdialog'}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      // Esc はやめる扱い（busy の間は閉じない）
      onCancel={(e) => { e.preventDefault(); if (!busy) onCancel() }}
    >
      <div className={styles.body}>
        <div className={styles.head}>
          <span className={styles.icon} data-tone={tone} aria-hidden><Icon size={18} /></span>
          <h2 id={titleId} className={styles.title}>{title}</h2>
        </div>
        {message ? <div id={messageId} className={styles.message}>{message}</div> : null}
        <div className={styles.actions}>
          {cancelLabel !== null ? (
            <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy} autoFocus={tone === 'danger'}>{cancelLabel}</button>
          ) : null}
          <button type="button" className={styles.primary} data-tone={tone === 'danger' ? 'danger' : undefined} onClick={onConfirm} disabled={busy} autoFocus={tone !== 'danger'}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}

type OpenOptions = Omit<ConfirmDialogProps, 'open' | 'onConfirm' | 'onCancel' | 'busy'>

/** ダイアログを1つ開き、閉じたら片付ける。決めたら true、やめたら false */
function openDialog(opts: OpenOptions): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false)
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  return new Promise<boolean>((resolve) => {
    const finish = (ok: boolean) => {
      resolve(ok)
      root.render(<ConfirmDialog {...opts} open={false} onConfirm={() => {}} onCancel={() => {}} />)
      // 閉じたあとで片付け、元のボタンにフォーカスを戻す
      setTimeout(() => { root.unmount(); host.remove(); opener?.focus?.() }, 0)
    }
    root.render(<ConfirmDialog {...opts} open onConfirm={() => finish(true)} onCancel={() => finish(false)} />)
  })
}

/** window.confirm() の代わり。削除などの戻せない操作は tone: 'danger' と「削除する」などの動詞のボタンにする */
export function confirmDialog(opts: { title: string; message?: ReactNode; confirmLabel?: string; cancelLabel?: string; tone?: 'primary' | 'danger' }): Promise<boolean> {
  return openDialog({ confirmLabel: '続ける', ...opts })
}

/** window.alert() の代わり。閉じるボタンだけを出す */
export function alertDialog(opts: { title: string; message?: ReactNode; closeLabel?: string; tone?: 'primary' | 'error' }): Promise<void> {
  const { closeLabel = '閉じる', ...rest } = opts
  return openDialog({ ...rest, confirmLabel: closeLabel, cancelLabel: null }).then(() => undefined)
}
