export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { withSfaRecordRead } from '@/lib/sfa/record-authority'
import { sfaRecordWhere } from '@/lib/sfa/record-policy'
import { SfaMutationError } from '@/lib/sfa/mutation-authority'
import { getSfaContext, listMemberships, orgSlugFrom } from '@/lib/sfa/access'
import { sfaOwnerPlanTier } from '@/lib/sfa/limits'

// GET /api/sfa/usage — オンボーディング判定＋プラン＋件数＋所属ワークスペース一覧
export async function GET(req: NextRequest) {
  try {
  const memberships = await listMemberships()
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) {
    return NextResponse.json({ onboarded: false, memberships }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }

  return await withSfaRecordRead(ctx, async (tx, scope) => {
  const [plan, accounts, deals, leads, openTasks] = await Promise.all([
    sfaOwnerPlanTier(tx, ctx.organizationId),
    tx.sfaAccount.count({ where: sfaRecordWhere(scope, 'account') }),
    tx.sfaDeal.count({ where: sfaRecordWhere(scope, 'deal') }),
    tx.sfaLead.count({ where: sfaRecordWhere(scope, 'lead') }),
    tx.sfaTask.count({ where: sfaRecordWhere(scope, 'task', false, { status: 'open' }) }),
  ])

  return NextResponse.json(
    {
      onboarded: true,
      plan,
      role: scope.actor.role,
      organization: { id: ctx.organizationId, slug: ctx.organizationSlug },
      memberships,
      counts: { accounts, deals, leads, openTasks },
    },
    { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } }
  )
  })
  } catch (error) {
    return NextResponse.json({ error: '利用状況を取得できませんでした。再度読み込んでください。' }, { status: error instanceof SfaMutationError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
  }
}
