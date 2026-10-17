export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, notFound } from '@/lib/income/access'
import { parseClient } from '@/lib/income/clients'
import { paymentState } from '@/lib/income/invoices'
import { idFrom, readJson, withIncome, type IdCtx } from '@/lib/income/route'

export async function GET(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'member', async (ctx) => {
    const id = await idFrom(c)
    const client = await prisma.incomeClient.findFirst({
      where: { id, organizationId: ctx.organizationId },
      include: {
        contracts: { orderBy: { startDate: 'desc' } },
        invoices: { orderBy: { issueDate: 'desc' }, take: 50 },
      },
    })
    if (!client) return notFound('取引先が見つかりません')
    const invoices = client.invoices.map((i) => ({ ...i, state: paymentState(i) }))
    return NextResponse.json({ client: { ...client, invoices } })
  })
}

export async function PATCH(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'member', async (ctx) => {
    const id = await idFrom(c)
    const own = await prisma.incomeClient.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true } })
    if (!own) return notFound('取引先が見つかりません')
    const data = parseClient(await readJson(req))
    const client = await prisma.incomeClient.update({ where: { id: own.id }, data })
    await audit(prisma, ctx, 'client.update', 'client', own.id)
    return NextResponse.json({ client })
  })
}

/** 契約・請求書がある取引先は消さずに無効化する */
export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    const own = await prisma.incomeClient.findFirst({
      where: { id, organizationId: ctx.organizationId },
      select: { id: true, _count: { select: { contracts: true, invoices: true } } },
    })
    if (!own) return notFound('取引先が見つかりません')
    if (own._count.contracts + own._count.invoices > 0) {
      await prisma.incomeClient.update({ where: { id: own.id }, data: { isActive: false } })
      await audit(prisma, ctx, 'client.deactivate', 'client', own.id)
      return NextResponse.json({ ok: true, deactivated: true })
    }
    await prisma.incomeClient.delete({ where: { id: own.id } })
    await audit(prisma, ctx, 'client.delete', 'client', own.id)
    return NextResponse.json({ ok: true })
  })
}
