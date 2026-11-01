export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { deletePayment } from '@/lib/income/payments'
import { idFrom, withIncome, type IdCtx } from '@/lib/income/route'

export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    await prisma.$transaction((tx) => deletePayment(tx, ctx, id), { isolationLevel: 'Serializable' })
    await audit(prisma, ctx, 'payment.delete', 'payment', id)
    return NextResponse.json({ ok: true })
  }, { permission: 'invoice.issue' })
}
