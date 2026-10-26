// 有料の確認の「1日の上限」。その日の累計の見込み額が上限に届いたら、残りの確認は回さない。
// 累計は SystemSetting（watch:v1:paid-spend:<日本時間の日付>）に円で残す。
import { prisma } from '@/lib/prisma'

/** 1日の上限（円）。ユーザーの承認は「1日 約10円」（2026-10-26） */
export const DAILY_CAP_YEN = 10

export const jstDay = (now = Date.now()) => new Date(now + 9 * 3_600_000).toISOString().slice(0, 10)
const key = (day: string) => `watch:v1:paid-spend:${day}`

export type SpendState = { yen: number; runs: { id: string; yen: number; at: string }[] }

/** 次の確認を回してよいか（純粋関数）。すでに上限に届いていたら回さない。 */
export function canSpend(spent: number, cap = DAILY_CAP_YEN): boolean {
  return spent < cap
}

/** この費用の確認を、上限を超えずに回せるか（純粋関数）。累計＋この確認の費用が上限以下なら回せる */
export function fitsDailyCap(spent: number, costYen: number, cap = DAILY_CAP_YEN): boolean {
  return spent + costYen <= cap + 1e-9
}

export async function readSpend(day = jstDay()): Promise<SpendState> {
  const row = await prisma.systemSetting.findUnique({ where: { key: key(day) } })
  if (!row) return { yen: 0, runs: [] }
  try { return JSON.parse(row.value) as SpendState } catch { return { yen: 0, runs: [] } }
}

export async function addSpend(id: string, yen: number, day = jstDay()): Promise<SpendState> {
  const now = await readSpend(day)
  const next: SpendState = { yen: Math.round((now.yen + yen) * 1000) / 1000, runs: [...now.runs, { id, yen, at: new Date().toISOString() }].slice(-50) }
  const value = JSON.stringify(next)
  await prisma.systemSetting.upsert({ where: { key: key(day) }, create: { key: key(day), value }, update: { value } })
  return next
}
