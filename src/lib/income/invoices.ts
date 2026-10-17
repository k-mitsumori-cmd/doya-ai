// ============================================
// ドヤ収入管理: 請求書（下書き・確定・採番・送付済み・取消）
// ============================================
// ⚠️ 確定（confirmed）以降は明細・金額を変えない。直すときは取消（void）→ 作り直し（設計書 §4.2-8）。
// ⚠️ 売上予定（schedule）と明細は 1 対 1。明細が付いた予定は invoiced、取消・下書き削除で planned に戻す。
import type { Prisma } from '@prisma/client'
import { IncomeError, type IncomeContext } from './access'
import { dueDateFor, fromDbDate, isYmd, parseYmd, toDbDate, todayJst, type Ymd } from './dates'
import { computeInvoiceTotals } from './tax'

type Tx = Prisma.TransactionClient

export const INVOICE_STATUSES = ['draft', 'confirmed', 'sent', 'void'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = { draft: '下書き', confirmed: '確定', sent: '送付済み', void: '取消' }

export type DraftLine = { name: string; quantity: number; unitPrice: number; taxRate: number; scheduleId?: string | null }

export type DraftInput = {
  clientId: string
  title: string | null
  issueDate: Ymd
  dueDate: Ymd | null
  notes: string | null
  lines: DraftLine[]
}

/** 入金状況（保存しない。読むときに計算する。設計書 §4.2-3） */
export function paymentState(inv: { status: string; totalInclTax: number; paidAmount: number; dueDate: Date | Ymd }, today: Ymd = todayJst()) {
  const remaining = Math.max(0, inv.totalInclTax - inv.paidAmount)
  const due = typeof inv.dueDate === 'string' ? inv.dueDate : fromDbDate(inv.dueDate)
  const open = inv.status === 'confirmed' || inv.status === 'sent'
  const label = !open ? null : remaining === 0 ? '入金済み' : inv.paidAmount > 0 ? '一部入金' : due < today ? '入金遅延' : '未入金'
  return { remaining, overdue: open && remaining > 0 && due < today, label }
}

async function termsFor(tx: Tx, organizationId: string, clientId: string) {
  const [issuer, client] = await Promise.all([
    tx.incomeIssuer.findUnique({ where: { organizationId } }),
    tx.incomeClient.findFirst({ where: { id: clientId, organizationId } }),
  ])
  if (!client) throw new IncomeError('取引先が見つかりません', 404)
  return {
    client,
    issuer,
    terms: {
      closingDay: client.closingDay ?? issuer?.defaultClosingDay ?? 31,
      paymentMonths: client.paymentMonths ?? issuer?.defaultPaymentMonths ?? 1,
      paymentDay: client.paymentDay ?? issuer?.defaultPaymentDay ?? 31,
    },
  }
}

/** 明細に付ける売上予定が、自組織・同じ取引先・未請求であることを確かめる */
async function claimSchedules(tx: Tx, organizationId: string, clientId: string, scheduleIds: string[]) {
  if (scheduleIds.length === 0) return
  if (new Set(scheduleIds).size !== scheduleIds.length) throw new IncomeError('同じ月の売上を 2 回請求しようとしています')
  // 条件付き一括更新で「未請求のものだけ」を押さえる（同時に 2 枚作られても片方は失敗する）
  const res = await tx.incomeRevenueSchedule.updateMany({
    where: { id: { in: scheduleIds }, organizationId, clientId, status: 'planned' },
    data: { status: 'invoiced' },
  })
  if (res.count !== scheduleIds.length) throw new IncomeError('請求済み、または別の取引先の売上予定が含まれています。画面を更新してください', 409)
}

async function releaseSchedules(tx: Tx, organizationId: string, invoiceId: string) {
  const items = await tx.incomeInvoiceItem.findMany({ where: { invoiceId, scheduleId: { not: null } }, select: { id: true, scheduleId: true } })
  const ids = items.map((i) => i.scheduleId!)
  if (ids.length === 0) return
  await tx.incomeInvoiceItem.updateMany({ where: { invoiceId, id: { in: items.map((i) => i.id) } }, data: { scheduleId: null } })
  await tx.incomeRevenueSchedule.updateMany({ where: { id: { in: ids }, organizationId, status: 'invoiced' }, data: { status: 'planned' } })
}

export async function createDraft(tx: Tx, ctx: IncomeContext, input: DraftInput) {
  const { terms } = await termsFor(tx, ctx.organizationId, input.clientId)
  const totals = computeInvoiceTotals(input.lines)
  const dueDate = input.dueDate ?? dueDateFor(input.issueDate, terms)
  if (dueDate < input.issueDate) throw new IncomeError('支払期日は請求日以降にしてください')
  await claimSchedules(tx, ctx.organizationId, input.clientId, input.lines.flatMap((l) => (l.scheduleId ? [l.scheduleId] : [])))
  const invoice = await tx.incomeInvoice.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: input.clientId,
      title: input.title,
      issueDate: toDbDate(input.issueDate),
      dueDate: toDbDate(dueDate),
      notes: input.notes,
      subtotalExclTax: totals.subtotalExclTax,
      taxAmount: totals.taxAmount,
      totalInclTax: totals.totalInclTax,
      taxBreakdown: totals.taxBreakdown as unknown as Prisma.InputJsonValue,
      items: {
        create: input.lines.map((l, i) => ({
          name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate,
          amountExclTax: totals.lineAmounts[i], scheduleId: l.scheduleId ?? null, sortOrder: i,
        })),
      },
    },
  })
  return invoice
}

