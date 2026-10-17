export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { CATEGORIES } from '@/lib/expense/constants'
import { contractDto } from '@/lib/expense/dto'
import { contractInput, priceInput, vendorInput } from '@/lib/expense/inputs'
import { syncContractSchedules, syncWithholding } from '@/lib/expense/sync'
import { fromDbDate, todayJst, toDbDate } from '@/lib/expense/dates'
import { id as idParam } from '@/lib/expense/validate'

// GET /api/expense/contracts?org=&category=&status= — 次回の支払予定つき
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const sp = req.nextUrl.searchParams
    const category = sp.get('category')
    const status = sp.get('status')
    const rows = await prisma.expenseContract.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(category && (CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
        ...(status === 'active' || status === 'paused' || status === 'ended' ? { status } : {}),
      },
      include: { prices: true, vendor: true, paymentMethod: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    const next = await prisma.expenseSchedule.findMany({
      where: { organizationId: ctx.organizationId, contractId: { in: rows.map((r) => r.id) }, status: { notIn: ['paid', 'skipped'] }, plannedPayDate: { gte: toDbDate(todayJst()) } },
      orderBy: { plannedPayDate: 'asc' },
      select: { contractId: true, plannedPayDate: true, netPayAmount: true, amountExclTax: true },
    })
    const nextBy = new Map<string, { date: string; netPayAmount: number; amountExclTax: number }>()
    for (const n of next) if (n.contractId && !nextBy.has(n.contractId)) nextBy.set(n.contractId, { date: fromDbDate(n.plannedPayDate), netPayAmount: n.netPayAmount, amountExclTax: n.amountExclTax })
    return NextResponse.json({ contracts: rows.map((c) => ({ ...contractDto(c, ctx), nextPayment: nextBy.get(c.id) ?? null })) })
  })
}

// POST /api/expense/contracts?org= — 契約（と必要なら取引先）を登録し、12 か月分の支払予定を作る（manager 以上）
// body: { vendorId | vendor: {...}, title, category, ..., price: { unitPrice, quantity, ... } }
export async function POST(req: NextRequest) {
  return withExpense(req, 'manager', async (ctx) => {
    const body = await readJson(req)
    const data = contractInput(body)
    const price = priceInput((body.price ?? {}) as Record<string, unknown>, fromDbDate(data.startDate as Date))
    const paymentMethodId = idParam(body.paymentMethodId, '支払方法', false)
    const created = await prisma.$transaction(async (tx) => {
      let vendorId = idParam(body.vendorId, '取引先', false)
      if (vendorId) {
        if (!(await tx.expenseVendor.findFirst({ where: { id: vendorId, organizationId: ctx.organizationId }, select: { id: true } }))) throw new ExpenseHttpError(404, '取引先が見つかりません')
      } else {
        if (!body.vendor || typeof body.vendor !== 'object') throw new ExpenseHttpError(400, '取引先を選ぶか、新しく入力してください')
        const v = await tx.expenseVendor.create({ data: { ...vendorInput(body.vendor as Record<string, unknown>), organizationId: ctx.organizationId } })
        vendorId = v.id
      }
      if (paymentMethodId && !(await tx.expensePaymentMethod.findFirst({ where: { id: paymentMethodId, organizationId: ctx.organizationId }, select: { id: true } }))) {
        throw new ExpenseHttpError(404, '支払方法が見つかりません')
      }
      const c = await tx.expenseContract.create({
        data: {
          ...(data as { title: string; category: string; startDate: Date; anchorDate: Date }),
          organizationId: ctx.organizationId,
          vendorId,
          paymentMethodId,
          prices: { create: price },
        },
      })
      await syncContractSchedules(tx, ctx.organizationId, c.id)
      await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'contract.create', 'contract', c.id)
      return c
    }, { maxWait: 10000, timeout: 30000 })
    const full = await prisma.expenseContract.findFirstOrThrow({ where: { id: created.id, organizationId: ctx.organizationId }, include: { prices: true, vendor: true, paymentMethod: true } })
    return NextResponse.json({ contract: contractDto(full, ctx) })
  })
}
