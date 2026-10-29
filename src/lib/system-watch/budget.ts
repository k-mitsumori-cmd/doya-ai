// 有料の確認の「1日の上限」。その日の累計の見込み額が上限に届いたら、残りの確認は回さない。
// 累計は SystemSetting（watch:v1:paid-spend:<日本時間の日付>）に円で残す。
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

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

async function readFrom(db: Pick<Prisma.TransactionClient, 'systemSetting'>, day: string): Promise<SpendState> {
  const row = await db.systemSetting.findUnique({ where: { key: key(day) } })
  if (!row) return { yen: 0, runs: [] }
  const state = JSON.parse(row.value) as SpendState
  if (!state || !Number.isFinite(state.yen) || state.yen < 0 || !Array.isArray(state.runs)
    || state.runs.some(run => !run || typeof run.id !== 'string' || !Number.isFinite(run.yen) || typeof run.at !== 'string')) {
    throw new Error('Invalid system watch spend state')
  }
  return state
}

export async function readSpend(day = jstDay()): Promise<SpendState> {
  return readFrom(prisma, day)
}

async function writeSpend(tx: Prisma.TransactionClient, id: string, yen: number, day: string, now: SpendState): Promise<SpendState> {
  const next: SpendState = { yen: Math.round((now.yen + yen) * 1000) / 1000, runs: [...now.runs, { id, yen, at: new Date().toISOString() }].slice(-50) }
  if (next.yen < 0) throw new Error('Invalid system watch spend adjustment')
  const value = JSON.stringify(next)
  await tx.systemSetting.upsert({ where: { key: key(day) }, create: { key: key(day), value }, update: { value } })
  return next
}

export type SpendReservation = { ok: true; spent: number; day: string } | { ok: false; spent: number; reason: 'cap' }

/** 別のcron/手動リクエストとも、同じ日の上限判定と予約をDBロック内で一度に行う。 */
export async function reserveSpend(id: string, yen: number, day = jstDay()): Promise<SpendReservation> {
  if (!Number.isFinite(yen) || yen <= 0) throw new Error('Invalid system watch spend amount')
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key(day)}))`
    const now = await readFrom(tx, day)
    if (!fitsDailyCap(now.yen, yen)) return { ok: false as const, spent: now.yen, reason: 'cap' as const }
    await writeSpend(tx, id, yen, day, now)
    return { ok: true as const, spent: now.yen, day }
  }, { maxWait: 10_000, timeout: 10_000 })
}

/** 返却も同じロックを使う。予約した日を渡し、日付をまたいでも別の日の枠を減らさない。 */
export async function addSpend(id: string, yen: number, day = jstDay()): Promise<SpendState> {
  if (!Number.isFinite(yen)) throw new Error('Invalid system watch spend amount')
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key(day)}))`
    return writeSpend(tx, id, yen, day, await readFrom(tx, day))
  }, { maxWait: 10_000, timeout: 10_000 })
}
