import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { saveTenjikaiWorkspace, WorkspaceSaveError } from '@/lib/tenjikai/workspace-save'
import { TenjikaiRevisionError } from '@/lib/tenjikai/project-revision'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, ctx: Ctx) {
  let body: Record<string, unknown> | null = null
  try { const value: unknown = await request.json(); body = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null } catch {}
  let actor: string | null = null
  try { actor = (await getServerSession(authOptions))?.user?.id ?? null }
  catch { return privateApiJson({ state: 'outcome_unknown' }, { status: 503 }) }
  if (!actor) return privateApiJson({ state: 'not_authenticated' }, { status: 401 })
  if (body?.expectedActor !== actor) return privateApiJson({ state: 'actor_mismatch' }, { status: 409 })
  const { id } = await ctx.params
  try {
    const status = await saveTenjikaiWorkspace(actor, id, body.operationId as string, body.expectedRevision as string, body.patch)
    return privateApiJson({ state: status.state, actorId: actor, projectId: id, operationId: status.operationId,
      resultRevision: status.resultRevision, workspace: status.workspace }, { status: status.state === 'committed' ? 200 : 409 })
  } catch (error) {
    if (error instanceof WorkspaceSaveError || error instanceof TenjikaiRevisionError) {
      return privateApiJson({ state: 'rejected', actorId: actor, projectId: id, code: error.code }, { status: error.status })
    }
    if (error instanceof LifecycleError) return privateApiJson({ state: 'rejected', actorId: actor, projectId: id }, { status: error.status })
    return privateApiJson({ state: 'outcome_unknown', actorId: actor, projectId: id }, { status: 503 })
  }
}
