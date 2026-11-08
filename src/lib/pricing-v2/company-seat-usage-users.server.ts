import { Prisma } from '@prisma/client'
import { companySeatUsage, SeatUsageUnavailableError, type SeatUsageEntry } from './company-seat-usage'

/** Only the current User table can resolve a reserved email to an account.
 * Bounded batches retain all case-ambiguous matches; historical member emails
 * and caller-supplied pending userIds are not identity evidence. No writes,
 * enrollment, Stripe/cache calls or invitation claiming occur here.
 *
 * This is the identity lookup adapter, NOT the company/tool attribution and
 * eligible-row collector. Its caller must supply the complete verified union
 * in the coordinator transaction. Email-writer coordination remains separate.
 */
export async function readCompanySeatUsageUsers(tx: Pick<Prisma.TransactionClient, '$queryRaw'>, input: {
  companyId: string; ownerUserId: string; entries: readonly SeatUsageEntry[]; now: Date; enforcedGuestAccounts?: readonly { id: string; email: string | null }[]
}) {
  const ids = [...new Set([input.ownerUserId, ...(input.enforcedGuestAccounts ?? []).map(user => user.id), ...input.entries.flatMap(entry => entry.kind === 'operator' ? [entry.userId] : [])])]
  const emails = [...new Set(input.entries.flatMap(entry => entry.kind === 'reservation' ? [entry.email.trim().toLowerCase()] : []))]
  const users = new Map<string, { id: string; email: string | null }>()
  const batchSize = 250
  for (let offset = 0; offset < Math.max(ids.length, emails.length); offset += batchSize) {
    const idBatch = ids.slice(offset, offset + batchSize), emailBatch = emails.slice(offset, offset + batchSize)
    const byId = idBatch.length ? Prisma.sql`id IN (${Prisma.join(idBatch)})` : Prisma.sql`FALSE`
    const byEmail = emailBatch.length ? Prisma.sql`LOWER(BTRIM(email)) IN (${Prisma.join(emailBatch)})` : Prisma.sql`FALSE`
    const rows = await tx.$queryRaw<Array<{ id: string; email: string | null }>>`
      SELECT id, email FROM "User" WHERE (${byId}) OR (${byEmail})
      ${input.enforcedGuestAccounts?.length ? Prisma.sql`ORDER BY id FOR SHARE` : Prisma.empty}
    `
    for (const user of rows) users.set(user.id, user)
  }
  // The collector's preview decision and this current-identity snapshot must
  // agree. Shared User locks hold that email through a guarded write's commit.
  const excludedOperatingUserIds: string[] = []
  for (const guest of input.enforcedGuestAccounts ?? []) {
    if (!guest.id || guest.id === input.ownerUserId) throw new SeatUsageUnavailableError()
    const current = users.get(guest.id)
    if (!current) continue // a successfully confirmed deleted account cannot operate
    if ((current.email ?? '').trim().toLowerCase() !== (guest.email ?? '').trim().toLowerCase()) throw new SeatUsageUnavailableError()
    excludedOperatingUserIds.push(guest.id)
  }
  const keys = new Set<string>()
  for (const entry of input.entries) {
    if (entry.companyId !== input.companyId || !entry.key || keys.has(entry.key) ||
      (entry.kind === 'operator' && !entry.userId)) throw new SeatUsageUnavailableError()
    keys.add(entry.key)
  }
  // Several legacy membership tables have no User FK. After real account
  // deletion their rows can remain, but that absent account cannot operate.
  // Only a successful current-User lookup can establish this absence; query
  // errors still fail closed, unknown pending emails still reserve a seat, and
  // missing owners still fail in the pure validator. This grants no access.
  const currentEntries = input.entries.filter(entry => entry.kind !== 'operator' || users.has(entry.userId))
  return companySeatUsage({ ...input, entries: currentEntries, users: [...users.values()], excludedOperatingUserIds })
}
