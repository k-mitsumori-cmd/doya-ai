import type { NextRequest } from 'next/server'
import { getAskLinkUserId } from '@/lib/asklink/access'
import { AskLinkCreationError, recoverAskLinkCreation, validAskLinkCreationId } from '@/lib/asklink/creation-operation'
import { askLinkCreationResponse, askLinkCreationErrorResponse } from '@/lib/asklink/creation-response'
import { readAskLinkCreationBody } from '@/lib/asklink/creation-http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60
type Ctx = { params: Promise<{ operationId: string }> }
async function handle(req: NextRequest, ctx: Ctx, actor: string | null, finish: boolean) {
  if (!actor) throw new AskLinkCreationError(401, 'ACTOR_UNAVAILABLE')
  const expectedActor = req.headers.get('X-Asklink-Actor-Id')
  if (expectedActor === null) throw new AskLinkCreationError(428, 'ACTOR_REQUIRED')
  if (expectedActor !== actor) throw new AskLinkCreationError(403, 'ACTOR_CHANGED')
  const { operationId } = await ctx.params
  if (!validAskLinkCreationId(operationId) || new URL(req.url).searchParams.size) throw new AskLinkCreationError(400, 'INVALID_OPERATION')
  if (finish) await readAskLinkCreationBody(req, true)
  return askLinkCreationResponse(actor, await recoverAskLinkCreation({ actor, operationId }, finish))
}
export async function GET(req: NextRequest, ctx: Ctx) {
  try { return await handle(req, ctx, await getAskLinkUserId(), false) }
  catch (error) { return askLinkCreationErrorResponse(error) }
}
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try { return await handle(req, ctx, await getAskLinkUserId(), true) }
  catch (error) { return askLinkCreationErrorResponse(error) }
}
