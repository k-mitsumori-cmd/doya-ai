export function encodeCunningCursor(row: { id: string; createdAt: Date }): string {
  return Buffer.from(JSON.stringify({ id: row.id, at: row.createdAt.toISOString() })).toString('base64url')
}
export function decodeCunningCursor(value: string): { id: string; createdAt: Date } {
  if (!value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor')
  const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (!data || typeof data.id !== 'string' || !data.id || data.id.length > 128 || typeof data.at !== 'string') throw new Error('Invalid cursor')
  const date = new Date(data.at)
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== data.at) throw new Error('Invalid cursor')
  return { id: data.id, createdAt: date }
}

export type CunningTranscriptCursor = {
  id: string; createdAt: Date; orderAt: Date; audioWindowSequence: number | null; sessionId: string; revision: Date
}
export function encodeCunningTranscriptCursor(row: { id: string; createdAt: Date; audioReceivedAt: Date | null; audioWindowSequence?: number | null }, sessionId: string, revision: Date): string {
  return Buffer.from(JSON.stringify({ v: 3, id: row.id, at: row.createdAt.toISOString(), orderAt: (row.audioReceivedAt ?? row.createdAt).toISOString(), sequence: row.audioWindowSequence ?? null, sid: sessionId, rev: revision.toISOString() })).toString('base64url')
}
export function decodeCunningTranscriptCursor(value: string): CunningTranscriptCursor {
  if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid cursor')
  const data = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  if (!data || data.v !== 3 || [data.id, data.sid].some(x => typeof x !== 'string' || !x || x.length > 128)) throw new Error('Invalid cursor')
  if (data.sequence !== null && (!Number.isSafeInteger(data.sequence) || data.sequence < 0 || data.sequence > 2147483646)) throw new Error('Invalid cursor')
  const dates = [data.at, data.orderAt, data.rev].map(value => {
    if (typeof value !== 'string') throw new Error('Invalid cursor')
    const date = new Date(value)
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new Error('Invalid cursor')
    return date
  })
  return { id: data.id, sessionId: data.sid, createdAt: dates[0], orderAt: dates[1], audioWindowSequence: data.sequence, revision: dates[2] }
}
