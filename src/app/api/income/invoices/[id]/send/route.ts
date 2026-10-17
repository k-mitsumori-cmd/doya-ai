export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/income/access'
import { markSent } from '@/lib/income/invoices'
import { asBody, email } from '@/lib/income/parse'
import { idFrom, readJson, withIncome, type IdCtx } from '@/lib/income/route'

/** 送付済みにする（メール送信そのものは Phase2。今は人が送ったことを記録する） */
export async function POST(req: NextRequest, c: IdCtx) {
  return withIncome(req, 'manager', async (ctx) => {
    const id = await idFrom(c)
    const body = asBody((await readJson(req)) ?? {})
    const sentTo = email(body, 'sentTo', '送付先メール')
    const invoice = await prisma.$transaction((tx) => markSent(tx, ctx, id, sentTo), { isolationLevel: 'Serializable' })
    await audit(prisma, ctx, 'invoice.sent', 'invoice', id, { sentTo })
    return NextResponse.json({ invoice })
  })
}
