import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { cancelMissingWorkspaceSave, statusWorkspaceSave, WorkspaceSaveError } from '@/lib/tenjikai/workspace-save'
import { LifecycleError } from '@/lib/account-lifecycle/state'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: NextRequest, cancel: boolean) {
  let body: Record<string, unknown> | null = null
  try { const value: unknown = await request.json(); body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null } catch {}
  let actor: string | null = null
  try { actor = (await getServerSession(authOptions))?.user?.id ?? null }
  catch { return privateApiJson({ state: 'outcome_unknown' }, { status: 503 }) }
  if (!actor) return privateApiJson({ state: 'not_authenticated' }, { status: 401 })
  if (body?.expectedActor !== actor) return privateApiJson({ state: 'actor_mismatch' }, { status: 409 })
  try {
    const result = cancel
      ? await cancelMissingWorkspaceSave(actor, body?.operationId as string)
      : await statusWorkspaceSave(actor, body?.operationId as string)
    return privateApiJson({ ...result, actorId: actor })
  } catch (error) {
    if (error instanceof WorkspaceSaveError) return privateApiJson({ state: 'rejected', actorId: actor, code: error.code }, { status: error.status })
    if (error instanceof LifecycleError) return privateApiJson({ state: 'rejected', actorId: actor }, { status: error.status })
    return privateApiJson({ state: 'outcome_unknown', actorId: actor }, { status: 503 })
  }
}
export async function POST(request: NextRequest) { return handle(request, false) }
export async function DELETE(request: NextRequest) { return handle(request, true) }
