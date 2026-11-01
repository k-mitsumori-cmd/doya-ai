export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, readJson, withExpense } from '@/lib/expense/access'
import { paymentMethodDto } from '@/lib/expense/dto'
import { paymentMethodInput } from '@/lib/expense/inputs'

// GET /api/expense/payment-methods?org=
export async function GET(req: NextRequest) {
  return withExpense(req, 'member', async (ctx) => {
    const rows = await prisma.expensePaymentMethod.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: 'asc' } })
    return NextResponse.json({ paymentMethods: rows.map(paymentMethodDto) })
  })
}

// POST /api/expense/payment-methods?org= — admin 以上
export async function POST(req: NextRequest) {
  return withExpense(req, 'admin', async (ctx) => {
    const data = paymentMethodInput(await readJson(req))
    const m = await prisma.expensePaymentMethod.create({ data: { ...data, organizationId: ctx.organizationId } })
    await audit(prisma, ctx, 'payment_method.create', 'payment_method', m.id)
    return NextResponse.json({ paymentMethod: paymentMethodDto(m) })
  })
}
