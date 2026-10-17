export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError, notFound } from '@/lib/income/access'
import { parseContract, saveContract } from '@/lib/income/contracts'
import { idFrom, readJson, withIncome, type IdCtx } from '@/lib/income/route'

export async function GET(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'member', async (ctx) => {
    const id = await idFrom(c)
    const contract = await prisma.incomeContract.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        client: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: 'asc' } },
        schedules: { orderBy: { period: 'asc' }, include: { invoiceItem: { select: { invoice: { select: { id: true, invoiceNo: true, status: true } } } } } },
      },
    })
    if (!contract) return notFound('契約が見つかりません')
    return NextResponse.json({ contract })
  })
}

export async function PATCH(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'member', async (ctx) => {
    const id = await idFrom(c)
    const input = parseContract(await readJson(req))
    await prisma.$transaction((tx) => saveContract(tx, ctx, input, id), { timeout: 30000 })
    await audit(prisma, ctx, 'contract.update', 'contract', id, { status: input.status, amountExclTax: input.amountExclTax })
    return NextResponse.json({ id })
  })
}

/** 請求済みの月がある契約は消さない（解約・終了にする） */
export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    await prisma.$transaction(async (tx) => {
      const own = await tx.incomeContract.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true } })
      if (!own) throw new IncomeError('契約が見つかりません', 404)
      const billed = await tx.incomeRevenueSchedule.count({ where: { contractId: own.id, organizationId: ctx.organizationId, status: 'invoiced' } })
      if (billed) throw new IncomeError('請求済みの月がある契約は削除できません。状態を「解約」か「終了」にしてください', 409)
      await tx.incomeContract.delete({ where: { id: own.id } })
    })
    await audit(prisma, ctx, 'contract.delete', 'contract', id)
    return NextResponse.json({ ok: true })
  })
}
