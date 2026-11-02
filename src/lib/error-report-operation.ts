import { createHash } from 'node:crypto'
import { prisma } from './prisma'
import type { ErrorReportInput } from './error-report-input'

type State = { digest: string; state: 'sending' | 'sent' | 'uncertain'; startedAt: number }
export type ErrorReportOutcome = 'sent' | 'pending' | 'uncertain' | 'conflict' | 'limited' | 'unavailable'

/** Store only a digest/receipt, never report text, raw URL, IP or credentials in settings. */
export async function submitErrorReport(input: ErrorReportInput, subject: string, admit: () => Promise<'allowed' | 'limited' | 'unavailable'>, deliver: () => Promise<void>): Promise<ErrorReportOutcome> {
  if (!/^[A-Za-z0-9_-]{22}$/.test(subject)) return 'unavailable'
  const key = `error-report:v1:${subject}:${input.reportId}`
  const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const outcome = (value: string): ErrorReportOutcome => {
    try {
      const state = JSON.parse(value) as State
      if (state.digest !== digest) return 'conflict'
      return state.state === 'sent' ? 'sent' : state.state === 'sending' && Number.isFinite(state.startedAt) && Date.now() - state.startedAt < 120000 ? 'pending' : 'uncertain'
    } catch { return 'unavailable' }
  }
  const existing = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (existing) return outcome(existing.value)
  const admission = await admit()
  if (admission !== 'allowed') return admission
  const startedAt = Date.now()
  const value = JSON.stringify({ digest, state: 'sending', startedAt } satisfies State)
  try {
    await prisma.systemSetting.create({ data: { key, value } })
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) throw error
    const raced = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
    return raced ? outcome(raced.value) : 'unavailable'
  }
  // A failed/uncertain delivery is never automatically sent again with this report ID.
  let state: State['state'] = 'uncertain'
  try { await deliver(); state = 'sent' } catch { /* Keep the entered text in the UI; do not claim success. */ }
  const saved = await prisma.systemSetting.updateMany({ where: { key, value }, data: { value: JSON.stringify({ digest, state, startedAt } satisfies State) } })
  return saved.count === 1 ? state : 'uncertain'
}
