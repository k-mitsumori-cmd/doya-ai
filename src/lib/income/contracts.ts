// ============================================
// ドヤ収入管理: 契約の保存と売上予定の同期
// ============================================
import type { Prisma } from '@prisma/client'
import { audit, IncomeError, type IncomeContext } from './access'
import { addMonthsYm, daysInMonth, formatYmd, fromDbDate, parseYmd, startOfMonth, toDbDate, todayJst, type Ymd } from './dates'
import { nextContractNo } from './contract-number'
import { asBody, bool, date, int, lines, oneOf, reqStr, str } from './parse'
import {
  BILLING_CYCLES, CONTRACT_TYPES, ISSUE_TIMINGS, PRORATES, SCHEDULE_HORIZON_MONTHS, buildSchedule,
  type BillingCycle, type ContractType, type IssueTiming, type Prorate,
} from './schedule'

export const CONTRACT_STATUSES = ['draft', 'active', 'paused', 'ended', 'cancelled'] as const
export type ContractStatus = (typeof CONTRACT_STATUSES)[number]

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: '下書き', active: '有効', paused: '停止中', ended: '終了', cancelled: '解約',
}

type Tx = Prisma.TransactionClient

export type ContractInput = {
  /** 既存の取引先。null のときは newClientName で取引先をその場で作る（新規登録のみ） */
  clientId: string | null
  newClientName: string | null
  title: string
  contractNo: string | null
  type: ContractType
  status: ContractStatus
  startDate: Ymd
  endDate: Ymd | null
  autoRenew: boolean
  renewalNoticeDays: number | null
  billingCycle: BillingCycle
  issueTiming: IssueTiming
  prorate: Prorate
  memo: string | null
  items: { name: string; quantity: number; unitPrice: number; taxRate: number }[]
  amountExclTax: number
}

export function parseContract(raw: unknown): ContractInput {
  const body = asBody(raw)
  const items = lines(body, 'items')
  // Phase1 は 1 契約 1 税率（売上予定を 1 行の請求明細にするため。設計書 §12 Q11）
  if (new Set(items.map((i) => i.taxRate)).size > 1) throw new IncomeError('1 つの契約の中では税率をそろえてください（税率ごとに契約を分けてください）')
  const amountExclTax = items.reduce((a, i) => a + i.quantity * i.unitPrice, 0)
  if (amountExclTax <= 0) throw new IncomeError('契約金額は 1 円以上にしてください')
  const startDate = date(body, 'startDate', '開始日', true)!
  const endDate = date(body, 'endDate', '終了日')
  if (endDate && endDate < startDate) throw new IncomeError('終了日は開始日以降にしてください')
  const type = oneOf(body, 'type', '契約の種類', CONTRACT_TYPES, 'recurring')
  const autoRenew = bool(body, 'autoRenew')
  if (autoRenew && !endDate) throw new IncomeError('自動更新にする場合は終了日（更新日）を入力してください')
  const clientId = str(body, 'clientId', '取引先', { max: 64 })
  const newClientName = clientId ? null : str(body, 'newClientName', '取引先名', { max: 120 })
  if (!clientId && !newClientName) throw new IncomeError('取引先を選ぶか、取引先名を入力してください')
  return {
    clientId,
    newClientName,
    title: reqStr(body, 'title', '契約名', 120),
    contractNo: str(body, 'contractNo', '契約番号', { max: 60 }),
    type,
    status: oneOf(body, 'status', '状態', CONTRACT_STATUSES, 'active'),
    startDate,
    endDate,
    autoRenew,
    renewalNoticeDays: int(body, 'renewalNoticeDays', '解約予告の日数', { min: 0, max: 365 }),
    billingCycle: oneOf(body, 'billingCycle', '請求サイクル', BILLING_CYCLES, 'monthly'),
    issueTiming: oneOf(body, 'issueTiming', '請求のタイミング', ISSUE_TIMINGS, 'arrears'),
    prorate: oneOf(body, 'prorate', '日割り', PRORATES, 'none'),
    memo: str(body, 'memo', 'メモ', { max: 2000 }),
    items,
    amountExclTax,
  }
}

export function horizonEnd(today: Ymd = todayJst()): Ymd {
  const t = parseYmd(today)
  const h = addMonthsYm(t.y, t.m, SCHEDULE_HORIZON_MONTHS)
  return formatYmd(h.y, h.m, daysInMonth(h.y, h.m))
}

/**
 * 契約の売上予定を作り直す。
 * - 請求済み（invoiced）・スキップ（skipped）の行は触らない
 * - 有効（active）なら、未請求（planned）の行を契約どおりに作り直す（足りない月は足し、要らない月は消す）
 * - 有効でないなら、今月以降の未請求の行を消す（過去の未請求は「請求漏れ」として残す）
 * ⚠️ @@unique([contractId, period]) があるので、cron と同時に走っても二重にならない
 */
