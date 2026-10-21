import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { privateApiJson } from '@/lib/private-api-response'
import { readFullTenjikaiWorkspace } from '@/lib/tenjikai/workspace-store'
import { readTenjikaiProjectDetail } from '@/lib/tenjikai/project-detail-read'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const actorId = session?.user?.id
    if (typeof actorId !== 'string' || !actorId) return privateApiJson({ state: 'not_authenticated' }, { status: 401 })
    if (request.nextUrl.searchParams.get('expectedActor') !== actorId) return privateApiJson({ state: 'actor_mismatch' }, { status: 409 })
    const { id } = await ctx.params
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return privateApiJson({ state: 'not_found' }, { status: 404 })
    const workspace = await readFullTenjikaiWorkspace(actorId, id)
    if (workspace) return privateApiJson({ state: 'ready_full', actorId, projectId: id, workspace })
    const partial = await readTenjikaiProjectDetail({ userId: actorId, db: prisma }, id)
    if (partial.state === 'not_found') return privateApiJson({ state: 'not_found' }, { status: 404 })
    if (partial.state !== 'ready_partial') return privateApiJson({ state: 'unavailable' }, { status: 503 })
    return privateApiJson({ state: 'ready_partial', actorId, projectId: id, coverage: 'partial' })
  } catch {
    return privateApiJson({ state: 'unavailable' }, { status: 503 })
  }
}
