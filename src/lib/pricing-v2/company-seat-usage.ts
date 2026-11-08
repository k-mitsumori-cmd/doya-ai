/** Company-wide identity union. No database, providers, enrollment or billing IO.
 * Adapters supply only operating memberships and usable invitation candidates
 * from organizations whose company attribution they have verified. Employee /
 * contact records and existing read-only guests are not operating accounts.
 * This module alone is not an admission guard or a complete usage reader.
 */
export type SeatUsageEntry = {
  companyId: string
  /** Globally qualified source row key, e.g. "hr:invite:<id>". */
  key: string
} & (
  | { kind: 'operator'; userId: string }
  | { kind: 'reservation'; email: string; startsAt: Date; expiresAt: Date | null }
  /** Preserve an unidentifiable legacy central active row conservatively.
   * Do not use its historical email to identify a current account. */
  | { kind: 'opaque' }
)

export type CurrentSeatUser = { id: string; email: string | null }

export class SeatUsageUnavailableError extends Error {
  constructor() { super('Company seat usage could not be verified'); this.name = 'SeatUsageUnavailableError' }
}

function emailKey(value: string | null): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

export type CompanySeatUsage = {
  used: number
  activeAccounts: number
  reservedAccounts: number
  unresolvedReservations: number
  opaqueRows: number
}

/** Match invitations only against the current User table, never a membership's
 * old email or an unverified pending userId. Case-ambiguous current emails do
 * not collapse distinct accounts or choose an arbitrary invitation recipient.
 * Unknown/ambiguous emails reserve their own seat until admission resolves the
 * actual account. Then recalculate the whole projected union under its guard.
 */
export function companySeatUsage(input: {
  companyId: string; ownerUserId: string; users: readonly CurrentSeatUser[];
  entries: readonly SeatUsageEntry[]; now: Date; excludedOperatingUserIds?: readonly string[]
}): CompanySeatUsage {
  const fail = (): never => { throw new SeatUsageUnavailableError() }
  if (!input.companyId || !input.ownerUserId || !Number.isFinite(input.now.getTime())) return fail()
  const users = new Map<string, CurrentSeatUser>()
  const emailUsers = new Map<string, Set<string>>()
  for (const user of input.users) {
    if (!user.id || users.has(user.id)) return fail()
    users.set(user.id, user)
    const email = emailKey(user.email)
    if (email) {
      const ids = emailUsers.get(email) ?? new Set<string>()
      ids.add(user.id); emailUsers.set(email, ids)
    }
  }
  if (!users.has(input.ownerUserId)) return fail()
  const excluded = new Set(input.excludedOperatingUserIds ?? [])
  if ([...excluded].some(id => typeof id !== 'string' || !id || id === input.ownerUserId)) return fail()
  const active = new Set([input.ownerUserId])
  const reserved = new Set<string>(), unresolved = new Set<string>(), opaque = new Set<string>()
  const keys = new Set<string>()
  for (const entry of input.entries) {
    if (entry.companyId !== input.companyId || !entry.key || keys.has(entry.key)) return fail()
    keys.add(entry.key)
    if (entry.kind === 'operator') {
      // A missing account must not silently make an occupied seat disappear.
      if (!entry.userId || !users.has(entry.userId)) return fail()
      if (!excluded.has(entry.userId)) active.add(entry.userId)
    } else if (entry.kind === 'opaque') {
      opaque.add(entry.key)
    } else if (entry.kind === 'reservation') {
      const start = entry.startsAt.getTime(), end = entry.expiresAt?.getTime()
      if (!Number.isFinite(start) || (end !== undefined && (!Number.isFinite(end) || end <= start))) return fail()
      if (start > input.now.getTime() || (end !== undefined && end <= input.now.getTime())) continue
      const email = emailKey(entry.email)
      if (!email) return fail()
      const ids = emailUsers.get(email)
      if (ids?.size === 1) {
        const userId = ids.values().next().value!
        if (!excluded.has(userId)) reserved.add(userId)
      }
      else unresolved.add(email)
    } else return fail()
  }
  for (const userId of active) reserved.delete(userId)
  return {
    used: active.size + reserved.size + unresolved.size + opaque.size,
    activeAccounts: active.size, reservedAccounts: reserved.size,
    unresolvedReservations: unresolved.size, opaqueRows: opaque.size,
  }
}
