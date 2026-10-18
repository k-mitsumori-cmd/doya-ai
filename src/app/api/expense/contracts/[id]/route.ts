export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { contractDto, scheduleDto } from '@/lib/expense/dto'
import { contractInput } from '@/lib/expense/inputs'
import { syncContractSchedules, syncWithholding, retryOnConflict } from '@/lib/expense/sync'
import { id as idParam } from '@/lib/expense/validate'

type Params = { params: Promise<{ id: string }> }

async function findContract(organizationId: string, id: string) {
  const c = await prisma.expenseContract.findFirst({ where: { id, organizationId }, include: { prices: true, vendor: true, paymentMethod: true } })
  if (!c) throw new ExpenseHttpError(404, '契約が見つかりません')
  return c
}

// GET /api/expense/contracts/[id]?org= — 契約と、その支払予定・実績
export async function GET(req: NextRequest, { params }: Params) {
  return withExpense(req, 'member', async (ctx) => {
    const { id } = await params
    const c = await findContract(ctx.organizationId, id)
    const schedules = await prisma.expenseSchedule.findMany({
      where: { organizationId: ctx.organizationId, contractId: c.id },
      include: { contract: { include: { vendor: true } } },
      orderBy: { period: 'desc' },
      take: 36,
    })
    return NextResponse.json({ contract: contractDto(c, ctx), schedules: schedules.map(scheduleDto) })
  })
}

// PATCH /api/expense/contracts/[id]?org= — 条件を変えたら、今月以降の「予定」だけ作り直す（manager 以上）
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'manager', async (ctx) => {
    const { id } = await params
    const c = await findContract(ctx.organizationId, id)
    const body = await readJson(req)
    const data: Record<string, unknown> = contractInput(body, true)
    if ('paymentMethodId' in body) {
      const pm = idParam(body.paymentMethodId, '支払方法', false)
      if (pm && !(await prisma.expensePaymentMethod.findFirst({ where: { id: pm, organizationId: ctx.organizationId }, select: { id: true } }))) throw new ExpenseHttpError(404, '支払方法が見つかりません')
      data.paymentMethodId = pm
    }
    const start = (data.startDate as Date | undefined) ?? c.startDate
    const end = 'endDate' in data ? (data.endDate as Date | null) : c.endDate
    if (end && end < start) throw new ExpenseHttpError(400, '終了日は開始日より後の日付にしてください')
    await retryOnConflict(() => prisma.$transaction(async (tx) => {
      await tx.expenseContract.update({ where: { id: c.id }, data })
      await syncContractSchedules(tx, ctx.organizationId, c.id)
      await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'contract.update', 'contract', c.id, { fields: Object.keys(data) })
    }, { maxWait: 10000, timeout: 30000 }))
    return NextResponse.json({ contract: contractDto(await findContract(ctx.organizationId, c.id), ctx) })
  })
}

// DELETE /api/expense/contracts/[id]?org= — 未確定の予定は消し、請求書受領以降の実績は残す（admin 以上）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const c = await findContract(ctx.organizationId, id)
    await retryOnConflict(() => prisma.$transaction(async (tx) => {
      await tx.expenseSchedule.deleteMany({ where: { organizationId: ctx.organizationId, contractId: c.id, status: 'planned' } })
      await tx.expenseContract.delete({ where: { id: c.id } })
      await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'contract.delete', 'contract', c.id, { title: c.title })
    }, { maxWait: 10000, timeout: 30000 }))
    return NextResponse.json({ ok: true })
  })
}
