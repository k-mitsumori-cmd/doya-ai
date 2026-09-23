export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
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
  if (!userId) {
    return NextResponse.json({ authenticated: false, onboarded: false, memberships: [] }, { headers: { 'Cache-Control': 'no-store' } })
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
    if (!ctx) return NextResponse.json({ error: '組織にアクセスできません' }, { status: 403 })
    const billing = await getAioBilling(prisma, ctx.organizationId)
    if (!billing) return NextResponse.json({ error: '組織の契約情報を確認できません', code: 'BILLING_OWNER' }, { status: 409 })
    organizationPlan = billing.plan
  }
  return NextResponse.json(
    {
      authenticated: true,
      onboarded: memberships.length > 0,
      memberships,
      plan: organizationPlan ?? user?.plan ?? 'FREE',
      name: user?.name || null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
