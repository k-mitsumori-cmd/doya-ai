export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { priceDto } from '@/lib/expense/dto'
import { priceInput } from '@/lib/expense/inputs'
import { syncContractSchedules, syncWithholding } from '@/lib/expense/sync'

type Params = { params: Promise<{ id: string }> }

// POST /api/expense/contracts/[id]/prices?org= — 値上げ・席数の変更（適用開始日つき）。同じ日なら上書き（manager 以上）
export async function POST(req: NextRequest, { params }: Params) {
  return withExpense(req, 'manager', async (ctx) => {
    const { id } = await params
    const c = await prisma.expenseContract.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true } })
    if (!c) throw new ExpenseHttpError(404, '契約が見つかりません')
    const data = priceInput(await readJson(req))
    const p = await prisma.$transaction(async (tx) => {
      const row = await tx.expenseContractPrice.upsert({
        where: { contractId_effectiveFrom: { contractId: c.id, effectiveFrom: data.effectiveFrom } },
        create: { ...data, contractId: c.id },
        update: data,
      })
      await syncContractSchedules(tx, ctx.organizationId, c.id)
      await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'contract.price', 'contract', c.id, { effectiveFrom: data.effectiveFrom.toISOString().slice(0, 10), unitPrice: data.unitPrice, quantity: data.quantity })
      return row
    }, { maxWait: 10000, timeout: 30000 })
    return NextResponse.json({ price: priceDto(p) })
  })
}
