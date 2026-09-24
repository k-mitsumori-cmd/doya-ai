export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import { parseSfaAmount } from '@/lib/sfa/amount'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/sfa/leads/[id]/convert — リードを「取引先＋担当者＋商談」へ転換
// body: { dealName?, amount? }
export async function POST(req: NextRequest, ctx: Ctx) {
  const c = await getSfaContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = await ctx.params

  const lead = await prisma.sfaLead.findUnique({ where: { id: p.id } })
  if (!lead || lead.organizationId !== c.organizationId || !lead.isActive) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }
  if (lead.status === 'converted' || lead.convertedAccountId) {
    return NextResponse.json({ error: '既に転換済みです' }, { status: 409 })
  }

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  if (body.dealName != null && typeof body.dealName !== 'string') {
    return NextResponse.json({ error: '商談名が正しくありません' }, { status: 400 })
  }
  const amount = body.amount === undefined || body.amount === '' ? 0n : parseSfaAmount(body.amount)
  if (amount === null) return NextResponse.json({ error: '金額は0以上の有効な数値で入力してください' }, { status: 400 })
  const raw = (lead.raw as Record<string, unknown> | null) || {}

  // 既定パイプラインの先頭ステージ（見込み）
  const pipeline = await prisma.sfaPipeline.findFirst({
    where: { organizationId: c.organizationId },
    orderBy: { createdAt: 'asc' },
  })
  const firstStage = pipeline
    ? await prisma.sfaStage.findFirst({ where: { pipelineId: pipeline.id }, orderBy: { order: 'asc' } })
    : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 同じリードの同時転換と、確認後の無効化を条件付き更新で検出する。
      // 後続の作成が失敗すれば、この予約も同じトランザクションで戻る。
      const claimed = await tx.sfaLead.updateMany({
        where: { id: lead.id, organizationId: c.organizationId, isActive: true, status: { not: 'converted' }, convertedAccountId: null },
        data: { status: 'converted' },
      })
      if (claimed.count !== 1) return null
      const account = await tx.sfaAccount.create({
        data: {
          organizationId: c.organizationId,
          name: lead.name.slice(0, 200),
          corporateNumber: lead.corporateNumber || null,
          industry: typeof raw.industry === 'string' ? raw.industry.slice(0, 80) || null : null,
          prefecture: typeof raw.prefecture === 'string' ? raw.prefecture.slice(0, 40) || null : null,
          url: typeof raw.url === 'string' ? raw.url.slice(0, 300) || null : null,
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
          name: ((body.dealName as string | undefined)?.trim() || `${lead.name} 新規商談`).slice(0, 200),
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

    if (!result) return NextResponse.json({ error: '既に転換済み、または無効化されたリードです。再読み込みして状態をご確認ください。' }, { status: 409 })
    return NextResponse.json({ ok: true, ...bigIntToNumber(result) })
  } catch {
    return NextResponse.json({ error: '商談への転換に失敗しました。再読み込みして状態をご確認ください。' }, { status: 500 })
  }
}
