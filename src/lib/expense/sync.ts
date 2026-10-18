// ============================================
// ドヤ支出管理: 支払予定を DB に書く（契約保存時と毎朝の cron）
// ============================================
// ⚠️ 作り直すのは「今月以降で status=planned」の行だけ。請求書受領（billed）以降は金額を触らない（設計書 §4.2-1）
// ⚠️ 一意制約 (contractId, period) があるので、cron が何度走っても二重に作らない
// ⚠️ 源泉税の行は報酬の行から毎回集計し直す（金額を手で持たない）
import type { ExpenseSchedule, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CONFIRMED_STATUSES, HORIZON_MONTHS, type WithholdingMode } from './constants'
import { addDays, addMonthsToYm, fromDbDate, toDbDate, todayJst, ymOf, type Ym, type Ymd } from './dates'
import { planContract, resolvePayTerms } from './plan'
import { remittanceBucket } from './withholding'
import type { ScheduleRowLike } from './aggregate'

type Tx = Prisma.TransactionClient

export function toRowLike(r: ExpenseSchedule): ScheduleRowLike {
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    category: r.category,
    period: fromDbDate(r.period),
    plannedPayDate: fromDbDate(r.plannedPayDate),
    plannedAmountExclTax: r.plannedAmountExclTax,
    amountExclTax: r.amountExclTax,
    taxAmount: r.taxAmount,
    withholdingAmount: r.withholdingAmount,
    netPayAmount: r.netPayAmount,
    status: r.status,
    paidOn: r.paidOn ? fromDbDate(r.paidOn) : null,
    paidAmount: r.paidAmount,
    estimated: r.estimated,
    contractId: r.contractId,
  }
}

/** 為替: その月のレート。無ければそれ以前で一番新しい月のレート（設計書 §12 Q3） */
async function fxLookup(tx: Tx, organizationId: string) {
  const rates = await tx.expenseFxRate.findMany({ where: { organizationId }, orderBy: { month: 'asc' } })
  return (ym: Ym, currency: string): number | null => {
    let hit: number | null = null
    for (const r of rates) if (r.currency === currency && r.month <= ym) hit = Number(r.rate)
    return hit
  }
}

export async function syncContractSchedules(tx: Tx, organizationId: string, contractId: string, today: Ymd = todayJst()) {
  const c = await tx.expenseContract.findFirst({
    where: { id: contractId, organizationId },
    include: { prices: true, vendor: true, paymentMethod: true },
  })
  if (!c) return
  const fromYm = ymOf(today)
  const toYm = addMonthsToYm(fromYm, HORIZON_MONTHS - 1)
  const recent = await tx.expenseSchedule.findMany({
    where: { organizationId, contractId, status: { in: Array.from(CONFIRMED_STATUSES) } },
    orderBy: { period: 'desc' },
    take: 3,
    select: { amountExclTax: true },
  })
  const planned = planContract(
    {
      billingModel: c.billingModel,
      frequencyMonths: c.frequencyMonths,
      anchorDate: fromDbDate(c.anchorDate),
      startDate: fromDbDate(c.startDate),
      endDate: c.endDate ? fromDbDate(c.endDate) : null,
      autoRenew: c.autoRenew,
      status: c.status,
      currency: c.currency,
      withholding: c.withholding,
      forecastMode: c.forecastMode,
      prices: c.prices.map((p) => ({
        effectiveFrom: fromDbDate(p.effectiveFrom),
        unitPrice: p.unitPrice,
        quantity: p.quantity,
        capQuantity: p.capQuantity,
        taxRate: p.taxRate,
        taxIncluded: p.taxIncluded,
      })),
    },
    {
      fromYm,
      toYm,
      terms: resolvePayTerms(c.paymentMethod, c.vendor),
      fxRate: await fxLookup(tx, organizationId),
      recentActuals: recent.map((r) => r.amountExclTax),
    }
  )

  const existing = await tx.expenseSchedule.findMany({ where: { organizationId, contractId, period: { gte: toDbDate(`${fromYm}-01`) } } })
  const byPeriod = new Map(existing.map((r) => [fromDbDate(r.period), r]))
  const keep = new Set<string>()
  const title = c.vendor.kind === 'individual' && c.vendor.name !== c.title ? `${c.vendor.name}（${c.title}）` : c.title

  for (const p of planned) {
    keep.add(p.period)
    const data = {
      title,
      category: c.category,
      plannedPayDate: toDbDate(p.plannedPayDate),
      plannedAmountExclTax: p.amountExclTax,
      amountExclTax: p.amountExclTax,
      taxAmount: p.taxAmount,
      withholdingAmount: p.withholdingAmount,
      netPayAmount: p.netPayAmount,
      estimated: p.estimated,
    }
    const cur = byPeriod.get(p.period)
    if (!cur) {
      await tx.expenseSchedule.create({ data: { organizationId, contractId, kind: 'contract', period: toDbDate(p.period), ...data } })
    } else if (cur.status === 'planned') {
      await tx.expenseSchedule.update({ where: { id: cur.id }, data })
    } else if (cur.plannedAmountExclTax !== p.amountExclTax || cur.title !== title) {
      // 請求書受領以降は実額を守る。比較用の予定額と表示名だけ合わせる
      await tx.expenseSchedule.update({ where: { id: cur.id }, data: { plannedAmountExclTax: p.amountExclTax, title } })
    }
  }
  const stale = existing.filter((r) => r.status === 'planned' && !keep.has(fromDbDate(r.period))).map((r) => r.id)
  if (stale.length) await tx.expenseSchedule.deleteMany({ where: { id: { in: stale }, organizationId } })
}

