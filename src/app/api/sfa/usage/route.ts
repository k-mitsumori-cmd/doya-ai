export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, listMemberships, orgSlugFrom } from '@/lib/sfa/access'
import { sfaOwnerPlanTier } from '@/lib/sfa/limits'

// GET /api/sfa/usage — オンボーディング判定＋プラン＋件数＋所属ワークスペース一覧
export async function GET(req: NextRequest) {
  const memberships = await listMemberships()
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) {
    return NextResponse.json({ onboarded: false, memberships }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const [plan, accounts, deals, leads, openTasks] = await Promise.all([
    sfaOwnerPlanTier(prisma, ctx.organizationId),
    prisma.sfaAccount.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
    prisma.sfaDeal.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
    prisma.sfaLead.count({ where: { organizationId: ctx.organizationId, isActive: true } }),
    prisma.sfaTask.count({ where: { organizationId: ctx.organizationId, status: 'open' } }),
  ])

  return NextResponse.json(
    {
      onboarded: true,
      plan,
      role: ctx.role,
      organization: { id: ctx.organizationId, slug: ctx.organizationSlug },
      memberships,
      counts: { accounts, deals, leads, openTasks },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
