// 自動点検（B1）が作った記録の ID を、複数の月をまたいで読む（図鑑の累計・年間レポートの年の数えで使う）。
// 記録の ID は月ごとのキーに残っている（marked-records.ts）。自動点検は 2026-10 に始めたので、それより前の月は読まない。
import { markedKey, type MarkedKind } from './marked-records'

/** 自動点検を始めた月（日本時間）。これより前に ID は無い */
export const SYSTEM_WATCH_FIRST_MONTH = '2026-10'

type SettingReadDb = { systemSetting: { findMany(args: { where: { key: { in: string[] } }; select: { value: true } }): Promise<{ value: string }[]> } }

/** from〜to（日本時間の YYYY-MM、両端を含む）の月の一覧。始めた月より前は含めない */
export function monthsBetween(from: string, to: string): string[] {
  const start = from < SYSTEM_WATCH_FIRST_MONTH ? SYSTEM_WATCH_FIRST_MONTH : from
  const out: string[] = []
  let [y, m] = start.split('-').map(Number)
  for (let i = 0; i < 240; i++) {
    const cur = `${y}-${String(m).padStart(2, '0')}`
    if (cur > to) break
    out.push(cur)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

/** 日本時間の YYYY-MM */
function jstMonthOf(at: Date): string {
  return new Date(at.getTime() + 9 * 3_600_000).toISOString().slice(0, 7)
}

/** from〜to の期間に自動点検が作った記録の ID（範囲は組織 ID か userId） */
export async function systemWatchRecordIdsBetween(db: SettingReadDb, kind: MarkedKind, scopeIds: string[], from: Date, to: Date = new Date()): Promise<string[]> {
  if (!scopeIds.length) return []
  const months = monthsBetween(jstMonthOf(from), jstMonthOf(to))
  if (!months.length) return []
  const keys = scopeIds.flatMap(s => months.map(m => markedKey(kind, s, m)))
  const rows = await db.systemSetting.findMany({ where: { key: { in: keys } }, select: { value: true } })
  return rows.flatMap(r => {
    try {
      const v = JSON.parse(r.value)
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  })
}

/** 自動点検を始めてから今までの ID（図鑑の累計で使う） */
export function systemWatchRecordIdsAll(db: SettingReadDb, kind: MarkedKind, scopeIds: string[], now: Date = new Date()): Promise<string[]> {
  return systemWatchRecordIdsBetween(db, kind, scopeIds, new Date(`${SYSTEM_WATCH_FIRST_MONTH}-01T00:00:00+09:00`), now)
}
