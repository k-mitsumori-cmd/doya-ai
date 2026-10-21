export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { todayJst } from '@/lib/income/dates'
import { draftFromSchedules } from '@/lib/income/invoices'
import { asBody, date } from '@/lib/income/parse'
import { readJson, withIncomeWrite } from '@/lib/income/route'

/** 月次売上画面から、選んだ売上予定を取引先ごとに 1 枚の下書きにまとめる */
export async function POST(req: NextRequest) {
  return withIncomeWrite(req, 'member', async () => {
    const body = asBody(await readJson(req))
    const ids = body.scheduleIds
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((x) => typeof x === 'string')) throw new IncomeError('請求する売上予定を選んでください')
    const issueDate = date(body, 'issueDate', '請求日') ?? todayJst()
    return { ids: ids as string[], issueDate }
  }, async (ctx, tx, { ids, issueDate }) => {
    const created = await draftFromSchedules(tx, ctx, ids, issueDate)
    for (const id of created) await audit(tx, ctx, 'invoice.create', 'invoice', id, { from: 'bulk' })
    return NextResponse.json({ invoiceIds: created }, { status: 201 })
  })
}
