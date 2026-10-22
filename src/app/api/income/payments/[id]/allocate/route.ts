export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { asBody, reqInt, reqStr } from '@/lib/income/parse'
import { allocate, unallocate } from '@/lib/income/payments'
import { idFrom, readJson, withIncomeWrite, type IdCtx } from '@/lib/income/route'

/** 消込: { allocations: [{ invoiceId, amount }] } */
export async function POST(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', async () => {
    const id = await idFrom(c)
    const body = asBody(await readJson(req))
    if (!Array.isArray(body.allocations) || body.allocations.length === 0 || body.allocations.length > 50) throw new IncomeError('消込する請求書を選んでください')
    const rows = body.allocations.map((r) => {
      const row = asBody(r)
      return { invoiceId: reqStr(row, 'invoiceId', '請求書', 64), amount: reqInt(row, 'amount', '消込額', { min: 1 }), matchedBy: row.matchedBy === 'rule' ? ('rule' as const) : ('manual' as const) }
    })
    return { id, rows }
  }, async (ctx, tx, { id, rows }) => {
    await allocate(tx, ctx, id, rows)
    await audit(tx, ctx, 'payment.allocate', 'payment', id, { rows })
    return NextResponse.json({ ok: true })
  })
}

/** 消込を外す: ?invoiceId= */
export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', async () => {
    const id = await idFrom(c)
    const invoiceId = new URL(req.url).searchParams.get('invoiceId')
    if (!invoiceId) throw new IncomeError('請求書を指定してください')
    return { id, invoiceId }
  }, async (ctx, tx, { id, invoiceId }) => {
    await unallocate(tx, ctx, id, invoiceId)
    await audit(tx, ctx, 'payment.unallocate', 'payment', id, { invoiceId })
    return NextResponse.json({ ok: true })
  })
}