async function ownDraft(tx: Tx, ctx: IncomeContext, invoiceId: string) {
  const inv = await tx.incomeInvoice.findFirst({ where: { id: invoiceId, organizationId: ctx.organizationId } })
  if (!inv) throw new IncomeError('請求書が見つかりません', 404)
  if (inv.status !== 'draft') throw new IncomeError('確定した請求書は編集できません。取消して作り直してください', 409)
  return inv
}

/** 下書きの明細を差し替える。売上予定の紐付けも付け直す */
export async function updateDraft(tx: Tx, ctx: IncomeContext, invoiceId: string, input: DraftInput) {
  const inv = await ownDraft(tx, ctx, invoiceId)
  if (inv.clientId !== input.clientId) throw new IncomeError('下書きの取引先は変えられません。新しく作ってください')
  await releaseSchedules(tx, ctx.organizationId, inv.id)
  await tx.incomeInvoiceItem.deleteMany({ where: { invoiceId: inv.id } })
  const { terms } = await termsFor(tx, ctx.organizationId, input.clientId)
  const totals = computeInvoiceTotals(input.lines)
  const dueDate = input.dueDate ?? dueDateFor(input.issueDate, terms)
  if (dueDate < input.issueDate) throw new IncomeError('支払期日は請求日以降にしてください')
  await claimSchedules(tx, ctx.organizationId, input.clientId, input.lines.flatMap((l) => (l.scheduleId ? [l.scheduleId] : [])))
  return tx.incomeInvoice.update({
    where: { id: inv.id },
    data: {
      title: input.title,
      issueDate: toDbDate(input.issueDate),
      dueDate: toDbDate(dueDate),
      notes: input.notes,
      subtotalExclTax: totals.subtotalExclTax,
      taxAmount: totals.taxAmount,
      totalInclTax: totals.totalInclTax,
      taxBreakdown: totals.taxBreakdown as unknown as Prisma.InputJsonValue,
      items: {
        create: input.lines.map((l, i) => ({
          name: l.name, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate,
          amountExclTax: totals.lineAmounts[i], scheduleId: l.scheduleId ?? null, sortOrder: i,
        })),
      },
    },
  })
}

export async function deleteDraft(tx: Tx, ctx: IncomeContext, invoiceId: string) {
  const inv = await ownDraft(tx, ctx, invoiceId)
  await releaseSchedules(tx, ctx.organizationId, inv.id)
  await tx.incomeInvoice.delete({ where: { id: inv.id } })
}

