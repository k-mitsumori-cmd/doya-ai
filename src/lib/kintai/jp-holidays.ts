// ============================================
// 日本の祝日（国民の祝日に関する法律の決まりから計算する。2026-10-27）
// ============================================
// 勤怠のインフォグラフィックで「今日までの平日（祝日を除く）」を数えるために使う。
// - 日付が決まっている祝日、ハッピーマンデー（第n月曜）、春分・秋分（1980〜2099年の近似式）、
//   振替休日（祝日が日曜なら、次の祝日でない日）、国民の休日（祝日に挟まれた平日）を計算する
// - 一覧を書かないので、年が変わっても古くならない。ただし法律が変わったとき（臨時の祝日・移動）は、ここを直す
// ⚠️ 会社ごとの休み（夏休み・年末年始）は含まない

const pad = (n: number) => String(n).padStart(2, '0')
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** その月の第 n 月曜日の日 */
function nthMonday(y: number, m: number, n: number): number {
  const first = new Date(y, m - 1, 1).getDay()
  const firstMonday = 1 + ((8 - first) % 7)
  return firstMonday + (n - 1) * 7
}

/** 春分の日・秋分の日（1980〜2099年の近似式） */
function equinox(y: number, spring: boolean): number {
  const base = spring ? 20.8431 : 23.2488
  return Math.floor(base + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))
}

/** その年の祝日（'YYYY-MM-DD' の集合）。2020年以降の決まりで計算する */
export function jpHolidays(y: number): Set<string> {
  const base: [number, number][] = [
    [1, 1], [2, 11], [2, 23], [4, 29], [5, 3], [5, 4], [5, 5], [8, 11], [11, 3], [11, 23],
    [1, nthMonday(y, 1, 2)], // 成人の日
    [7, nthMonday(y, 7, 3)], // 海の日
    [9, nthMonday(y, 9, 3)], // 敬老の日
    [10, nthMonday(y, 10, 2)], // スポーツの日
    [3, equinox(y, true)],
    [9, equinox(y, false)],
  ]
  const set = new Set(base.map(([m, d]) => key(y, m, d)))
  const isHol = (dt: Date) => set.has(key(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()))
  // 国民の休日: 前後の日がどちらも祝日の平日（敬老の日と秋分の日の間など）
  for (let m = 1; m <= 12; m++) {
    const last = new Date(y, m, 0).getDate()
    for (let d = 1; d <= last; d++) {
      const dt = new Date(y, m - 1, d)
      if (isHol(dt) || dt.getDay() === 0) continue
      const prev = new Date(y, m - 1, d - 1), next = new Date(y, m - 1, d + 1)
      if (isHol(prev) && isHol(next)) set.add(key(y, m, d))
    }
  }
  // 振替休日: 祝日が日曜なら、そのあとの最初の祝日でない日
  for (const k of [...set]) {
    const [yy, mm, dd] = k.split('-').map(Number)
    const dt = new Date(yy, mm - 1, dd)
    if (dt.getDay() !== 0) continue
    const sub = new Date(yy, mm - 1, dd + 1)
    while (isHol(sub)) sub.setDate(sub.getDate() + 1)
    if (sub.getFullYear() === y) set.add(key(y, sub.getMonth() + 1, sub.getDate()))
  }
  return set
}

/** その月の、土日と祝日を除いた日の数（untilDay を渡すと、その日まで） */
export function businessDaysOf(year: number, month: number, untilDay?: number): number {
  const hol = jpHolidays(year)
  const last = new Date(year, month, 0).getDate()
  const end = untilDay ? Math.min(untilDay, last) : last
  let n = 0
  for (let d = 1; d <= end; d++) {
    const w = new Date(year, month - 1, d).getDay()
    if (w !== 0 && w !== 6 && !hol.has(key(year, month, d))) n++
  }
  return n
}
