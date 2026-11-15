// 弊社、限界につき。の利用通知の集計と回数制限。既存の SystemSetting テーブルだけを使う（スキーマの変更は要らない）。
// キー: heisha-act:v1:<YYYYMMDD>:count / kind-<種別> / len-n / len-sum、heisha-act-id:v1:<YYYYMMDD>:<eventId>（重複の判定）。
// 日付は3つ目の ':' 区切りに置く（古いキーを消すときに使う）。
import { randomUUID } from 'node:crypto'
import { prisma } from './prisma'
import { jstDayKey } from './server-daily-quota'
import { HEISHA_RECORD_KINDS, type HeishaDayStats, type HeishaRecordKind } from './heisha-activity-format'

const K = (day: string, name: string) => `heisha-act:v1:${day}:${name}`

async function incr(key: string, by: number): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ value: string }>>`
    INSERT INTO "SystemSetting" ("id", "key", "value") VALUES (${randomUUID()}, ${key}, ${String(by)})
    ON CONFLICT ("key") DO UPDATE SET "value" = (("SystemSetting"."value")::bigint + ${by})::text
    RETURNING "value"
  `
  return Number(rows[0]?.value ?? 0)
}

/** 同じ eventId の2回目以降は false（今日の分だけ見る。端末の再送は当日中に起きる前提）。 */
export async function claimHeishaEvent(eventId: string, day = jstDayKey()): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    INSERT INTO "SystemSetting" ("id", "key", "value") VALUES (${randomUUID()}, ${`heisha-act-id:v1:${day}:${eventId}`}, '1')
    ON CONFLICT ("key") DO NOTHING RETURNING "key"
  `
  return rows.length > 0
}

export async function releaseHeishaEvent(eventId: string, day = jstDayKey()): Promise<void> {
  await prisma.$executeRaw`DELETE FROM "SystemSetting" WHERE "key" = ${`heisha-act-id:v1:${day}:${eventId}`}`
}

/** 1件を数え、当日の件数を返す。 */
export async function countHeishaSave(kind: HeishaRecordKind, length: number | null, day = jstDayKey()): Promise<number> {
  const total = await incr(K(day, 'count'), 1)
  await incr(K(day, `kind-${kind}`), 1)
  if (length !== null) { await incr(K(day, 'len-n'), 1); await incr(K(day, 'len-sum'), length) }
  return total
}

/** Slack に送れなかったときに、数えた分を戻す（端末の再送で二重に数えないため）。 */
export async function uncountHeishaSave(kind: HeishaRecordKind, length: number | null, day = jstDayKey()): Promise<void> {
  await incr(K(day, 'count'), -1)
  await incr(K(day, `kind-${kind}`), -1)
  if (length !== null) { await incr(K(day, 'len-n'), -1); await incr(K(day, 'len-sum'), -length) }
}

/** 1日分の集計を読む。day は YYYYMMDD。 */
export async function readHeishaDay(day: string): Promise<HeishaDayStats> {
  const rows = await prisma.$queryRaw<Array<{ key: string; value: string }>>`
    SELECT "key", "value" FROM "SystemSetting" WHERE "key" LIKE ${`heisha-act:v1:${day}:%`}
  `
  const v: Record<string, number> = {}
  for (const r of rows) v[r.key.split(':')[3] ?? ''] = Math.max(0, Number(r.value) || 0)
  const byKind: HeishaDayStats['byKind'] = {}
  for (const k of [...HEISHA_RECORD_KINDS, 'unspecified'] as HeishaRecordKind[]) if (v[`kind-${k}`]) byKind[k] = v[`kind-${k}`]
  return { day: `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`, total: v['count'] ?? 0, byKind, lengthCount: v['len-n'] ?? 0, lengthSum: v['len-sum'] ?? 0 }
}

/** 3日より古い集計と重複判定のキーを消す。 */
export async function purgeOldHeishaKeys(today = jstDayKey()): Promise<number> {
  const d = new Date(Date.UTC(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8)) - 2 * 86400000)
  const cutoff = d.toISOString().slice(0, 10).replace(/-/g, '')
  return prisma.$executeRaw`
    DELETE FROM "SystemSetting" WHERE "key" LIKE 'heisha-act%' AND split_part("key", ':', 3) < ${cutoff}
  `
}

export function jstDayKeyOffset(offsetDays: number, now = Date.now()): string {
  return jstDayKey(now + offsetDays * 86400000)
}
