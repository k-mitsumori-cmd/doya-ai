export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { confirmInvoice } from '@/lib/income/invoices'
import { idFrom, withIncomeWrite, type IdCtx } from '@/lib/income/route'

export async function POST(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', () => idFrom(c), async (ctx, tx, id) => {
    const invoice = await confirmInvoice(tx, ctx, id)
    await audit(tx, ctx, 'invoice.confirm', 'invoice', id, { invoiceNo: invoice.invoiceNo })
    return NextResponse.json({ invoice })
  })
}
