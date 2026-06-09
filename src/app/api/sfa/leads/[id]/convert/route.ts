export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/sfa/leads/[id]/convert — リードを「取引先＋担当者＋商談」へ転換
// body: { dealName?, amount? }
export async function POST(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params

  const lead = await prisma.sfaLead.findUnique({ where: { id: p.id } })
  if (!lead || lead.organizationId !== c.organizationId) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }
  if (lead.status === 'converted' && lead.convertedAccountId) {
    return NextResponse.json({ error: '既に転換済みです' }, { status: 409 })
  }

  const body = await req.json().catch(() => ({}))
  const raw = (lead.raw as Record<string, unknown> | null) || {}

  // 既定パイプラインの先頭ステージ（見込み）
  const pipeline = await prisma.sfaPipeline.findFirst({
    where: { organizationId: c.organizationId },
    orderBy: { createdAt: 'asc' },
  })
  const firstStage = pipeline
    ? await prisma.sfaStage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } })
    : null

  const amount = body.amount != null && Number(body.amount) >= 0 ? BigInt(Math.round(Number(body.amount))) : BigInt(0)

  const result = await prisma.$transaction(async (tx) => {
    const account = await tx.sfaAccount.create({
      data: {
        organizationId: c.organizationId,
        name: lead.name.slice(0, 200),
        corporateNumber: lead.corporateNumber || null,
        industry: (raw.industry as string)?.slice(0, 80) || null,
        prefecture: (raw.prefecture as string)?.slice(0, 40) || null,
        url: (raw.url as string)?.slice(0, 300) || null,
        note: lead.note || null,
        ownerMemberId: c.memberId,
      },
    })

    // 担当者名があれば Contact を作成
    if (lead.contactName) {
      await tx.sfaContact.create({
        data: {
          organizationId: c.organizationId,
          accountId: account.id,
          name: lead.contactName.slice(0, 80),
          email: lead.email || null,
          phone: lead.phone || null,
          isKeyPerson: true,
        },
      })
    }

    const deal = await tx.sfaDeal.create({
      data: {
        organizationId: c.organizationId,
        accountId: account.id,
        name: ((body.dealName as string)?.trim() || `${lead.name} 新規商談`).slice(0, 200),
        amount,
        stageId: firstStage?.id || null,
        probability: firstStage?.probability ?? 10,
        status: 'open',
        startDate: new Date(),
        lastActivityAt: new Date(),
        assigneeMemberId: c.memberId,
      },
    })

    await tx.sfaLead.update({
      where: { id: lead.id },
      data: { status: 'converted', convertedAccountId: account.id },
    })

    return { account, deal }
  })

  return NextResponse.json({ ok: true, ...bigIntToNumber(result) })
}
