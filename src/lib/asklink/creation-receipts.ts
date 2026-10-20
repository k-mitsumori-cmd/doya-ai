import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export const ASKLINK_CREATION_PREFIX = 'asklink-create:v2:'
export function askLinkCreationReceiptPrefix(actor: string) {
  return ASKLINK_CREATION_PREFIX + createHash('sha256').update(JSON.stringify(actor)).digest('hex') + ':'
}
/** Same transaction and lock order as User deletion and creation admission/settle. */
export async function purgeAskLinkCreationReceipts(tx: Prisma.TransactionClient, actor: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actor} FOR UPDATE`
  return tx.systemSetting.deleteMany({ where: { key: { startsWith: askLinkCreationReceiptPrefix(actor) } } })
}