/** 確定: 採番し、請求元・請求先をその時点の内容で固定する */
export async function confirmInvoice(tx: Tx, ctx: IncomeContext, invoiceId: string) {
  const inv = await ownDraft(tx, ctx, invoiceId)
  const { client, issuer } = await termsFor(tx, ctx.organizationId, inv.clientId)
  if (!issuer?.companyName) throw new IncomeError('先に設定で請求元（自社名・振込先）を登録してください')
  const year = parseYmd(fromDbDate(inv.issueDate)).y
  const seq = await tx.incomeInvoiceSequence.upsert({
    where: { organizationId_year: { organizationId: ctx.organizationId, year } },
    create: { organizationId: ctx.organizationId, year, lastNo: 1 },
    update: { lastNo: { increment: 1 } },
  })
  const invoiceNo = `INV-${year}-${String(seq.lastNo).padStart(4, '0')}`
  const { organizationId: _o, updatedAt: _u, ...issuerSnapshot } = issuer
  return tx.incomeInvoice.update({
    where: { id: inv.id },
    data: {
      status: 'confirmed',
      invoiceNo,
      confirmedBy: ctx.userId,
      confirmedAt: new Date(),
      issuerSnapshot: issuerSnapshot as unknown as Prisma.InputJsonValue,
      clientSnapshot: {
        name: client.name, postalCode: client.postalCode, address: client.address,
        department: client.billingDepartment, contactName: client.billingContactName,
      } as Prisma.InputJsonValue,
    },
  })
}

export async function markSent(tx: Tx, ctx: IncomeContext, invoiceId: string, sentTo: string | null) {
  const inv = await tx.incomeInvoice.findFirst({ where: { id: invoiceId, organizationId: ctx.organizationId } })
  if (!inv) throw new IncomeError('請求書が見つかりません', 404)
  if (inv.status !== 'confirmed' && inv.status !== 'sent') throw new IncomeError('確定した請求書だけ送付済みにできます', 409)
  return tx.incomeInvoice.update({ where: { id: inv.id }, data: { status: 'sent', sentAt: new Date(), sentTo } })
}

/** 取消: 入金が付いていないものだけ。番号は欠番として残る */
export async function voidInvoice(tx: Tx, ctx: IncomeContext, invoiceId: string, reason: string) {
  const inv = await tx.incomeInvoice.findFirst({ where: { id: invoiceId, organizationId: ctx.organizationId } })
  if (!inv) throw new IncomeError('請求書が見つかりません', 404)
  if (inv.status === 'draft') throw new IncomeError('下書きは取消ではなく削除してください', 409)
  if (inv.status === 'void') throw new IncomeError('すでに取消済みです', 409)
  const allocated = await tx.incomePaymentAllocation.count({ where: { invoiceId: inv.id } })
  if (allocated) throw new IncomeError('入金の消込が付いています。先に消込を外してください', 409)
  await releaseSchedules(tx, ctx.organizationId, inv.id)
  return tx.incomeInvoice.update({ where: { id: inv.id }, data: { status: 'void', voidedAt: new Date(), voidReason: reason } })
}

export function periodLabel(period: Ymd): string {
  if (!isYmd(period)) return period
  const { y, m } = parseYmd(period)
  return `${y}年${m}月分`
}

/**
 * 売上予定から、取引先ごとに 1 枚の請求書の下書きを作る。
 * 月次売上画面のまとめて作成・エージェント道具 income.draftInvoice が同じ関数を呼ぶ（R-4）。
 * 同じ予定を 2 回指定すると claimSchedules が 409 で止める（二重請求しない）。
 */
export async function draftFromSchedules(tx: Tx, ctx: IncomeContext, scheduleIds: string[], issueDate: Ymd): Promise<string[]> {
  if (scheduleIds.length === 0 || scheduleIds.length > 200) throw new IncomeError('請求する売上予定を選んでください')
  const schedules = await tx.incomeRevenueSchedule.findMany({
    where: { id: { in: scheduleIds }, organizationId: ctx.organizationId, status: 'planned' },
    include: { contract: { select: { title: true, items: { select: { taxRate: true }, take: 1 } } } },
    orderBy: { period: 'asc' },
  })
  if (schedules.length !== new Set(scheduleIds).size) throw new IncomeError('請求済み、または見つからない売上予定が含まれています。画面を更新してください', 409)
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
}
