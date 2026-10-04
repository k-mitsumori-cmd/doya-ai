import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { FreeLimitKey } from '@/lib/plan-limit'

type LedgerDb = Pick<Prisma.TransactionClient, 'systemSetting'>

function usageKey(key: FreeLimitKey, organizationId: string, period: 'lifetime' | 'monthly', now: Date): string {
  const subject = createHash('sha256').update(organizationId).digest('hex')
  const month = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7)
  return `org-quota:v1:${key}:${subject}:${period === 'lifetime' ? 'all' : month}`
}

/** Keep the larger of the surviving rows and the deletion-resistant admission ledger. */
export async function getOrganizationQuotaUsage(
  db: LedgerDb,
  key: FreeLimitKey,
  organizationId: string,
  period: 'lifetime' | 'monthly',
  countLive: () => Promise<number>,
  now = new Date(),
): Promise<number> {
  const [live, row] = await Promise.all([
    countLive(),
    db.systemSetting.findUnique({ where: { key: usageKey(key, organizationId, period, now) }, select: { value: true } }),
  ])
  if (!Number.isSafeInteger(live) || live < 0) throw new Error('Organization usage count invalid')
  if (row && !/^(0|[1-9]\d*)$/.test(row.value)) throw new Error('Organization usage ledger invalid')
  const saved = row ? Number(row.value) : 0
  if (!Number.isSafeInteger(saved)) throw new Error('Organization usage ledger invalid')
  return Math.max(live, saved)
}

/** Call after creating the billable row, in the same serializable transaction. */
export async function recordOrganizationQuotaUsage(
  tx: Prisma.TransactionClient,
  key: FreeLimitKey,
  organizationId: string,
  usedLifetime: number,
  usedMonthly: number,
  now = new Date(),
): Promise<void> {
  for (const [period, used] of [['lifetime', usedLifetime], ['monthly', usedMonthly]] as const) {
    const ledgerKey = usageKey(key, organizationId, period, now)
    await tx.systemSetting.upsert({
      where: { key: ledgerKey },
      create: { key: ledgerKey, value: String(used + 1) },
      update: { value: String(used + 1) },
    })
  }
}
