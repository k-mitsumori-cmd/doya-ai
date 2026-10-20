import type { Adapter, AdapterUser } from 'next-auth/adapters'
import type { PrismaClient } from '@prisma/client'
import { purgeAskLinkCreationReceipts } from './creation-receipts'

/** Preserve PrismaAdapter's direct User delete behavior while removing its new receipt metadata. */
export function withAskLinkReceiptCleanup(adapter: Adapter, db: Pick<PrismaClient, '$transaction'>): Adapter {
  return { ...adapter, deleteUser: async userId => {
    return db.$transaction(async tx => {
      await purgeAskLinkCreationReceipts(tx, userId)
      return tx.user.delete({ where: { id: userId } }) as Promise<AdapterUser>
    })
  } }
}
