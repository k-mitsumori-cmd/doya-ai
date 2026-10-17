// ============================================
// ドヤ収入管理: 入金と消込
// ============================================
// 入金 1 件を複数の請求書に、請求書 1 枚に複数の入金を付けられる（IncomePaymentAllocation）。
// 消込の合計 ≦ 入金額 ＋ 振込手数料の差引。請求書ごとに 消込 ≦ 残高。
import type { Prisma } from '@prisma/client'
import { IncomeError, type IncomeContext } from './access'

type Tx = Prisma.TransactionClient

/** 請求書の入金済み額を消込から数え直す（加算・減算で持たない。ずれないように） */
export async function recomputeInvoicePaid(tx: Tx, organizationId: string, invoiceId: string) {
  const sum = await tx.incomePaymentAllocation.aggregate({ where: { invoiceId, invoice: { organizationId } }, _sum: { amount: true } })
  await tx.incomeInvoice.updateMany({ where: { id: invoiceId, organizationId }, data: { paidAmount: sum._sum.amount ?? 0 } })
}

export async function recomputePaymentStatus(tx: Tx, organizationId: string, paymentId: string) {
  const payment = await tx.incomePayment.findFirst({ where: { id: paymentId, organizationId }, include: { allocations: true } })
  if (!payment) return
  const allocated = payment.allocations.reduce((a, x) => a + x.amount, 0)
  const status = allocated === 0 ? 'unmatched' : allocated >= payment.amount + payment.feeDeducted ? 'matched' : 'partial'
  await tx.incomePayment.update({ where: { id: payment.id }, data: { status } })
}

export async function allocate(
  tx: Tx,
  ctx: IncomeContext,
  paymentId: string,
  rows: { invoiceId: string; amount: number; matchedBy?: 'manual' | 'rule' }[],
) {
  const payment = await tx.incomePayment.findFirst({ where: { id: paymentId, organizationId: ctx.organizationId }, include: { allocations: true } })
  if (!payment) throw new IncomeError('入金が見つかりません', 404)
  if (new Set(rows.map((r) => r.invoiceId)).size !== rows.length) throw new IncomeError('同じ請求書が 2 回指定されています')
  const already = payment.allocations.reduce((a, x) => a + x.amount, 0)
  const adding = rows.reduce((a, r) => a + r.amount, 0)
  if (already + adding > payment.amount + payment.feeDeducted) throw new IncomeError('消込の合計が入金額（手数料の差引を含む）を超えています')
  for (const row of rows) {
    if (!Number.isSafeInteger(row.amount) || row.amount <= 0) throw new IncomeError('消込額は 1 円以上の整数にしてください')
    const inv = await tx.incomeInvoice.findFirst({ where: { id: row.invoiceId, organizationId: ctx.organizationId } })
    if (!inv) throw new IncomeError('請求書が見つかりません', 404)
    if (inv.status !== 'confirmed' && inv.status !== 'sent') throw new IncomeError(`${inv.invoiceNo ?? '下書き'} は確定していないため消込できません`, 409)
    const remaining = inv.totalInclTax - inv.paidAmount
    if (row.amount > remaining) throw new IncomeError(`${inv.invoiceNo} の残高（${remaining.toLocaleString('ja-JP')}円）を超えています`)
    await tx.incomePaymentAllocation.upsert({
      where: { paymentId_invoiceId: { paymentId: payment.id, invoiceId: inv.id } },
      create: { paymentId: payment.id, invoiceId: inv.id, amount: row.amount, matchedBy: row.matchedBy ?? 'manual' },
      update: { amount: { increment: row.amount } },
    })
    await recomputeInvoicePaid(tx, ctx.organizationId, inv.id)
  }
  await recomputePaymentStatus(tx, ctx.organizationId, payment.id)
}

export async function unallocate(tx: Tx, ctx: IncomeContext, paymentId: string, invoiceId: string) {
  const alloc = await tx.incomePaymentAllocation.findFirst({
    where: { paymentId, invoiceId, payment: { organizationId: ctx.organizationId }, invoice: { organizationId: ctx.organizationId } },
  })
  if (!alloc) throw new IncomeError('消込が見つかりません', 404)
  await tx.incomePaymentAllocation.delete({ where: { id: alloc.id } })
  await recomputeInvoicePaid(tx, ctx.organizationId, invoiceId)
  await recomputePaymentStatus(tx, ctx.organizationId, paymentId)
}

/** 入金の削除: 消込を外してから消す */
export async function deletePayment(tx: Tx, ctx: IncomeContext, paymentId: string) {
  const payment = await tx.incomePayment.findFirst({ where: { id: paymentId, organizationId: ctx.organizationId }, include: { allocations: true } })
  if (!payment) throw new IncomeError('入金が見つかりません', 404)
  const invoiceIds = payment.allocations.map((a) => a.invoiceId)
  await tx.incomePaymentAllocation.deleteMany({ where: { paymentId: payment.id } })
  for (const id of invoiceIds) await recomputeInvoicePaid(tx, ctx.organizationId, id)
  await tx.incomePayment.delete({ where: { id: payment.id } })
}
