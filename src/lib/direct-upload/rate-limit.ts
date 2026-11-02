// 署名付きURLの発行回数の制限（同じ持ち主が短時間に大量に発行するのを止める）。
// ⚠️ メモリ上の窓なので、サーバーレスの各インスタンスごとの数え方（全体の厳密な上限ではない）。
//    全体の上限は、バケットの fileSizeLimit と、送信セッションの数の上限（multipart.ts）が受け持つ。

const hits = new Map<string, number[]>()

/** 窓の中の回数が limit を超えていたら false。超えていなければ数えて true */
export function allowIssue(key: string, limit = 30, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (arr.length >= limit) {
    hits.set(key, arr)
    return false
  }
  arr.push(now)
  hits.set(key, arr)
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (v.every(t => now - t >= windowMs)) hits.delete(k)
  }
  return true
}
