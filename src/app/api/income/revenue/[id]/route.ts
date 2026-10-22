export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { asBody, str } from '@/lib/income/parse'
import { idFrom, readJson, withIncomeWrite, type IdCtx } from '@/lib/income/route'

/** 今月は請求しない（skip）／取り消し（unskip）。理由を残す */
export async function PATCH(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', async () => {
    const id = await idFrom(c)
    const body = asBody(await readJson(req))
    const skip = body.skip === true
    const reason = str(body, 'reason', '理由', { max: 200 })
    if (skip && !reason) throw new IncomeError('請求しない理由を入力してください')
    return { id, skip, reason }
  }, async (ctx, tx, { id, skip, reason }) => {
    // 状態の確認と更新を 1 回の条件付き更新で行う（確認後に請求済みになった行を上書きしない）
    const res = await tx.incomeRevenueSchedule.updateMany({
      where: { id, organizationId: ctx.organizationId, status: skip ? 'planned' : 'skipped' },
      data: skip ? { status: 'skipped', skipReason: reason } : { status: 'planned', skipReason: null },
    })
    if (res.count === 0) {
      const exists = await tx.incomeRevenueSchedule.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { status: true } })
      if (!exists) throw new IncomeError('売上予定が見つかりません', 404)
      throw new IncomeError(exists.status === 'invoiced' ? '請求済みの月は変更できません' : 'すでに変更されています。画面を更新してください', 409)
    }
    const updated = await tx.incomeRevenueSchedule.findFirst({ where: { id, organizationId: ctx.organizationId } })
    await audit(tx, ctx, skip ? 'schedule.skip' : 'schedule.unskip', 'schedule', id, { reason })
    return NextResponse.json({ schedule: updated })
  })
}
