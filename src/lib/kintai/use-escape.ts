'use client'
import { useEffect, useRef } from 'react'

/**
 * 自前のモーダルを Esc で閉じる（UX 点検 FIX-PLAN 18）。
 * 共通のダイアログ（ds/dialog の <dialog>）が開いている間は、そちらが Esc を受けるので何もしない。
 */
export function useEscapeToClose(open: boolean, onClose: () => void, disabled = false) {
  const latest = useRef(onClose)
  latest.current = onClose
  useEffect(() => {
    if (!open || disabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, disabled])
}
