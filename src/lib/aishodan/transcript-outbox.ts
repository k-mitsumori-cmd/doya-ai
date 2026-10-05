'use client'

// Only unacknowledged text is retained, until the server's retention deadline.
// Audio, contact information and provider credentials are never stored here.
export interface PendingTurn {
  id: string
  speaker: 'ai' | 'guest'
  text: string
  startMs: number
  phase?: string | null
}
export interface TranscriptOutbox {
  roomToken: string
  sessionId: string
  expiresAt: number
  finishRequested: boolean
  turns: PendingTurn[]
}
const PREFIX = 'aishodan-transcript-outbox:v1:'
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value)
function key(roomToken: string, sessionId: string) { return `${PREFIX}${roomToken}:${sessionId}` }
function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage } catch { return null }
}
function valid(value: unknown): value is TranscriptOutbox {
  if (!value || typeof value !== 'object') return false
  const v = value as TranscriptOutbox
  return validId(v.roomToken) && validId(v.sessionId) && Number.isSafeInteger(v.expiresAt) &&
    typeof v.finishRequested === 'boolean' && Array.isArray(v.turns) && v.turns.length <= 3000 &&
    v.turns.every(t => t && validId(t.id) && t.id.length <= 128 && ['ai', 'guest'].includes(t.speaker) &&
      typeof t.text === 'string' && !!t.text.trim() && t.text.length <= 8000 &&
      Number.isSafeInteger(t.startMs) && t.startMs >= 0 && t.startMs <= 2147483647 &&
      (t.phase == null || typeof t.phase === 'string' && t.phase.length <= 40))
}
export function storeTranscriptOutbox(entry: TranscriptOutbox): boolean {
  const db = storage()
  if (!db || !valid(entry)) return false
  try {
    const name = key(entry.roomToken, entry.sessionId)
    if (entry.expiresAt <= Date.now()) {
      db.removeItem(name)
      return !entry.turns.length && !entry.finishRequested
    }
    if (!entry.turns.length && !entry.finishRequested) db.removeItem(name)
    else {
      // Pick fields explicitly; callers may pass richer transcript objects.
      const value = JSON.stringify({ roomToken: entry.roomToken, sessionId: entry.sessionId,
        expiresAt: entry.expiresAt, finishRequested: entry.finishRequested,
        turns: entry.turns.map(t => ({ id: t.id, speaker: t.speaker, text: t.text, startMs: t.startMs, phase: t.phase ?? null })) })
      if (value.length > 1000000) return false
      db.setItem(name, value)
    }
    return true
  } catch { return false }
}
export function removeTranscriptOutbox(roomToken: string, sessionId: string): boolean {
  try { const db = storage(); if (!db) return false; db.removeItem(key(roomToken, sessionId)); return true } catch { return false }
}
export function pendingTranscriptOutboxes(roomToken: string): TranscriptOutbox[] {
  const db = storage()
  if (!db) throw new Error('transcript_storage_unavailable')
  if (!validId(roomToken)) return []
  const entries: TranscriptOutbox[] = []
  try {
    const names = Array.from({ length: db.length }, (_, i) => db.key(i)).filter((name): name is string => !!name && name.startsWith(PREFIX))
    for (const name of names) {
      let entry: unknown
      const raw = db.getItem(name)
      try { entry = JSON.parse(raw || 'null') } catch { db.removeItem(name); continue }
      if (!valid(entry) || key(entry.roomToken, entry.sessionId) !== name || entry.expiresAt <= Date.now()) { db.removeItem(name); continue }
      if (entry.roomToken === roomToken) entries.push(entry)
    }
  } catch { throw new Error('transcript_storage_unavailable') }
  return entries
}

/** Recover saved text and an explicitly requested end; never restart audio. */
export async function recoverTranscriptOutboxes(roomToken: string): Promise<boolean> {
  try {
    for (const initial of pendingTranscriptOutboxes(roomToken)) {
      let current: TranscriptOutbox | undefined = initial
      while (current && (current.turns.length || current.finishRequested)) {
        const batch: PendingTurn[] = current.turns.slice(0, 50)
        const ending = !batch.length && current.finishRequested
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 15000)
        try {
          const response = await fetch(`/api/aishodan/room/${roomToken}/${ending ? 'end' : 'turn'}`, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: current.sessionId, ...(ending ? {} : { turns: batch }) }),
          })
          if ([403, 404, 410].includes(response.status)) {
            if (!removeTranscriptOutbox(roomToken, current.sessionId)) return false
            break
          }
          if (!response.ok) return false
          const result = await response.json().catch(() => null)
          if (ending ? result?.skipped || !['completed', 'evaluated', 'aborted', 'expired'].includes(result?.status) : result?.saved !== batch.length) return false
          // Re-read before acknowledging, preserving any answers added meanwhile.
          const latest = pendingTranscriptOutboxes(roomToken).find(e => e.sessionId === current!.sessionId)
          if (!latest) break
          if (ending) {
            if (latest.turns.length) return false
            if (!removeTranscriptOutbox(roomToken, latest.sessionId)) return false
            break
          }
          const accepted: Map<string, PendingTurn> = new Map(batch.map(t => [t.id, t]))
          current = { ...latest, turns: latest.turns.filter(t => {
            const original = accepted.get(t.id)
            return !original || original.text !== t.text || original.speaker !== t.speaker ||
              original.startMs !== t.startMs || (original.phase ?? null) !== (t.phase ?? null)
          }) }
          if (!storeTranscriptOutbox(current)) return false
        } catch { return false } finally { clearTimeout(timeout) }
      }
    }
    return true
  } catch { return false }
}
