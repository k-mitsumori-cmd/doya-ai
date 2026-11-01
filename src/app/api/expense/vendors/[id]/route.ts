export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { contractDto, scheduleDto, vendorDto } from '@/lib/expense/dto'
import { vendorInput } from '@/lib/expense/inputs'
import { resyncContract } from '@/lib/expense/sync'
import { toDbDate, todayJst } from '@/lib/expense/dates'

type Params = { params: Promise<{ id: string }> }

async function findVendor(organizationId: string, id: string) {
  const v = await prisma.expenseVendor.findFirst({ where: { id, organizationId } })
  if (!v) throw new ExpenseHttpError(404, '取引先が見つかりません')
  return v
}

// GET /api/expense/vendors/[id]?org= — 取引先（業務委託）の詳細: 契約・支払の履歴と予定・源泉の年間累計
export async function GET(req: NextRequest, { params }: Params) {
  return withExpense(req, 'member', async (ctx) => {
    const { id } = await params
    const v = await findVendor(ctx.organizationId, id)
    const contracts = await prisma.expenseContract.findMany({
      where: { organizationId: ctx.organizationId, vendorId: v.id },
      include: { prices: true, vendor: true, paymentMethod: true },
      orderBy: { startDate: 'desc' },
    })
    const schedules = await prisma.expenseSchedule.findMany({
      where: { organizationId: ctx.organizationId, contract: { vendorId: v.id } },
      include: { contract: { include: { vendor: true } } },
      orderBy: { period: 'desc' },
      take: 60,
    })
    const year = todayJst().slice(0, 4)
    const ytd = await prisma.expenseSchedule.aggregate({
      where: {
        organizationId: ctx.organizationId,
        contract: { vendorId: v.id },
        status: 'paid',
        paidOn: { gte: toDbDate(`${year}-01-01`), lte: toDbDate(`${year}-12-31`) },
      },
      _sum: { amountExclTax: true, withholdingAmount: true, paidAmount: true },
    })
    return NextResponse.json({
      vendor: vendorDto(v, ctx),
      contracts: contracts.map((c) => contractDto(c, ctx)),
      schedules: schedules.map(scheduleDto),
      yearToDate: { year, amountExclTax: ytd._sum.amountExclTax ?? 0, withholding: ytd._sum.withholdingAmount ?? 0, paid: ytd._sum.paidAmount ?? 0 },
    })
  })
}

// PATCH /api/expense/vendors/[id]?org= — 支払条件を変えたら、この取引先の契約の予定を作り直す
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'manager', async (ctx) => {
    const { id } = await params
    const v = await findVendor(ctx.organizationId, id)
    const data = vendorInput(await readJson(req), true)
    const updated = await prisma.expenseVendor.update({ where: { id: v.id }, data })
    await audit(prisma, ctx, 'vendor.update', 'vendor', v.id, { fields: Object.keys(data) })
    const termsChanged = ['closingDay', 'paymentMonths', 'paymentDay', 'name'].some((k) => k in data)
    if (termsChanged) {
      const contracts = await prisma.expenseContract.findMany({ where: { organizationId: ctx.organizationId, vendorId: v.id }, select: { id: true } })
      for (const c of contracts) await resyncContract(ctx.organizationId, c.id)
    }
    return NextResponse.json({ vendor: vendorDto(updated, ctx) })
  })
}

// DELETE /api/expense/vendors/[id]?org= — 契約が残っている取引先は消せない（admin 以上）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const v = await findVendor(ctx.organizationId, id)
    const n = await prisma.expenseContract.count({ where: { organizationId: ctx.organizationId, vendorId: v.id } })
    if (n > 0) throw new ExpenseHttpError(409, 'この取引先には契約があります。先に契約を削除してください。')
    await prisma.expenseVendor.delete({ where: { id: v.id } })
    await audit(prisma, ctx, 'vendor.delete', 'vendor', v.id)
    return NextResponse.json({ ok: true })
  })
}
