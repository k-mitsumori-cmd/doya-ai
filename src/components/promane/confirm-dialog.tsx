'use client'

import { useCallback } from 'react'
import { confirmDialog } from '@/components/ds/dialog'

interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'danger' | 'warning' | 'info'
  /** 以前のキャラクター画像の指定。共通のダイアログでは使わない（互換のために受け取るだけ） */
  icon?: string
}

/** 共通のダイアログ（ds/dialog）が自分で開くので、置く部品は何も描かない */
function NoopConfirmDialog() {
  return null
}

/**
 * window.confirm() の代替。中身は共通のダイアログ（@/components/ds/dialog。role・Esc・フォーカスの戻り）。
 * UX 点検 FIX-PLAN 18 で、自前のモーダルから共通の部品に切り替えた。呼び出し側の書き方は今までと同じ。
 *
 * 使い方:
 *   const { confirm, ConfirmDialog } = useConfirm()
 *   const ok = await confirm({ title: '削除しますか？', message: '元に戻せません。', tone: 'danger', confirmLabel: '削除する' })
 *   if (ok) { ... }
 *
 * <ConfirmDialog /> は今までの呼び出し側の互換のために残している（何も描かない）。
 */
export function useConfirm() {
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return confirmDialog({
      title: options.title || '続けますか？',
      message: options.message,
      confirmLabel: options.confirmLabel || '続ける',
      cancelLabel: options.cancelLabel || 'やめる',
      // warning（戻せない一括の直し・未保存の入力を捨てる）も、戻せない操作として danger で出す
      tone: options.tone === 'info' ? 'primary' : 'danger',
    })
  }, [])

  return { confirm, ConfirmDialog: NoopConfirmDialog }
}
