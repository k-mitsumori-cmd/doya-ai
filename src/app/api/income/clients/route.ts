export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { parseClient } from '@/lib/income/clients'
import { readJson, withIncome } from '@/lib/income/route'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const includeInactive = new URL(req.url).searchParams.get('all') === '1'
    const clients = await prisma.incomeClient.findMany({
      where: { organizationId: ctx.organizationId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { contracts: true, invoices: true } } },
    })
    return NextResponse.json({ clients })
  })
}

export async function POST(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const data = parseClient(await readJson(req))
    const client = await prisma.incomeClient.create({ data: { ...data, organizationId: ctx.organizationId } })
    await audit(prisma, ctx, 'client.create', 'client', client.id)
    return NextResponse.json({ client }, { status: 201 })
  })
}
