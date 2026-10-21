import { readGenerationEnvelope } from './generation-client'

export type ClientOperationStatus = { actorId: string; operationId: string; state: 'missing' | 'reserved' | 'processing' | 'unknown' | 'completed' | 'degraded' | 'failed' | 'canceled' | 'superseded' | 'deleted'; projectId: string | null; analysis: 'saved' | 'unknown' | 'not_saved'; dispatchAllowed: boolean }
const states = ['missing', 'reserved', 'processing', 'unknown', 'completed', 'degraded', 'failed', 'canceled', 'superseded', 'deleted']
export function validOperationHandle(value: unknown): value is string { return typeof value === 'string' && /^\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) }
export function withGenerationOperation(href: string, operationId: string | null): string {
  if (!validOperationHandle(operationId)) return href
  const url = new URL(href, 'https://tenjikai.invalid')
  url.searchParams.set('operation', operationId)
  return url.pathname + url.search
}
function parse(body: unknown, actorId: string, operationId: string): ClientOperationStatus | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const r = body as Record<string, unknown>
  if (r.actorId !== actorId || r.operationId !== operationId || !states.includes(String(r.state)) || !(r.projectId === null || typeof r.projectId === 'string' && r.projectId.length > 0) || !['saved', 'unknown', 'not_saved'].includes(String(r.analysis)) || typeof r.dispatchAllowed !== 'boolean') return null
  return r as ClientOperationStatus
}
export async function readGenerationStatus(actorId: string, operationId: string, signal: AbortSignal): Promise<ClientOperationStatus | null> {
  const query = new URLSearchParams({ expectedActor: actorId, operationId })
  try {
    const result = await readGenerationEnvelope({ method: 'GET' }, signal, `/api/tenjikai/generate/status?${query}`)
    return result.ok ? parse(result.body, actorId, operationId) : null
  } catch { return null }
}
export async function cancelGenerationStatus(actorId: string, operationId: string, signal: AbortSignal): Promise<ClientOperationStatus | null> {
  try {
    const result = await readGenerationEnvelope({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedActor: actorId, operationId, action: 'cancel' }) }, signal, '/api/tenjikai/generate/status')
    return result.ok ? parse(result.body, actorId, operationId) : null
  } catch { return null }
}
