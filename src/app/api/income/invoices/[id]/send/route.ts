export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { markSent } from '@/lib/income/invoices'
import { asBody, email } from '@/lib/income/parse'
import { idFrom, readJson, withIncomeWrite, type IdCtx } from '@/lib/income/route'

/** 送付済みにする（メール送信そのものは Phase2。今は人が送ったことを記録する） */
export async function POST(req: NextRequest, c: IdCtx) {
  return withIncomeWrite(req, 'manager', async () => ({ id: await idFrom(c), sentTo: email(asBody((await readJson(req)) ?? {}), 'sentTo', '送付先メール') }), async (ctx, tx, { id, sentTo }) => {
    const invoice = await markSent(tx, ctx, id, sentTo)
    await audit(tx, ctx, 'invoice.sent', 'invoice', id, { sentTo })
    return NextResponse.json({ invoice })
  })
}
