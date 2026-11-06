import type { ClientDto } from './ClientForm'
import { isValidPaymentTerms } from '@/lib/income/dates'

export type ClientDetailDto = ClientDto & {
  contracts: { id: string; title: string; status: string; amountExclTax: number; billingCycle: string; startDate: string; endDate: string | null }[]
  invoices: { id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; totalInclTax: number; state: { label: string | null; remaining: number } }[]
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

function contract(v: unknown): v is ClientDetailDto['contracts'][number] {
  return record(v) && nonempty(v.id) && typeof v.title === 'string' && nonempty(v.status) &&
    integer(v.amountExclTax) && nonempty(v.billingCycle) && date(v.startDate) && (v.endDate === null || date(v.endDate))
}

function invoice(v: unknown): v is ClientDetailDto['invoices'][number] {
  return record(v) && nonempty(v.id) && nullableText(v.invoiceNo) && nullableText(v.title) && nonempty(v.status) &&
    date(v.issueDate) && integer(v.totalInclTax) && record(v.state) && nullableText(v.state.label) &&
    integer(v.state.remaining) && v.state.remaining >= 0
}

function clientDetail(v: unknown, expectedId: string): v is ClientDetailDto {
  if (!record(v) || !nonempty(v.id) || v.id !== expectedId || !nonempty(v.name) || typeof v.isActive !== 'boolean') return false
  for (const key of ['corporateNumber', 'postalCode', 'address', 'billingDepartment', 'billingContactName', 'billingEmail', 'payerNameKana', 'note']) {
    if (!nullableText(v[key])) return false
  }
  if (v.updatedAt !== undefined && !date(v.updatedAt)) return false
  const { closingDay, paymentMonths, paymentDay } = v
  const noTerms = closingDay === null && paymentMonths === null && paymentDay === null
  if (!noTerms && !(integer(closingDay) && integer(paymentMonths) && integer(paymentDay) &&
    isValidPaymentTerms({ closingDay, paymentMonths, paymentDay }))) return false
  return Array.isArray(v.contracts) && v.contracts.every(contract) && Array.isArray(v.invoices) && v.invoices.every(invoice)
}

/** 欠損を空配列や0円へ補わず、既存の読込エラーと再試行へ戻す。 */
export function readClientDetailResponse(raw: unknown, expectedId: string): ClientDetailDto {
  const client = record(raw) ? raw.client : undefined
  if (!clientDetail(client, expectedId)) throw new Error('取引先の応答を読み取れませんでした。もう一度お試しください。')
  return client
}
