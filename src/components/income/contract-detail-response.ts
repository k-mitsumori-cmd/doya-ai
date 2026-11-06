import type { ContractDto } from './ContractForm'
import { isTaxRate } from '@/lib/income/tax'

export type ContractDetailDto = ContractDto & {
  client: { id: string; name: string }
  schedules: {
    id: string; period: string; plannedIssueDate: string; amountExclTax: number; status: string; skipReason: string | null
    invoiceItem: { invoice: { id: string; invoiceNo: string | null; status: string } } | null
  }[]
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string'
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(v)) return false
  const time = Date.parse(v)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v.slice(0, 10)
}

function item(v: unknown): v is ContractDto['items'][number] {
  return record(v) && typeof v.name === 'string' && integer(v.quantity) && v.quantity > 0 &&
    integer(v.unitPrice) && isTaxRate(v.taxRate)
}

function schedule(v: unknown): v is ContractDetailDto['schedules'][number] {
  if (!record(v) || !nonempty(v.id) || !date(v.period) || !date(v.plannedIssueDate) ||
    !integer(v.amountExclTax) || !nonempty(v.status) || !nullableText(v.skipReason)) return false
  if (v.invoiceItem === null) return true
  if (!record(v.invoiceItem) || !record(v.invoiceItem.invoice)) return false
  const invoice = v.invoiceItem.invoice
  return nonempty(invoice.id) && nullableText(invoice.invoiceNo) && nonempty(invoice.status)
}

function contractDetail(v: unknown, expectedId: string): v is ContractDetailDto {
  if (!record(v) || !nonempty(v.id) || v.id !== expectedId || !nonempty(v.title) || !nonempty(v.clientId)) return false
  if (!record(v.client) || v.client.id !== v.clientId || !nonempty(v.client.name)) return false
  if (!nullableText(v.contractNo) || !nullableText(v.memo) || typeof v.autoRenew !== 'boolean') return false
  if (v.renewalNoticeDays !== null && !(integer(v.renewalNoticeDays) && v.renewalNoticeDays >= 0)) return false
  for (const key of ['type', 'status', 'billingCycle', 'issueTiming', 'prorate']) {
    if (!nonempty(v[key])) return false
  }
  return date(v.startDate) && (v.endDate === null || date(v.endDate)) &&
    Array.isArray(v.items) && v.items.every(item) && Array.isArray(v.schedules) && v.schedules.every(schedule)
}

/** 別の契約や欠けた金額・明細を編集フォームへ渡さず、読込の再試行へ戻す。 */
export function readContractDetailResponse(raw: unknown, expectedId: string): ContractDetailDto {
  const contract = record(raw) ? raw.contract : undefined
  if (!contractDetail(contract, expectedId)) throw new Error('契約の応答を読み取れませんでした。もう一度お試しください。')
  return contract
}
