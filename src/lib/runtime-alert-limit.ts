import { randomUUID } from 'node:crypto'
import { prisma } from './prisma'

const WINDOW_MS = 10 * 60_000

export type RuntimeAlertClaim =
  | { state: 'allowed'; key: string; value: string }
  | { state: 'limited' | 'unavailable' }

/** One atomic budget per call site across Vercel instances. DB failure must not hide a server failure. */
export async function claimRuntimeAlert(sourceHash: string): Promise<RuntimeAlertClaim> {
  if (!/^[a-f0-9]{24}$/.test(sourceHash)) return { state: 'unavailable' }
  const key = `server-error:v1:${sourceHash}`
  const now = Date.now()
  const value = String(now + WINDOW_MS)
  try {
    const rows = await prisma.$queryRaw<Array<{ key: string }>>`
      INSERT INTO "SystemSetting" ("id", "key", "value")
      VALUES (${randomUUID()}, ${key}, ${value})
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value"
      WHERE CASE
        WHEN "SystemSetting"."value" ~ '^[0-9]{13}$'
          THEN "SystemSetting"."value"::bigint <= ${now}
        ELSE TRUE
      END
      RETURNING "key"
    `
    return rows.length ? { state: 'allowed', key, value } : { state: 'limited' }
  } catch {
    console.warn('[runtime-alert] shared throttle unavailable')
    return { state: 'unavailable' }
  }
}

/** Failed delivery must not consume the shared budget. Compare the exact claim to avoid deleting a newer one. */
export async function releaseRuntimeAlertClaim(claim: Extract<RuntimeAlertClaim, { state: 'allowed' }>): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM "SystemSetting" WHERE "key" = ${claim.key} AND "value" = ${claim.value}`
  } catch {
    console.warn('[runtime-alert] shared throttle release unavailable')
  }
}
