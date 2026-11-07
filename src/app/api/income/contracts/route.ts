export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { createOnce, isOnceResolve, onceOperationId, resolveOnce, type OnceScope } from '@/lib/submit-once'
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
    const body = await readJson(req)
    const fail = (status: number, message: string) => new IncomeError(message, status)
    const once: OnceScope = { family: 'income-contract', organizationId: ctx.organizationId, actorId: ctx.userId, operationId: onceOperationId(body, fail), fail }
    const find = (db: Prisma.TransactionClient) => (id: string) => db.incomeContract.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true } })
    // 通信に失敗した送信が保存されたかを確かめる（登録はしない）
    if (isOnceResolve(body)) return NextResponse.json({ once: await prisma.$transaction((tx) => resolveOnce(tx, once, find(tx))) })
    const input = parseContract(body)
    // 契約番号の同時採番の衝突（P2002 / P2034）はやり直す（自動の番号は「いまの最大＋1」なので、同時の登録で重なりうる）
    // 同じ送信の送り直しは、受け取りの記録を見て、前にできた契約を返す
    const { entry, replayed } = await runWithTxRetry(() => prisma.$transaction((tx) => createOnce<{ id: string }>(tx, once, body, find(tx), async () => ({ id: await saveContract(tx, ctx, input) })), { timeout: 30000, isolationLevel: 'Serializable' }))
    if (!replayed) await audit(prisma, ctx, 'contract.create', 'contract', entry.id)
    return NextResponse.json({ id: entry.id }, { status: 201 })
  }, { permission: 'income.contract.edit' })
}
