import { readBillingResponse } from '@/lib/billing-response-client'
import { parseAioBillingRead, type AioBillingRead } from './billing-navigation'
import { validWorkspaceSlug } from '@/lib/organization-workspace-selection'

export class AioNavigationReadError extends Error {
  constructor(public readonly status: number) { super('AIO billing scope unavailable') }
}

export async function readAioBillingNavigation(actorId: string, slug: string | null, signal: AbortSignal): Promise<AioBillingRead> {
  if (!actorId || actorId.length > 128 || slug !== null && !validWorkspaceSlug(slug)) throw Error('AIO billing scope unavailable')
  const url = `/api/aio/billing-navigation${slug === null ? '' : `?org=${encodeURIComponent(slug)}`}`
  const response = await readBillingResponse(url, { method: 'GET', headers: { 'X-Aio-Actor-Id': actorId } }, signal)
  if (!response.ok || response.data.code !== undefined || response.data.error !== undefined) throw new AioNavigationReadError(response.status)
  return parseAioBillingRead(response.data, actorId, slug)
}
