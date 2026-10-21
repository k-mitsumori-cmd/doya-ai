export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAioBilling } from '@/lib/aio/billing'
import { getAioContext, orgSlugFrom, listMembershipsFor } from '@/lib/aio/access'

// GET /api/aio/me — 入口/サイドバー用。認証・オンボーディング状態・所属組織を返す。
// ※Cookie認証なのでクライアントの useSession status に依存せず呼べる。
export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  const expectedActor = _req.headers.get('X-Aio-Actor-Id')
  if (!userId) {
    return privateApiJson({ authenticated: false, actorId: null, onboarded: false, memberships: [], ...(expectedActor !== null ? { code: 'ACTOR_REQUIRED' } : {}) }, { status: expectedActor !== null ? 401 : 200 })
  }
  if (expectedActor !== null && expectedActor !== userId) {
    return privateApiJson({ error: 'ログイン状態が変わりました。もう一度確認してください。', code: 'ACTOR_CHANGED' }, { status: 409 })
  }

  // userId 既知のため再解決せず、独立クエリは並列実行
  const [memberships, user] = await Promise.all([
    listMembershipsFor(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true, name: true } }),
  ])
  const requestedOrg = orgSlugFrom(_req)
  let organizationPlan: string | null = null
  if (requestedOrg) {
    const ctx = await getAioContext(requestedOrg)
    if (!ctx) return privateApiJson({ error: '組織にアクセスできません' }, { status: 403 })
    const billing = await getAioBilling(prisma, ctx.organizationId)
    if (!billing) return privateApiJson({ error: '組織の契約情報を確認できません', code: 'BILLING_OWNER' }, { status: 409 })
    organizationPlan = billing.plan
  }
  return privateApiJson(
    {
      authenticated: true,
      actorId: userId,
      onboarded: memberships.length > 0,
      memberships,
      plan: organizationPlan ?? user?.plan ?? 'FREE',
      name: user?.name || null,
    }
  )
}
