'use client'
// ============================================
// 表示の速さを測る（UI 品質 S-45）
// ============================================
// LCP・CLS・INP を、ブラウザの中の window.__doyaVitals に残す。外のサービスには送らない。
// 確かめ方: 内蔵ブラウザで画面を開き、window.__doyaVitals を読む。CLS は 0.1 未満を合格とする。
// ⚠️ 新しい見た目（チェックリスト §5.1）のときだけ測る。
import { useReportWebVitals } from 'next/web-vitals'
import { usePathname } from 'next/navigation'
import { useRef } from 'react'

type Vital = { name: string; value: number; rating?: string; path: string; at: number }

declare global {
  interface Window { __doyaVitals?: Vital[] }
}

const WATCH = new Set(['LCP', 'CLS', 'INP', 'FCP', 'TTFB'])

export default function ShellVitals() {
  const pathname = usePathname() || '/'
  const path = useRef(pathname)
  path.current = pathname
  useReportWebVitals((m) => {
    if (!WATCH.has(m.name)) return
    const list = (window.__doyaVitals ??= [])
    list.push({ name: m.name, value: Math.round(m.value * 1000) / 1000, rating: m.rating, path: path.current, at: Date.now() })
    if (list.length > 200) list.splice(0, list.length - 200)
  })
  return null
}
