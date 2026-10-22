export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { voidInvoice } from '@/lib/income/invoices'
import { asBody, reqStr } from '@/lib/income/parse'
import { idFrom, readJson, withIncomeWrite, type IdCtx } from '@/lib/income/route'

export async function POST(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'admin', async () => ({ id: await idFrom(c), reason: reqStr(asBody(await readJson(req)), 'reason', '取消の理由', 200) }), async (ctx, tx, { id, reason }) => {
    const invoice = await voidInvoice(tx, ctx, id, reason)
    await audit(tx, ctx, 'invoice.void', 'invoice', id, { reason })
    return NextResponse.json({ invoice })
  })
}
