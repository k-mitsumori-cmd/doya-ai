export type FinalAnswerRecovery = {
  sessionId: string
  recordingToken: string
  finalTranscriptId: string
  contextTranscriptIds: string[]
  question: string
  recentTranscript?: string
  language: 'ja' | 'en' | 'auto'
  savedAt: number
}

const PREFIX = 'cunning-final-answer:'
const MAX_AGE_MS = 30 * 60 * 1000 // The server enforces the shorter retry deadline.

type RecoveryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function storage(): RecoveryStorage | null {
  try { return sessionStorage } catch { return null }
}

function valid(value: unknown, sessionId: string, now: number): value is FinalAnswerRecovery {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const row = value as Partial<FinalAnswerRecovery>
  return row.sessionId === sessionId &&
    typeof row.recordingToken === 'string' && row.recordingToken.length > 0 && row.recordingToken.length <= 128 &&
    typeof row.finalTranscriptId === 'string' && row.finalTranscriptId.length > 0 && row.finalTranscriptId.length <= 128 &&
    typeof row.question === 'string' && row.question.trim().length > 0 && row.question.length <= 20000 &&
    (row.recentTranscript === undefined || (typeof row.recentTranscript === 'string' && row.recentTranscript.length <= 1000)) &&
    (row.language === 'ja' || row.language === 'en' || row.language === 'auto') &&
    Array.isArray(row.contextTranscriptIds) && row.contextTranscriptIds.length <= 64 &&
    row.contextTranscriptIds.every(id => typeof id === 'string' && id.length > 0 && id.length <= 128 && id !== row.finalTranscriptId) &&
    new Set(row.contextTranscriptIds).size === row.contextTranscriptIds.length &&
    typeof row.savedAt === 'number' && Number.isSafeInteger(row.savedAt) && row.savedAt <= now && now - row.savedAt <= MAX_AGE_MS
}

export function saveFinalAnswerRecovery(value: FinalAnswerRecovery, target = storage()): boolean {
  if (!target || !valid(value, value.sessionId, Date.now())) return false
  try { target.setItem(PREFIX + value.sessionId, JSON.stringify(value)); return true } catch { return false }
}

export function loadFinalAnswerRecovery(sessionId: string, target = storage(), now = Date.now()): FinalAnswerRecovery | null {
  if (!target) return null
  try {
    const raw = target.getItem(PREFIX + sessionId)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (valid(parsed, sessionId, now)) return parsed
    target.removeItem(PREFIX + sessionId)
  } catch { /* unavailable or malformed storage cannot authorize a retry */ }
  return null
}

export function clearFinalAnswerRecovery(sessionId: string, target = storage()): void {
  try { target?.removeItem(PREFIX + sessionId) } catch { /* storage unavailable */ }
}
