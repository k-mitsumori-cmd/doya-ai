export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { paymentMethodDto } from '@/lib/expense/dto'
import { paymentMethodInput } from '@/lib/expense/inputs'
import { resyncContract } from '@/lib/expense/sync'

type Params = { params: Promise<{ id: string }> }

async function findMethod(organizationId: string, id: string) {
  const m = await prisma.expensePaymentMethod.findFirst({ where: { id, organizationId } })
  if (!m) throw new ExpenseHttpError(404, '支払方法が見つかりません')
  return m
}

async function resyncUsers(organizationId: string, paymentMethodId: string | null, contractIds?: string[]) {
  const ids = contractIds ?? (await prisma.expenseContract.findMany({ where: { organizationId, paymentMethodId }, select: { id: true } })).map((c) => c.id)
  for (const id of ids) await resyncContract(organizationId, id)
}

// PATCH /api/expense/payment-methods/[id]?org= — 締め日・引落日を変えたら、使っている契約の出金日を作り直す（admin 以上）
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await findMethod(ctx.organizationId, id)
    const data = paymentMethodInput(await readJson(req))
    const updated = await prisma.expensePaymentMethod.update({ where: { id: m.id }, data })
    await audit(prisma, ctx, 'payment_method.update', 'payment_method', m.id)
    await resyncUsers(ctx.organizationId, m.id)
    return NextResponse.json({ paymentMethod: paymentMethodDto(updated) })
  })
}

// DELETE /api/expense/payment-methods/[id]?org= — 使っていた契約は「取引先の支払条件（振込）」に戻る（admin 以上）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'admin', async (ctx) => {
    const { id } = await params
    const m = await findMethod(ctx.organizationId, id)
    const users = (await prisma.expenseContract.findMany({ where: { organizationId: ctx.organizationId, paymentMethodId: m.id }, select: { id: true } })).map((c) => c.id)
    await prisma.expensePaymentMethod.delete({ where: { id: m.id } })
    await audit(prisma, ctx, 'payment_method.delete', 'payment_method', m.id)
    await resyncUsers(ctx.organizationId, null, users)
    return NextResponse.json({ ok: true })
  })
}
