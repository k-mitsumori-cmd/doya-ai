import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { cancelGeneration, statusGeneration, validGenerationOperationId, GenerationOperationError } from '@/lib/tenjikai/generation-operation'
import { LifecycleError } from '@/lib/account-lifecycle/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function actor() {
  try { const session = await getServerSession(authOptions); return { id: session?.user?.id ?? null, unavailable: false } }
  catch { return { id: null, unavailable: true } }
}
function responseError(e: unknown, actorId: string | null) {
  if (e instanceof LifecycleError) return privateApiJson({ state: 'unavailable', actorId }, { status: e.status })
  if (e instanceof GenerationOperationError && e.status < 500) return privateApiJson({ state: 'unavailable', actorId, code: e.code }, { status: e.status })
  return privateApiJson({ state: 'unknown', actorId }, { status: 503 })
}
export async function GET(req: NextRequest) {
  const session = await actor(), actorId = session.id
  if (session.unavailable) return privateApiJson({ state: 'unknown', actorId: null }, { status: 503 })
  if (!actorId) return privateApiJson({ state: 'not_authenticated', actorId: null }, { status: 401 })
  const expected = req.nextUrl.searchParams.get('expectedActor')
  if (expected !== actorId) return privateApiJson({ state: 'actor_mismatch', actorId }, { status: 409 })
  const operationId = req.nextUrl.searchParams.get('operationId')
  if (!validGenerationOperationId(operationId)) return privateApiJson({ state: 'invalid', actorId }, { status: 400 })
  try { return privateApiJson({ actorId, ...await statusGeneration(actorId, operationId) }) }
  catch (e) { return responseError(e, actorId) }
}
export async function POST(req: NextRequest) {
  const session = await actor(), actorId = session.id
  if (session.unavailable) return privateApiJson({ state: 'unknown', actorId: null }, { status: 503 })
  if (!actorId) return privateApiJson({ state: 'not_authenticated', actorId: null }, { status: 401 })
  let body: unknown
  try { body = await req.json() } catch { return privateApiJson({ state: 'invalid', actorId }, { status: 400 }) }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return privateApiJson({ state: 'invalid', actorId }, { status: 400 })
  const input = body as Record<string, unknown>
  if (input.expectedActor !== actorId) return privateApiJson({ state: 'actor_mismatch', actorId }, { status: 409 })
  if (input.action !== 'cancel' || !validGenerationOperationId(input.operationId)) return privateApiJson({ state: 'invalid', actorId }, { status: 400 })
  try { return privateApiJson({ actorId, ...await cancelGeneration(actorId, input.operationId) }) }
  catch (e) { return responseError(e, actorId) }
}
