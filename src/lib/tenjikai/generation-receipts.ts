import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export const TENJIKAI_GENERATION_PREFIX = 'tenjikai-generate:v1:'
const OWNER_PREFIX = 'tenjikai-generate-owner:v1:'
const operationId = /^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const actorHash = (actor: string) => createHash('sha256').update(JSON.stringify(actor)).digest('hex')
export function generationReceiptPrefix(actor: string) {
  if (typeof actor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(actor)) throw Error('Invalid Tenjikai actor')
  return TENJIKAI_GENERATION_PREFIX + actorHash(actor) + ':'
}
/** Caller already holds the canonical User lock, as both account deletion paths do. */
export async function purgeGenerationReceipts(tx: Prisma.TransactionClient, actor: string) {
  const prefix = generationReceiptPrefix(actor), owner = actorHash(actor)
  const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } }, select: { key: true, value: true }, take: 513 })
  if (rows.length > 512) throw Error('Tenjikai receipt capacity inconsistent')
  for (const row of rows) {
    const id = row.key.slice(prefix.length)
    if (!operationId.test(id)) throw Error('Invalid Tenjikai receipt key')
    await tx.$queryRaw`SELECT 1::integer FROM pg_advisory_xact_lock(hashtext(${id})::bigint)`
    const key = OWNER_PREFIX + id
    const saved = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (!saved || saved.value !== owner) throw Error('Tenjikai operation owner unavailable')
    if ((await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count !== 1) throw Error('Tenjikai receipt changed')
    if ((await tx.systemSetting.deleteMany({ where: { key, value: owner } })).count !== 1) throw Error('Tenjikai owner changed')
  }
  // An index-only orphan has no dispatch authority, but must not outlive account deletion.
  await tx.systemSetting.deleteMany({ where: { key: { startsWith: OWNER_PREFIX }, value: owner } })
  return { count: rows.length }
}
