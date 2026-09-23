import type { Prisma } from '@prisma/client'

/** Call under the User row lock. Preserve the old start-month attribution; the old
 * cumulative duration does not contain enough evidence to reconstruct month crossings.
 * New leases are excluded so rounding of durationSec can never inflate millisecond usage.
 */
export async function carryLegacyCunningUsage(tx: Prisma.TransactionClient, userId: string) {
  return tx.$executeRaw`
    INSERT INTO cunning_usage_allocations ("sessionId", "userId", "monthStart", "usedMs", "reservedMs")
    SELECT s.id, s."userId",
      date_trunc('month', s."startedAt" + INTERVAL '9 hours') - INTERVAL '9 hours',
      s."durationSec"::bigint * 1000, 0
    FROM cunning_sessions s
    WHERE s."userId" = ${userId} AND s."durationSec" > 0
      AND NOT EXISTS (SELECT 1 FROM cunning_recording_leases l WHERE l."sessionId" = s.id)
    ON CONFLICT ("sessionId", "monthStart") DO UPDATE
      SET "usedMs" = EXCLUDED."usedMs"
      WHERE cunning_usage_allocations."userId" = EXCLUDED."userId"
        AND cunning_usage_allocations."reservedMs" = 0
        AND cunning_usage_allocations."usedMs" < EXCLUDED."usedMs"
  `
}
