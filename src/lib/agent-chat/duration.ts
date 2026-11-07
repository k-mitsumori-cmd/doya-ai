// ============================================
// 「2時間30分」「45分」「1.5時間」のような時間の言い方を、時間と分に分ける（画面にも API にも依らない純粋な部品）
// ============================================
// 使う所: 残業の申請（kintai.request.overtime）。画面の「時間」と「分」の欄に入れる値を作る。
// 決まり: 読めない言い方は null を返す（呼ぶ側が聞き返す）。値を推測して作らない。
//   - 合計が 1分以上 1440分（24時間）以内のときだけ受け付ける（POST /api/kintai/requests の残業の判定と同じ範囲）
//   - 分が60以上のときは、時間に繰り上げる（90分 → 1時間30分）。画面の「分」の欄は 0〜59 だけ受け付けるため

export interface HoursMinutes { hours: number; minutes: number }

/** 時間の言い方を読む。例: 2時間30分 / 2時間半 / 45分 / 1.5時間 / 1時間 */
export function parseDuration(raw: string | null | undefined): HoursMinutes | null {
  const s = String(raw ?? '').normalize('NFKC').replace(/\s+/g, '')
  if (!s) return null
  const h = /(\d+(?:\.\d+)?)時間/.exec(s)
  const m = /(\d+(?:\.\d+)?)分/.exec(s)
  const half = /時間半/.test(s)
  // 「時間」「分」「半」のどれも無い言い方（数字だけなど）は、単位が分からないので読まない
  if (!h && !m) return null
  // 読めた部分以外に、数字や単位の続きが残る言い方は読まない（「2時間30分と少し」のような、足りない情報を作らないため）
  const rest = s.replace(/(\d+(?:\.\d+)?)時間半?/, '').replace(/(\d+(?:\.\d+)?)分/, '').replace(/(です|ほど|くらい|ぐらい|間|の残業)/g, '')
  if (/\d/.test(rest)) return null
  const total = Math.round((h ? parseFloat(h[1]) * 60 : 0) + (half ? 30 : 0) + (m ? parseFloat(m[1]) : 0))
  if (!Number.isFinite(total) || total < 1 || total > 1440) return null
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

/** 確認カードに出す言い方（2時間30分 / 45分 / 1時間）。時間も分も無いときは空 */
export function durationText(hours: string | number | null | undefined, minutes: string | number | null | undefined): string {
  const h = Number(hours) || 0
  const m = Number(minutes) || 0
  if (h <= 0 && m <= 0) return ''
  return `${h > 0 ? `${h}時間` : ''}${m > 0 ? `${m}分` : ''}`
}
