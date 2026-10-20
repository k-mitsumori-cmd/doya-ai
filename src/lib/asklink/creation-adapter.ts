import type { Adapter, AdapterUser } from 'next-auth/adapters'
import type { PrismaClient } from '@prisma/client'
import { deleteAskLinkAccount } from './account-cleanup'
import { deleteAccountWithRetirement } from '@/lib/account-retirement'

/** Preserve PrismaAdapter's direct User delete behavior while removing its new receipt metadata. */
export function withAskLinkReceiptCleanup(adapter: Adapter, db: Pick<PrismaClient, '$transaction'>): Adapter {
  return { ...adapter, deleteUser: async userId => {
    return db.$transaction(tx => deleteAccountWithRetirement(tx, userId, () => deleteAskLinkAccount(tx, userId, () => tx.user.delete({ where: { id: userId } }) as Promise<AdapterUser>)))
  } }
}
