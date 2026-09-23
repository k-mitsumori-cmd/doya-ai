export function personaUsageDay(now: Date): Date {
  const local = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - 9 * 60 * 60 * 1000)
}
