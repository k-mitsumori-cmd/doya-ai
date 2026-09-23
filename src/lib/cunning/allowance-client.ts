/** A missing/invalid usage response must never mean unlimited recording. */
export function recordingAllowance(value: unknown): number {
  if (!value || typeof value !== 'object') throw new Error('利用状況を確認できませんでした。再試行してください。')
  const data = value as { remainingSeconds?: unknown; limits?: { maxMinutesPerMonth?: unknown } }
  const seconds = data.remainingSeconds
  const maxMinutes = data.limits?.maxMinutesPerMonth
  if (seconds === -1 && maxMinutes === -1) return -1
  if (typeof seconds === 'number' && Number.isSafeInteger(seconds) && seconds >= 0 &&
      typeof maxMinutes === 'number' && Number.isSafeInteger(maxMinutes) && maxMinutes >= 0 &&
      seconds <= maxMinutes * 60) return seconds
  throw new Error('利用状況を確認できませんでした。再試行してください。')
}
