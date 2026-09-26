/** SFA の期日は時刻ではなく、日本時間の暦日として扱う。 */
export function jstDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = typeof value === 'string' ? new Date(value) : value
  if (!Number.isFinite(date.getTime())) return null
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function isJstOverdue(dueDate: string | null, now = new Date()): boolean {
  const dueDay = jstDateKey(dueDate)
  const today = jstDateKey(now)
  return !!dueDay && !!today && dueDay < today
}
