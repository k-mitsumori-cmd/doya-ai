'use client'

// 画像生成の呼び出しと、きょう作れる残りの枚数。単発（ImageGenModal）とまとめて作る（BoothStudio）で共有する。
// ⚠️ 原価やモデルは扱わない（サーバーが決める）。利用者に見せるのは残りの枚数だけ。
import { useCallback, useEffect, useState } from 'react'

export type ImageGenKind = 'creative_image' | 'booth_render' | 'graphic_panel'

export type ImageGenFailure = { tone: 'error' | 'forbidden' | 'disabled' | 'limit'; message: string }
export type ImageGenResult = { ok: true; images: string[] } | ({ ok: false } & ImageGenFailure)

export interface ImageQuota {
  enabled: boolean
  /** きょう作れる残りの枚数。数えられないときは null */
  remaining: number | null
  perDay: number
}

export function useImageQuota() {
  const [quota, setQuota] = useState<ImageQuota | null>(null)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tenjikai/image', { cache: 'no-store' })
      if (!res.ok) return setQuota({ enabled: false, remaining: null, perDay: 0 })
      setQuota(await res.json())
    } catch {
      setQuota({ enabled: false, remaining: null, perDay: 0 })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { quota, refresh }
}

export async function requestImages(input: { prompt: string; aspectRatio: string; kind: ImageGenKind; referencePng?: string; count?: number }): Promise<ImageGenResult> {
  try {
    const res = await fetch('/api/tenjikai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, count: input.count ?? 1, approved: true }),
    })
    const json = await res.json().catch(() => ({}))
    // ステータスコードなどの技術的な文言は出さない（統合仕様 §11）
    if (res.status === 401) return { ok: false, tone: 'forbidden', message: 'ログインすると、画像を作れます。' }
    if (res.status === 403) return { ok: false, tone: 'disabled', message: '画像の生成は準備中です。いまは使えません。' }
    if (res.status === 429) return { ok: false, tone: 'limit', message: typeof json.error === 'string' ? json.error : 'きょう作れる枚数の上限に達しました。' }
    if (res.status >= 500) return { ok: false, tone: 'error', message: '画像を作れませんでした。時間をおいて、もう一度お試しください。' }
    if (!res.ok || !Array.isArray(json.images)) return { ok: false, tone: 'error', message: typeof json.error === 'string' ? json.error : '画像を作れませんでした。' }
    return { ok: true, images: json.images }
  } catch {
    return { ok: false, tone: 'error', message: '通信できませんでした。接続を確かめて、もう一度お試しください。' }
  }
}

/** 残りの枚数の表示（数えられないときは出さない） */
export function remainingLabel(q: ImageQuota | null): string | null {
  if (!q || !q.enabled || q.remaining === null) return null
  return `きょう作れる残り：${q.remaining}枚（1日${q.perDay}枚まで）`
}
