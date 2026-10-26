// 確認の結果と前回までの状態から、「何を知らせるか」と「次の状態」を決める（純粋関数）。
// - 同じ失敗は間引く: 決めた回数だけ続いたら1回知らせ、その後は REPEAT_MS ごとに回数を添えて知らせ直す
// - 失敗の中身（状態コード・エラーの種類）が変わったら、すぐ知らせ直す
// - 知らせた失敗が直ったら「直りました」を知らせる。知らせる前に直った揺れは知らせない
import type { CheckResult, CheckState, WatchEvent } from './types'

export const REPEAT_MS = 6 * 3_600_000

/** 失敗の見分け。時刻や件数の違いでは変わらないよう、状態コードとエラーの先頭だけを使う。 */
export function failureSignature(r: Pick<CheckResult, 'status' | 'error'>): string {
  const head = (r.error ?? '').replace(/\d+/g, '#').slice(0, 60)
  return `${r.status ?? '-'}|${head}`
}

export function decide(
  results: CheckResult[],
  previous: Record<string, CheckState | undefined>,
  thresholds: Record<string, number>,
  now: string,
  repeatMs: Record<string, number> = {},
): { events: WatchEvent[]; next: Record<string, CheckState> } {
  const events: WatchEvent[] = []
  const next: Record<string, CheckState> = {}
  const nowMs = Date.parse(now)

  for (const r of results) {
    const prev = previous[r.id]
    const threshold = Math.max(1, thresholds[r.id] ?? 1)

    if (r.observed !== undefined && prev?.observed !== undefined && prev.observed !== r.observed) {
      events.push({ type: 'observed-change', result: r, before: prev.observed })
    }

    if (r.ok) {
      if (prev && !prev.ok && prev.notifiedAt) {
        events.push({ type: 'recovery', result: r, downSince: prev.since, failCount: prev.failCount })
      }
      next[r.id] = { ok: true, failCount: 0, since: prev?.ok ? prev.since : now, notifiedAt: null, observed: r.observed ?? prev?.observed }
      continue
    }

    const failCount = prev && !prev.ok ? prev.failCount + 1 : 1
    const since = prev && !prev.ok ? prev.since : now
    const signature = failureSignature(r)
    let notifiedAt = prev && !prev.ok ? prev.notifiedAt : null
    let reason: 'new' | 'repeat' | 'changed' | null = null
    if (failCount >= threshold) {
      if (!notifiedAt) reason = 'new'
      else if (prev?.signature && prev.signature !== signature) reason = 'changed'
      else if (nowMs - Date.parse(notifiedAt) >= (repeatMs[r.id] ?? REPEAT_MS)) reason = 'repeat'
    }
    const state: CheckState = { ok: false, failCount, since, notifiedAt, signature, lastError: r.error, observed: r.observed ?? prev?.observed }
    if (reason) {
      state.notifiedAt = now
      notifiedAt = now
      events.push({ type: 'failure', result: r, state, reason })
    }
    next[r.id] = state
  }

  // 今回の確認に無い（消した・名前を変えた）確認の状態は持ち越さない
  return { events, next }
}
