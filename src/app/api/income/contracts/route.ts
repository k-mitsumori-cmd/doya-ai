export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { CONTRACT_STATUSES, parseContract, saveContract } from '@/lib/income/contracts'
import { runWithTxRetry } from '@/lib/income/retry'
import { readJson, withIncome } from '@/lib/income/route'

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
  return withIncome(req, 'member', async (ctx) => {
    const input = parseContract(await readJson(req))
    // 契約番号の同時採番の衝突（P2002 / P2034）はやり直す（自動の番号は「いまの最大＋1」なので、同時の登録で重なりうる）
    const id = await runWithTxRetry(() => prisma.$transaction((tx) => saveContract(tx, ctx, input), { timeout: 30000, isolationLevel: 'Serializable' }))
    await audit(prisma, ctx, 'contract.create', 'contract', id)
    return NextResponse.json({ id }, { status: 201 })
  }, { permission: 'income.contract.edit' })
}