export async function syncContractSchedule(tx: Tx, contractId: string, organizationId: string, today: Ymd = todayJst()) {
  const contract = await tx.incomeContract.findFirst({ where: { id: contractId, organizationId } })
  if (!contract) return
  const existing = await tx.incomeRevenueSchedule.findMany({ where: { contractId, organizationId } })
  const byPeriod = new Map(existing.map((r) => [fromDbDate(r.period), r]))

  if (contract.status !== 'active') {
    const from = toDbDate(startOfMonth(today))
    await tx.incomeRevenueSchedule.deleteMany({ where: { contractId, organizationId, status: 'planned', period: { gte: from } } })
    return
  }

  const rows = buildSchedule(
    {
      type: contract.type as ContractType,
      startDate: fromDbDate(contract.startDate),
      endDate: contract.endDate ? fromDbDate(contract.endDate) : null,
      autoRenew: contract.autoRenew,
      billingCycle: contract.billingCycle as BillingCycle,
      issueTiming: contract.issueTiming as IssueTiming,
      prorate: contract.prorate as Prorate,
      amountExclTax: contract.amountExclTax,
    },
    horizonEnd(today),
  )
  const wanted = new Set(rows.map((r) => r.period))
  const stale = existing.filter((r) => r.status === 'planned' && !wanted.has(fromDbDate(r.period))).map((r) => r.id)
  if (stale.length) await tx.incomeRevenueSchedule.deleteMany({ where: { id: { in: stale }, organizationId, status: 'planned' } })

  for (const row of rows) {
    const current = byPeriod.get(row.period)
    if (current && current.status !== 'planned') continue
    const data = { plannedIssueDate: toDbDate(row.plannedIssueDate), amountExclTax: row.amountExclTax, clientId: contract.clientId }
    await tx.incomeRevenueSchedule.upsert({
      where: { contractId_period: { contractId, period: toDbDate(row.period) } },
      create: { organizationId, contractId, period: toDbDate(row.period), status: 'planned', ...data },
      // upsert の update は status が planned のときだけ（上で除外済み。競合時も請求済みは上書きしない）
      update: current ? data : {},
    })
  }
}

export async function saveContract(tx: Tx, ctx: IncomeContext, input: ContractInput, contractId?: string) {
  let clientId = input.clientId
  if (clientId) {
    const client = await tx.incomeClient.findFirst({ where: { id: clientId, organizationId: ctx.organizationId }, select: { id: true } })
    if (!client) throw new IncomeError('取引先が見つかりません', 404)
  } else {
    // 取引先をその場で登録する（名前だけ。詳しい項目は取引先の画面であとから足せる）
    if (contractId) throw new IncomeError('取引先を選択してください')
    const created = await tx.incomeClient.create({ data: { organizationId: ctx.organizationId, name: input.newClientName! } })
    await audit(tx, ctx, 'client.create', 'client', created.id)
    clientId = created.id
  }
  let contractNo = input.contractNo
  if (contractNo) {
    const dup = await tx.incomeContract.findFirst({
      where: { organizationId: ctx.organizationId, contractNo, ...(contractId ? { id: { not: contractId } } : {}) },
      select: { id: true },
    })
    if (dup) throw new IncomeError(`契約番号「${contractNo}」はすでに使われています。別の番号にするか、空欄にして自動で振ってください`)
  } else if (!contractId) {
    contractNo = await nextContractNo(tx, ctx.organizationId)
  }
  const data = {
    clientId,
    title: input.title,
    contractNo,
    type: input.type,
    status: input.status,
    startDate: toDbDate(input.startDate),
    endDate: input.endDate ? toDbDate(input.endDate) : null,
    autoRenew: input.autoRenew,
    renewalNoticeDays: input.renewalNoticeDays,
    billingCycle: input.billingCycle,
    issueTiming: input.issueTiming,
    prorate: input.prorate,
    amountExclTax: input.amountExclTax,
    memo: input.memo,
  }
  let id = contractId
  if (id) {
    const own = await tx.incomeContract.findFirst({ where: { id, organizationId: ctx.organizationId }, select: { id: true, clientId: true } })
    if (!own) throw new IncomeError('契約が見つかりません', 404)
    if (own.clientId !== clientId) {
      const billed = await tx.incomeRevenueSchedule.count({ where: { contractId: id, organizationId: ctx.organizationId, status: { not: 'planned' } } })
      if (billed) throw new IncomeError('請求済みの月がある契約は取引先を変えられません')
    }
    await tx.incomeContract.update({ where: { id: own.id }, data })
    await tx.incomeContractItem.deleteMany({ where: { contractId: own.id } })
  } else {
    const created = await tx.incomeContract.create({ data: { ...data, organizationId: ctx.organizationId, createdByUserId: ctx.userId } })
    id = created.id
  }
  await tx.incomeContractItem.createMany({ data: input.items.map((it, i) => ({ ...it, contractId: id!, sortOrder: i })) })
  await syncContractSchedule(tx, id!, ctx.organizationId)
  return id!
}
