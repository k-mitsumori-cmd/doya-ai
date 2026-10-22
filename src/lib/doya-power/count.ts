// 件数（count など）の読み方。課金とハンドラが同じ値を使うために、1か所にまとめる（DB・セッションに触れない）

/**
 * 件数（count など）の読み方を1か所にまとめたもの。課金（units）とハンドラの両方がこれを使う。
 * - 未指定（undefined / null）は fallback
 * - 数、または数だけの文字列（"3"・" 3 "）は、整数に切り捨てて min〜max に収める
 * - ほかのもの（"4abc"・真偽・配列・NaN・Infinity・空文字）は null（呼び出し側は 400 で断る）
 */
export function parseCount(v: unknown, min: number, max: number, fallback: number): number | null {
  if (v === undefined || v === null) return fallback
  let n: number
  if (typeof v === 'number') n = v
  else if (typeof v === 'string' && /^\s*[+-]?\d+(\.\d+)?\s*$/.test(v)) n = Number(v)
  else return null
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, Math.floor(n)))
}
