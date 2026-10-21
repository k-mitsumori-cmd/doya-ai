// GET /api/tenjikai/projects/[id] — 保存案件の所有者限定partial read
import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { privateApiJson } from '@/lib/private-api-response'
import { readTenjikaiProjectDetail } from '@/lib/tenjikai/project-detail-read'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const actorId = session?.user?.id
    if (typeof actorId !== 'string' || !actorId.trim()) {
      return privateApiJson({ state: 'not_authenticated' }, { status: 401 })
    }

    // 画面側のactor確認を補強する。認証は上の実セッションだけで行う。
    const expectedActor = request.nextUrl.searchParams.get('expectedActor')
    if (expectedActor !== null && expectedActor !== actorId) {
      return privateApiJson({ state: 'actor_mismatch' }, { status: 409 })
    }

    const { id } = await ctx.params
    const result = await readTenjikaiProjectDetail({ userId: actorId, db: prisma }, id)
    if (result.state === 'not_found') return privateApiJson(result, { status: 404 })
    if (result.state === 'error') return privateApiJson(result, { status: 500 })
    if (result.state === 'not_authenticated') return privateApiJson(result, { status: 401 })
    return privateApiJson({ ...result, actorId })
  } catch {
    return privateApiJson({ state: 'error', reason: 'read_failed' }, { status: 500 })
  }
}
