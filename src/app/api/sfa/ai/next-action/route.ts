export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { suggestNextAction } from '@/lib/sfa/ai'
import { ACTIVITY_TYPE_LABEL } from '@/lib/sfa/constants'
import type { ActivityType } from '@/lib/sfa/types'

// POST /api/sfa/ai/next-action — 商談の「次の一手」＋失注リスクをAI提案
// body: { dealId }
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const dealId = (body.dealId as string)?.trim()
  if (!dealId) return NextResponse.json({ error: 'dealId は必須です' }, { status: 400 })

  // IDOR対策
  const deal = await prisma.sfaDeal.findUnique({ where: { id: dealId } })
  if (!deal || deal.organizationId !== ctx.organizationId) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }

  const [account, stage, activities] = await Promise.all([
    deal.accountId
      ? prisma.sfaAccount.findFirst({ where: { id: deal.accountId, organizationId: ctx.organizationId }, select: { name: true } })
      : null,
    deal.stageId ? prisma.sfaStage.findUnique({ where: { id: deal.stageId }, select: { name: true } }) : null,
    prisma.sfaActivity.findMany({
      where: { organizationId: ctx.organizationId, dealId: deal.id },
      orderBy: { occurredAt: 'desc' },
      take: 8,
      select: { type: true, subject: true, body: true, occurredAt: true },
    }),
  ])

  const days = deal.lastActivityAt
    ? Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / 86400000)
    : null

  try {
    const result = await suggestNextAction({
      dealName: deal.name,
      accountName: account?.name || null,
      amount: Number(deal.amount),
      stageName: stage?.name || null,
      probability: deal.probability,
      daysSinceLastActivity: days,
      recentActivities: activities.map((a) => {
        const label = ACTIVITY_TYPE_LABEL[a.type as ActivityType] || a.type
        return `${label}: ${a.subject || a.body || ''}`.trim()
      }),
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[sfa/ai/next-action]', e?.message)
    return NextResponse.json({ error: '提案の生成に失敗しました' }, { status: 500 })
  }
}
