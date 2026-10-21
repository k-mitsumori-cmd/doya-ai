export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { CONTRACT_STATUSES, parseContract, saveContract } from '@/lib/income/contracts'
import { readJson, withIncome, withIncomeWrite } from '@/lib/income/route'

export async function GET(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const status = new URL(req.url).searchParams.get('status')
    const contracts = await prisma.incomeContract.findMany({
      where: { organizationId: ctx.organizationId, ...(status && (CONTRACT_STATUSES as readonly string[]).includes(status) ? { status } : {}) },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    })
    return NextResponse.json({ contracts })
  })
}

export async function POST(req: NextRequest) {
  return withIncomeWrite(req, 'member', async () => parseContract(await readJson(req)), async (ctx, tx, input) => {
    const id = await saveContract(tx, ctx, input)
    await audit(tx, ctx, 'contract.create', 'contract', id)
    return NextResponse.json({ id }, { status: 201 })
  })
}
