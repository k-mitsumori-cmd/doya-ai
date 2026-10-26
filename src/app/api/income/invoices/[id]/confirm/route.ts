export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { confirmInvoiceWithRetry } from '@/lib/income/invoices'
import { idFrom, withIncome, type IdCtx } from '@/lib/income/route'

export async function POST(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    // 同時実行の衝突（P2002 / P2034）は、確定をやり直す（INC-F03）
    const invoice = await confirmInvoiceWithRetry(prisma, ctx, id)
    await audit(prisma, ctx, 'invoice.confirm', 'invoice', id, { invoiceNo: invoice.invoiceNo })
    return NextResponse.json({ invoice })
  }, { permission: 'invoice.issue' })
}
