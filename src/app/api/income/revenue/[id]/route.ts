export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { asBody, str } from '@/lib/income/parse'
import { idFrom, readJson, withIncome, type IdCtx } from '@/lib/income/route'

/** 今月は請求しない（skip）／取り消し（unskip）。理由を残す */
export async function PATCH(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    const body = asBody(await readJson(req))
    const skip = body.skip === true
    const reason = str(body, 'reason', '理由', { max: 200 })
    if (skip && !reason) throw new IncomeError('請求しない理由を入力してください')
    const own = await prisma.incomeRevenueSchedule.findFirst({ where: { id, organizationId: ctx.organizationId } })
    if (!own) throw new IncomeError('売上予定が見つかりません', 404)
    if (own.status === 'invoiced') throw new IncomeError('請求済みの月は変更できません', 409)
    const updated = await prisma.incomeRevenueSchedule.update({
      where: { id: own.id },
      data: skip ? { status: 'skipped', skipReason: reason } : { status: 'planned', skipReason: null },
    })
    await audit(prisma, ctx, skip ? 'schedule.skip' : 'schedule.unskip', 'schedule', own.id, { reason })
    return NextResponse.json({ schedule: updated })
  })
}
