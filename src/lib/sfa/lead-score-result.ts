export interface LeadScoreResult {
  score: number
  reason: string
  nextAction: string
}

/** A missing or malformed model answer is a failed attempt, never a zero score. */
export function parseLeadScoreResult(value: unknown): LeadScoreResult {
  const fail = () => { throw new Error('AIスコアの形式を確認できませんでした。') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail()
  const r = value as Record<string, unknown>
  if (r.error !== undefined || r.code !== undefined || typeof r.score !== 'number' || !Number.isInteger(r.score) || r.score < 0 || r.score > 100) return fail()
  if (typeof r.reason !== 'string' || !r.reason.trim() || r.reason.length > 2000
    || typeof r.nextAction !== 'string' || !r.nextAction.trim() || r.nextAction.length > 2000) return fail()
  return { score: r.score, reason: r.reason.trim(), nextAction: r.nextAction.trim() }
}