/** 源泉税の納付予定を、報酬の行から集計し直す */
export async function syncWithholding(tx: Tx, organizationId: string, today: Ymd = todayJst()) {
  const org = await tx.expenseOrganization.findUnique({ where: { id: organizationId }, select: { withholdingMode: true } })
  if (!org) return
  const mode = (org.withholdingMode === 'special' ? 'special' : 'monthly') as WithholdingMode
  // 納付期限が 60 日以上前のものは確定済みとみなして触らない
  const floor = addDays(today, -60)
  const sources = await tx.expenseSchedule.findMany({
    where: { organizationId, kind: { in: ['contract', 'one_time'] }, withholdingAmount: { gt: 0 }, status: { not: 'skipped' }, plannedPayDate: { gte: toDbDate(addDays(floor, -200)) } },
    select: { plannedPayDate: true, paidOn: true, withholdingAmount: true },
  })
  const buckets = new Map<Ymd, { dueDate: Ymd; label: string; amount: number }>()
  for (const s of sources) {
    const b = remittanceBucket(fromDbDate(s.paidOn ?? s.plannedPayDate), mode)
    if (b.dueDate < floor) continue
    const cur = buckets.get(b.period) ?? { dueDate: b.dueDate, label: b.label, amount: 0 }
    cur.amount += s.withholdingAmount
    buckets.set(b.period, cur)
  }
  const existing = await tx.expenseSchedule.findMany({ where: { organizationId, kind: 'withholding_tax', plannedPayDate: { gte: toDbDate(floor) } } })
  const byPeriod = new Map(existing.map((r) => [fromDbDate(r.period), r]))
  for (const [period, b] of Array.from(buckets.entries())) {
    const data = {
      title: b.label,
      category: 'withholding_tax',
      plannedPayDate: toDbDate(b.dueDate),
      plannedAmountExclTax: b.amount,
      amountExclTax: b.amount,
      netPayAmount: b.amount,
      estimated: false,
    }
    const cur = byPeriod.get(period)
    // sourceType/sourceId は (organizationId, sourceType, sourceId) の一意制約で、同時に集計しても同じ期間の行を 2 つ作らないためのもの
    if (!cur) await tx.expenseSchedule.create({ data: { organizationId, kind: 'withholding_tax', period: toDbDate(period), sourceType: WITHHOLDING_SOURCE, sourceId: period, ...data } })
    else if (cur.status !== 'paid') await tx.expenseSchedule.update({ where: { id: cur.id }, data })
    byPeriod.delete(period)
  }
  // 集計対象が無くなった（納付方法を変えた・報酬を取り消した）未払いの行は消す
  const stale = Array.from(byPeriod.values()).filter((r) => r.status !== 'paid').map((r) => r.id)
  if (stale.length) await tx.expenseSchedule.deleteMany({ where: { id: { in: stale }, organizationId } })
}

const WITHHOLDING_SOURCE = 'expense.withholding'

/**
 * 一意制約の衝突（P2002）と直列化の競合（P2034）のときに、処理を丸ごとやり直す。
 * 同じ契約の予定を、cron と画面の保存が同時に作ろうとしたときに起きる（システム点検の指摘）。
 * ⚠️ fn はトランザクション全体を渡すこと（やり直すと、前回の書き込みは巻き戻っている）。
 */
export async function retryOnConflict<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn()
    } catch (e) {
      const code = (e as { code?: string })?.code
      if (i >= attempts - 1 || (code !== 'P2002' && code !== 'P2034')) throw e
      await new Promise((r) => setTimeout(r, 100 * (i + 1) + Math.floor(Math.random() * 100)))
    }
  }
}

/** 契約 1 件を保存した直後に呼ぶ */
export async function resyncContract(organizationId: string, contractId: string) {
  await retryOnConflict(() =>
    prisma.$transaction(async (tx) => {
      await syncContractSchedules(tx, organizationId, contractId)
      await syncWithholding(tx, organizationId)
    }, { maxWait: 10000, timeout: 30000 })
  )
}

/** 組織の全契約（cron 用）。為替未設定などで失敗した契約は飛ばして件数を返す */
export async function resyncOrganization(organizationId: string): Promise<{ ok: number; failed: number }> {
  const contracts = await prisma.expenseContract.findMany({ where: { organizationId }, select: { id: true } })
  let ok = 0
  let failed = 0
  for (const c of contracts) {
    try {
      await retryOnConflict(() => prisma.$transaction((tx) => syncContractSchedules(tx, organizationId, c.id), { maxWait: 10000, timeout: 30000 }))
      ok++
    } catch {
      failed++
    }
  }
  await retryOnConflict(() => prisma.$transaction((tx) => syncWithholding(tx, organizationId), { maxWait: 10000, timeout: 30000 }))
  return { ok, failed }
}
