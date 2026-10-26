'use client'

// 画像生成の呼び出しと、きょう作れる残りの枚数。単発（ImageGenModal）とまとめて作る（BoothStudio）で共有する。
// ⚠️ 原価やモデルは扱わない（サーバーが決める）。利用者に見せるのは残りの枚数だけ。
import { useCallback, useEffect, useState } from 'react'

export type ImageGenKind = 'creative_image' | 'booth_render' | 'graphic_panel'

export type ImageGenFailure = { tone: 'error' | 'forbidden' | 'disabled' | 'limit'; message: string }
export type ImageGenResult = { ok: true; images: string[] } | ({ ok: false } & ImageGenFailure)

export interface ImageQuota {
  enabled: boolean
  /** 残りを数えられなかった（未ログイン・通信の失敗）。このときの enabled: false は「止めている」の意味ではない */
  unknown?: boolean
  /** きょう作れる残りの枚数。数えられないときは null */
  remaining: number | null
  perDay: number
}

export function useImageQuota() {
  const [quota, setQuota] = useState<ImageQuota | null>(null)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/tenjikai/image', { cache: 'no-store' })
      if (!res.ok) return setQuota({ enabled: false, unknown: true, remaining: null, perDay: 0 })
      setQuota(await res.json())
    } catch {
      setQuota({ enabled: false, unknown: true, remaining: null, perDay: 0 })
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])
  return { quota, refresh }
}

/** サーバーの設定（TENJIKAI_IMAGEGEN_ROLLOUT）で画像の生成を止めている・この人に許していないときの文言 */
export const IMAGEGEN_DISABLED_MESSAGE = '画像の生成は、管理者の設定でまだ止めています（準備中）。設定が済むまで、面の画像は作れません。'

/** サーバーが「止めている」と答えたか（未ログイン・通信の失敗は含めない） */
export function isImageGenDisabled(q: ImageQuota | null): boolean {
  return !!q && q.enabled === false && !q.unknown
}

export async function requestImages(input: { prompt: string; aspectRatio: string; kind: ImageGenKind; referencePng?: string; count?: number }): Promise<ImageGenResult> {
  try {
    const res = await fetch('/api/tenjikai/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, count: input.count ?? 1, approved: true }),
    })
    const json = await res.json().catch(() => ({}))
    // ステータスコードなどの技術的な文言は出さない（統合仕様 §11）。サーバーの文言（日本語で書いたもの）があれば、それを理由として出す
    const serverMessage = typeof json.error === 'string' && json.error ? json.error : null
    if (res.status === 401) return { ok: false, tone: 'forbidden', message: 'ログインすると、画像を作れます。' }
    if (res.status === 403) return { ok: false, tone: 'disabled', message: IMAGEGEN_DISABLED_MESSAGE }
    if (res.status === 402 || res.status === 429) return { ok: false, tone: 'limit', message: serverMessage ?? 'きょう作れる枚数の上限に達しました。' }
    if (res.status === 504) return { ok: false, tone: 'error', message: '時間がかかりすぎたため、途中で止まりました。もう一度お試しください。' }
    if (res.status >= 500) return { ok: false, tone: 'error', message: serverMessage ?? '画像を作れませんでした。時間をおいて、もう一度お試しください。' }
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
