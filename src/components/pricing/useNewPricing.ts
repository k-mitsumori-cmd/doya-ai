'use client'
// ============================================
// この人に新しい料金を出すか（クライアント）
// ============================================
// /api/pricing/status を1回だけ読む（同じ画面の中で使い回す）。分かるまでは false（今の料金のボタンのまま）。
// 旗 NEW_PRICING_ROLLOUT が off のあいだは、いつも false なので、今の画面は何も変わらない。
import { useEffect, useState } from 'react'

let cached: Promise<boolean> | null = null

function load(): Promise<boolean> {
  cached ??= fetch('/api/pricing/status', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { newPricing: false }))
    .then((d) => d?.newPricing === true)
    .catch(() => false)
  return cached
}

export function useNewPricing(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let alive = true
    void load().then((v) => { if (alive) setOn(v) })
    return () => { alive = false }
  }, [])
  return on
}
