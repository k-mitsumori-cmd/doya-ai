export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { deletePayment } from '@/lib/income/payments'
import { idFrom, withIncomeWrite, type IdCtx } from '@/lib/income/route'

export async function DELETE(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', () => idFrom(c), async (ctx, tx, id) => {
    await deletePayment(tx, ctx, id)
    await audit(tx, ctx, 'payment.delete', 'payment', id)
    return NextResponse.json({ ok: true })
  })
}
