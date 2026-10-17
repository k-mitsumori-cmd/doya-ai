export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, IncomeError } from '@/lib/income/access'
import { fromDbDate, todayJst } from '@/lib/income/dates'
import { createDraft, periodLabel } from '@/lib/income/invoices'
import { asBody, date } from '@/lib/income/parse'
import { readJson, withIncome } from '@/lib/income/route'

/** 月次売上画面から、選んだ売上予定を取引先ごとに 1 枚の下書きにまとめる */
export async function POST(req: NextRequest) {
  return withIncome(req, 'member', async (ctx) => {
    const body = asBody(await readJson(req))
    const ids = body.scheduleIds
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((x) => typeof x === 'string')) throw new IncomeError('請求する売上予定を選んでください')
    const issueDate = date(body, 'issueDate', '請求日') ?? todayJst()
    const created = await prisma.$transaction(async (tx) => {
      const schedules = await tx.incomeRevenueSchedule.findMany({
        where: { id: { in: ids as string[] }, organizationId: ctx.organizationId, status: 'planned' },
        include: { contract: { select: { title: true, items: { select: { taxRate: true }, take: 1 } } } },
        orderBy: { period: 'asc' },
      })
      if (schedules.length !== ids.length) throw new IncomeError('請求済み、または見つからない売上予定が含まれています。画面を更新してください', 409)
      const byClient = new Map<string, typeof schedules>()
      for (const s of schedules) byClient.set(s.clientId, [...(byClient.get(s.clientId) ?? []), s])
      const out: string[] = []
      for (const [clientId, rows] of Array.from(byClient.entries())) {
        const inv = await createDraft(tx, ctx, {
          clientId,
          title: rows.length === 1 ? `${rows[0].contract.title}（${periodLabel(fromDbDate(rows[0].period))}）` : null,
          issueDate,
          dueDate: null,
          notes: null,
          lines: rows.map((s) => ({
            name: `${s.contract.title}（${periodLabel(fromDbDate(s.period))}）`,
            quantity: 1,
            unitPrice: s.amountExclTax,
            taxRate: s.contract.items[0]?.taxRate ?? 10,
            scheduleId: s.id,
          })),
        })
        out.push(inv.id)
      }
      return out
    }, { timeout: 30000 })
    for (const id of created) await audit(prisma, ctx, 'invoice.create', 'invoice', id, { from: 'bulk' })
    return NextResponse.json({ invoiceIds: created }, { status: 201 })
  })
}
