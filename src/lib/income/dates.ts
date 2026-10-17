// ============================================
// ドヤ収入管理: 暦日の計算（締め日・支払期日・月の足し引き）
// ============================================
// ⚠️ 日付はすべて JST の暦日 'YYYY-MM-DD' 文字列で扱う（設計書 §12 Q10）。
//    Date のまま月を足すと、タイムゾーンと月末（31日→翌月1日）でずれる。
//    DB（@db.Date）との出し入れは toDbDate / fromDbDate だけを使う。

export type Ymd = string

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 31 などの「月末」指定を表す日。daysInMonth 以上は末日として扱う */
export const MONTH_END = 31

export function isYmd(value: unknown): value is Ymd {
  if (typeof value !== 'string') return false
  const m = YMD_RE.exec(value)
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month)
}

export function parseYmd(value: Ymd): { y: number; m: number; d: number } {
  const match = YMD_RE.exec(value)
  if (!match || !isYmd(value)) throw new Error(`日付の形式が正しくありません: ${value}`)
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

export function formatYmd(y: number, m: number, d: number): Ymd {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** 年月に月数を足す（日は持たない） */
export function addMonthsYm(y: number, m: number, months: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + months
  return { y: Math.floor(index / 12), m: (index % 12) + 1 }
}

/** その月の day 日。day が月の日数以上なら末日 */
export function dayOrEnd(y: number, m: number, day: number): Ymd {
  return formatYmd(y, m, Math.min(Math.max(1, day), daysInMonth(y, m)))
}

export function startOfMonth(ymd: Ymd): Ymd {
  const { y, m } = parseYmd(ymd)
  return formatYmd(y, m, 1)
}

export function endOfMonth(ymd: Ymd): Ymd {
  const { y, m } = parseYmd(ymd)
  return formatYmd(y, m, daysInMonth(y, m))
}

/** 月を足す。日は足した先の月の日数に丸める（1/31 + 1か月 = 2/28） */
export function addMonths(ymd: Ymd, months: number): Ymd {
  const { y, m, d } = parseYmd(ymd)
  const next = addMonthsYm(y, m, months)
  return dayOrEnd(next.y, next.m, d)
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const { y, m, d } = parseYmd(ymd)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** a から b までの日数（b - a） */
export function diffDays(a: Ymd, b: Ymd): number {
  const pa = parseYmd(a)
  const pb = parseYmd(b)
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000)
}

/** 'YYYY-MM' */
export function monthKey(ymd: Ymd): string {
  return ymd.slice(0, 7)
}

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

/** JST の今日 */
export function todayJst(now: Date = new Date()): Ymd {
  return new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10)
}

/** @db.Date に入れる値（UTC 0 時） */
export function toDbDate(ymd: Ymd): Date {
  parseYmd(ymd)
  return new Date(`${ymd}T00:00:00.000Z`)
}

/** @db.Date から読んだ値を暦日に戻す */
export function fromDbDate(date: Date): Ymd {
  return date.toISOString().slice(0, 10)
}

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土']

export function weekdayJa(ymd: Ymd): string {
  const { y, m, d } = parseYmd(ymd)
  return WEEKDAYS_JA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

export type PaymentTerms = {
  /** 締め日。31 = 月末 */
  closingDay: number
  /** 締めの何か月後に払うか。1 = 翌月 */
  paymentMonths: number
  /** 支払日。31 = 月末 */
  paymentDay: number
}

export function isValidPaymentTerms(t: PaymentTerms): boolean {
  return (
    Number.isInteger(t.closingDay) && t.closingDay >= 1 && t.closingDay <= MONTH_END &&
    Number.isInteger(t.paymentMonths) && t.paymentMonths >= 0 && t.paymentMonths <= 6 &&
    Number.isInteger(t.paymentDay) && t.paymentDay >= 1 && t.paymentDay <= MONTH_END
  )
}

/** 請求日が属する締めの日（請求日が締め日を過ぎていれば翌月の締め日） */
export function closingDateFor(issueDate: Ymd, closingDay: number): Ymd {
  const { y, m, d } = parseYmd(issueDate)
  const thisMonth = dayOrEnd(y, m, closingDay)
  if (d <= parseYmd(thisMonth).d) return thisMonth
  const next = addMonthsYm(y, m, 1)
  return dayOrEnd(next.y, next.m, closingDay)
}

/**
 * 支払期日。例: 月末締め翌月末払い = { closingDay: 31, paymentMonths: 1, paymentDay: 31 }
 * 支払日が締め日より前になる場合（当月払い・締め 20 日で 10 日払い など）は、その次の支払日にする。
 * 土日祝の調整はしない（設計書 §12 Q5）。
 */
export function dueDateFor(issueDate: Ymd, terms: PaymentTerms): Ymd {
  if (!isValidPaymentTerms(terms)) throw new Error('支払条件が正しくありません')
  const closing = closingDateFor(issueDate, terms.closingDay)
  const c = parseYmd(closing)
  const target = addMonthsYm(c.y, c.m, terms.paymentMonths)
  let due = dayOrEnd(target.y, target.m, terms.paymentDay)
  if (due < closing) {
    const next = addMonthsYm(target.y, target.m, 1)
    due = dayOrEnd(next.y, next.m, terms.paymentDay)
  }
  return due
}

/** 表示用: 「月末締め 翌月末払い」 */
export function describePaymentTerms(t: PaymentTerms): string {
  const day = (n: number) => (n >= MONTH_END ? '末' : `${n}日`)
  const month = t.paymentMonths === 0 ? '当月' : t.paymentMonths === 1 ? '翌月' : t.paymentMonths === 2 ? '翌々月' : `${t.paymentMonths}か月後の`
  return `${t.closingDay >= MONTH_END ? '月末' : `${t.closingDay}日`}締め ${month}${day(t.paymentDay)}払い`
}
