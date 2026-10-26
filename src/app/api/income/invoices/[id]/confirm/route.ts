export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { confirmInvoice } from '@/lib/income/invoices'
import { idFrom, withIncome, type IdCtx } from '@/lib/income/route'

export async function POST(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    // 採番の競合（P2034）は Serializable で検出して 1 回だけやり直す
    let invoice
    for (let attempt = 0; ; attempt++) {
      try {
        invoice = await prisma.$transaction((tx) => confirmInvoice(tx, ctx, id), { isolationLevel: 'Serializable' })
        break
      } catch (e) {
        if (attempt === 0 && (e as { code?: string })?.code === 'P2034') continue
        throw e
      }
    }
    await audit(prisma, ctx, 'invoice.confirm', 'invoice', id, { invoiceNo: invoice.invoiceNo })
    return NextResponse.json({ invoice })
  }, { permission: 'invoice.issue' })
}
