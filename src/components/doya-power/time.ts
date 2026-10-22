// ============================================
// ドヤパワー — 日本時間の日付と、回復の時刻の言い方
// ============================================
// ⚠️ 日付の区切りは日本時間（Asia/Tokyo）。利用者の端末のタイムゾーンでは決めない。
// ⚠️ 時刻はサーバーとクライアントで同じ文字になるよう、タイムゾーンを固定して書く。

const JST = 'Asia/Tokyo'

function toDate(v: Date | string | number): Date {
  return v instanceof Date ? v : new Date(v)
}

/** 日本時間の日付の文字（YYYY-MM-DD）。1日1回の判定に使う */
export function jstDateKey(v: Date | string | number = Date.now()): string {
  const d = toDate(v)
  if (Number.isNaN(d.getTime())) return ''
  // en-CA は YYYY-MM-DD の形で出る
  return new Intl.DateTimeFormat('en-CA', { timeZone: JST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

/** 日本時間の時刻（例: 6:00） */
export function jstTime(v: Date | string | number): string {
  const d = toDate(v)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('ja-JP', { timeZone: JST, hour: 'numeric', minute: '2-digit' }).format(d)
}

/** 日本時間の日付と時刻（例: 10月20日（火）6:00）。どの日に見ても同じ文字になる */
export function jstDateTime(v: Date | string | number): string {
  const d = toDate(v)
  if (Number.isNaN(d.getTime())) return ''
  const day = new Intl.DateTimeFormat('ja-JP', { timeZone: JST, month: 'long', day: 'numeric' }).format(d)
  const wd = new Intl.DateTimeFormat('ja-JP', { timeZone: JST, weekday: 'short' }).format(d)
  return `${day}（${wd}）${jstTime(d)}`
}

/**
 * 回復の時刻を、今から見た言い方にする（今日 6:00 / 明日 6:00 / 10月22日（木）6:00）。
 * now を渡さないときは、どの日に見ても同じ文字（日付つき）にする
 */
export function recoveryLabel(at: Date | string | number, now?: Date | string | number): string {
  if (now === undefined) return jstDateTime(at)
  const a = jstDateKey(at)
  const today = jstDateKey(now)
  if (!a || !today) return jstDateTime(at)
  if (a === today) return `今日 ${jstTime(at)}`
  const tomorrow = jstDateKey(toDate(now).getTime() + 24 * 60 * 60 * 1000)
  if (a === tomorrow) return `明日 ${jstTime(at)}`
  return jstDateTime(at)
}
