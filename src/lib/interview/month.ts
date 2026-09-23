/** Japan has a fixed UTC+09:00 offset and no daylight-saving transition. */
export function interviewJstMonthStartUtc(now = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000)
}
