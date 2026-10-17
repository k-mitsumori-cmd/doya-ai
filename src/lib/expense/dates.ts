// ============================================
// ドヤ支出管理: 日付の計算（純粋関数）
// ============================================
// ⚠️ 日付は 'YYYY-MM-DD'（JST の暦日）の文字列で扱う。Date のタイムゾーンずれを持ち込まない。
//    DB（@db.Date）との出し入れは toDbDate / fromDbDate だけを通す。
// ⚠️ 日の指定 31 は「その月の末日」と解釈する（収入側 dates.ts と同じ規則。設計書 §5.4）

export type Ymd = string // 'YYYY-MM-DD'
export type Ym = string // 'YYYY-MM'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

export function ymd(y: number, m: number, d: number): Ymd {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`
}

export function parseYmd(s: Ymd): { y: number; m: number; d: number } {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m, d }
}

export function isYmd(v: unknown): v is Ymd {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const { y, m, d } = parseYmd(v)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function isYm(v: unknown): v is Ym {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 日の指定（1〜31）をその月で実在する日に丸める。31 は末日 */
export function clampDay(y: number, m: number, day: number): number {
  return Math.min(Math.max(1, day), daysInMonth(y, m))
}

/** 月を足す（y, m は 1 始まり） */
export function addMonthsYm(y: number, m: number, n: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + n
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 }
}

export function ymOf(date: Ymd): Ym {
  return date.slice(0, 7)
}

export function firstOfMonth(ym: Ym): Ymd {
  return `${ym}-01`
}

export function addMonthsToYm(ym: Ym, n: number): Ym {
  const [y, m] = ym.split('-').map(Number)
  const r = addMonthsYm(y, m, n)
  return `${pad(r.y, 4)}-${pad(r.m)}`
}

/** a から b まで何か月か（b - a） */
export function monthsBetween(a: Ym, b: Ym): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

export function addDays(date: Ymd, n: number): Ymd {
  const { y, m, d } = parseYmd(date)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function diffDays(from: Ymd, to: Ymd): number {
  const a = parseYmd(from)
  const b = parseYmd(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

/** 今日（JST） */
export function todayJst(now: Date = new Date()): Ymd {
  const t = new Date(now.getTime() + 9 * 3_600_000)
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

export function toDbDate(date: Ymd): Date {
  const { y, m, d } = parseYmd(date)
  return new Date(Date.UTC(y, m - 1, d))
}

export function fromDbDate(date: Date): Ymd {
  return ymd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export type PayTerms = {
  /** 締め日（1〜31。31 = 月末） */
  closingDay: number
  /** 締めた月から何か月後に払うか（0 = 当月） */
  months: number
  /** 支払日（1〜31。31 = 月末） */
  payDay: number
}

/**
 * 発生日（利用日・請求の基準日）から、口座から出る日を計算する。
 * 1. 発生日以後で最初の締め日を探す
 * 2. 締めた月から months か月後の payDay
 * 例: 月末締め翌月末払い（31/1/31）で 10/20 → 11/30
 *     カード 15 日締め翌月 10 日引落（15/1/10）で 10/20 → 11/15 締め → 12/10
 */
export function payDateFor(eventDate: Ymd, terms: PayTerms): Ymd {
  const { y, m, d } = parseYmd(eventDate)
  let closeY = y
  let closeM = m
  if (d > clampDay(y, m, terms.closingDay)) {
    const n = addMonthsYm(y, m, 1)
    closeY = n.y
    closeM = n.m
  }
  const pay = addMonthsYm(closeY, closeM, terms.months)
  return ymd(pay.y, pay.m, clampDay(pay.y, pay.m, terms.payDay))
}
