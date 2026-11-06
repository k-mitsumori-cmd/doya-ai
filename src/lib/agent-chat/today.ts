// ============================================
// 日本時間の日付まわり（画面とサーバーの両方で使う純粋な部品）
// ============================================

/** 日本時間の今日（YYYY-MM-DD） */
export function jstTodayYmd(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** 2026-11-05 → 2026年11月（形が違うときは空） */
export function monthLabelOf(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(ymd ?? '')
  return m ? `${m[1]}年${Number(m[2])}月` : ''
}

/** ¥1,000,000 の形 */
export function yenText(n: number | string | null | undefined): string {
  const v = typeof n === 'number' ? n : Number(String(n ?? '').replace(/[,\s¥円]/g, ''))
  return Number.isFinite(v) ? `¥${Math.round(v).toLocaleString('ja-JP')}` : '—'
}
