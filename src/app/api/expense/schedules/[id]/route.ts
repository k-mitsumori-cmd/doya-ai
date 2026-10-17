export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { audit, ExpenseHttpError, readJson, withExpense } from '@/lib/expense/access'
import { SCHEDULE_STATUSES } from '@/lib/expense/constants'
import { todayJst, toDbDate } from '@/lib/expense/dates'
import { scheduleDto } from '@/lib/expense/dto'
import { settle } from '@/lib/expense/plan'
import { syncContractSchedules, syncWithholding } from '@/lib/expense/sync'
import { date, money, oneOf, str } from '@/lib/expense/validate'

type Params = { params: Promise<{ id: string }> }

async function findSchedule(organizationId: string, id: string) {
  const r = await prisma.expenseSchedule.findFirst({ where: { id, organizationId }, include: { contract: { select: { withholding: true } } } })
  if (!r) throw new ExpenseHttpError(404, '支払予定が見つかりません')
  return r
}

/**
 * PATCH /api/expense/schedules/[id]?org= — 状態の更新（manager 以上）
 * - 請求書を受け取ったら status=billed と実額（amountExclTax / taxAmount）。源泉と出金額は計算し直す
 * - status=paid は支払日（既定は今日）と支払額（既定は出金予定額）
 * - status=skipped は理由が必須
 * - status=planned に戻すと、契約の予定額に戻す
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withExpense(req, 'manager', async (ctx) => {
    const { id } = await params
    const r = await findSchedule(ctx.organizationId, id)
    const b = await readJson(req)
    const status = 'status' in b ? oneOf(b.status, SCHEDULE_STATUSES, '状態') : r.status
    if (r.kind === 'withholding_tax' && !['planned', 'paid'].includes(status)) throw new ExpenseHttpError(400, '源泉税の納付は「予定」か「支払済み」にしてください')
    if (r.kind === 'one_time' && status === 'skipped') throw new ExpenseHttpError(400, '単発の支出は削除してください')

    const data: Record<string, unknown> = { status }
    if ('note' in b) data.note = str(b.note, 'メモ', 1000, false)
    if ('plannedPayDate' in b && r.kind !== 'withholding_tax') data.plannedPayDate = toDbDate(date(b.plannedPayDate, '支払日')!)

    const amountChanged = r.kind !== 'withholding_tax' && ('amountExclTax' in b || 'taxAmount' in b)
    if (amountChanged) {
      if (r.status === 'paid' && status === 'paid') throw new ExpenseHttpError(409, '支払済みの金額は変えられません。先に「承認済み」に戻してください')
      const exclTax = 'amountExclTax' in b ? money(b.amountExclTax, '金額（税抜）')! : r.amountExclTax
      const tax = 'taxAmount' in b ? money(b.taxAmount, '消費税')! : r.taxAmount
      const withholding = r.contract ? r.contract.withholding : r.withholdingAmount > 0
      Object.assign(data, { amountExclTax: exclTax, taxAmount: tax, ...settle(exclTax, tax, withholding), estimated: false })
    }
    if (status === 'paid') {
      const paidOn = date(b.paidOn, '支払日', false)
      data.paidOn = paidOn ? toDbDate(paidOn) : (r.paidOn ?? toDbDate(todayJst()))
      data.paidAmount = 'paidAmount' in b ? money(b.paidAmount, '支払額') : (r.paidAmount ?? (data.netPayAmount as number | undefined) ?? r.netPayAmount)
    } else {
      data.paidOn = null
      data.paidAmount = null
    }
    if (status === 'skipped') data.skipReason = str(b.skipReason, '発生しない理由', 200)
    else data.skipReason = null

    const updated = await prisma.$transaction(async (tx) => {
      await tx.expenseSchedule.update({ where: { id: r.id }, data })
      // 予定に戻したら契約の計算に合わせ直す（実額の入力を取り消す）
      if (status === 'planned' && r.status !== 'planned' && r.contractId) await syncContractSchedules(tx, ctx.organizationId, r.contractId)
      if (r.kind !== 'withholding_tax') await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'schedule.update', 'schedule', r.id, { from: r.status, to: status, amountChanged })
      return tx.expenseSchedule.findFirst({ where: { id: r.id, organizationId: ctx.organizationId }, include: { contract: { include: { vendor: true } } } })
    }, { maxWait: 10000, timeout: 30000 })
    if (!updated) throw new ExpenseHttpError(404, '支払予定が見つかりません')
    return NextResponse.json({ schedule: scheduleDto(updated) })
  })
}

// DELETE /api/expense/schedules/[id]?org= — 単発の支出だけ削除できる（manager 以上）
export async function DELETE(req: NextRequest, { params }: Params) {
  return withExpense(req, 'manager', async (ctx) => {
    const { id } = await params
    const r = await findSchedule(ctx.organizationId, id)
    if (r.kind !== 'one_time') throw new ExpenseHttpError(400, '契約の予定は削除できません。「発生なし」にするか、契約を変更してください')
    if (r.status === 'paid') throw new ExpenseHttpError(409, '支払済みの支出は削除できません')
    await prisma.$transaction(async (tx) => {
      await tx.expenseSchedule.delete({ where: { id: r.id } })
      if (r.withholdingAmount > 0) await syncWithholding(tx, ctx.organizationId)
      await audit(tx, ctx, 'schedule.delete', 'schedule', r.id, { title: r.title })
    })
    return NextResponse.json({ ok: true })
  })
}
