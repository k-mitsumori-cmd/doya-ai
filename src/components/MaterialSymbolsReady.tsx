'use client'

import { useEffect } from 'react'

/** 初回描画が済んでからフォント準備を伝え、読み込み前の文字表示を防ぐ。 */
export default function MaterialSymbolsReady() {
  useEffect(() => {
    let stopped = false
    let frame: number | null = null
    const reveal = () => {
      if (!stopped) document.body.classList.add('fonts-loaded')
    }

    if (!document.fonts || !document.fonts.check) {
      reveal()
      return
    }

    const check = () => {
      if (stopped) return
      if (document.fonts.check('1em "Material Symbols Outlined"')) {
        reveal()
      } else {
        frame = window.requestAnimationFrame(check)
      }
    }

    if (document.readyState === 'complete') check()
    else window.addEventListener('load', check, { once: true })

    return () => {
      stopped = true
      window.removeEventListener('load', check)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  return null
}
