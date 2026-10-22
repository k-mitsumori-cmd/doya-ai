// ============================================
// 日本時間（JST）の日付と月
// ============================================
// ミッションの「1日1回」と、月の上限の「今月」は、どちらも日本時間で区切る。
// ⚠️ サーバー（Vercel）は UTC で動く。new Date().getDate() などを直接使わない。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** 日本時間の日付（YYYY-MM-DD）。読めない日時は null */
export function jstDateKey(at: Date | number | string): string | null {
  const t = typeof at === 'number' ? at : new Date(at).getTime()
  if (!Number.isFinite(t)) return null
  const d = new Date(t + JST_OFFSET_MS)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** 日本時間の月（YYYY-MM）。読めない日時は null */
export function jstMonthKey(at: Date | number | string): string | null {
  const k = jstDateKey(at)
  return k ? k.slice(0, 7) : null
}

/** 日本時間で、その時刻を含む月の始まりと、次の月の始まり（どちらも UTC の Date） */
export function jstMonthRange(at: Date | number): { start: Date; end: Date } {
  const t = typeof at === 'number' ? at : at.getTime()
  const d = new Date(t + JST_OFFSET_MS)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  return {
    start: new Date(Date.UTC(y, m, 1) - JST_OFFSET_MS),
    end: new Date(Date.UTC(y, m + 1, 1) - JST_OFFSET_MS),
  }
}

/** 日本時間で、その時刻を含む日の始まりと、次の日の始まり */
export function jstDayRange(at: Date | number): { start: Date; end: Date } {
  const t = typeof at === 'number' ? at : at.getTime()
  const d = new Date(t + JST_OFFSET_MS)
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - JST_OFFSET_MS
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) }
}
