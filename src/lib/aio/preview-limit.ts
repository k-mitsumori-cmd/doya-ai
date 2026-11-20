// ドヤAIO：確認画面の読み取りの回数制限（1人あたり）。
// サーバーレスのため、同じインスタンスの中だけで数える簡易版。厳密な上限ではなく、連打による費用の増加を抑える。
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 8
const hits = new Map<string, number[]>()

export function allowAioPreview(userKey: string, now = Date.now()): boolean {
  const recent = (hits.get(userKey) || []).filter(t => now - t < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) { hits.set(userKey, recent); return false }
  recent.push(now)
  hits.set(userKey, recent)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < WINDOW_MS)) hits.delete(k)
  return true
}
