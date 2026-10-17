export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { voidInvoice } from '@/lib/income/invoices'
import { asBody, reqStr } from '@/lib/income/parse'
import { idFrom, readJson, withIncome, type IdCtx } from '@/lib/income/route'

export async function POST(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'admin', async (ctx) => {
    const id = await idFrom(c)
    const reason = reqStr(asBody(await readJson(req)), 'reason', '取消の理由', 200)
    const invoice = await prisma.$transaction((tx) => voidInvoice(tx, ctx, id, reason))
    await audit(prisma, ctx, 'invoice.void', 'invoice', id, { reason })
    return NextResponse.json({ invoice })
  })
}
