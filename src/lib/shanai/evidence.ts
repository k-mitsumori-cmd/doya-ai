// ============================================
// ドヤ社内インタビュー 根拠の検証
// ============================================
// ⚠️ AIが返した「引用」は、必ず原文に実在するか機械的に確かめる。
//    実在しない引用を持つ事実・プロフィール項目は保存しない（捏造を構造的に防ぐ）。

/** 照合用の正規化。全角半角・空白・句読点の揺れを吸収する */
export function normalizeForMatch(text: string): string {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[、，,。．.・「」『』（）()【】\[\]"'“”‘’!！?？:：;；…ー〜~-]/g, '')
}

/**
 * 引用が原文に含まれるか。
 * 長い引用は、AIが途中を少し言い換えることがあるため、前半・後半それぞれ20字が原文にあれば可とする。
 */
export function quoteExists(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote)
  if (q.length < 4) return false
  const s = normalizeForMatch(source)
  if (s.includes(q)) return true
  if (q.length >= 50) {
    const head = q.slice(0, 20)
    const tail = q.slice(-20)
    const hi = s.indexOf(head)
    return hi >= 0 && s.indexOf(tail, hi) > hi
  }
  return false
}
