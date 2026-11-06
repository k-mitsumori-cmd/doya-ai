import type { SheetInvoice } from './InvoiceSheet'
import { isTaxRate } from '@/lib/income/tax'

export type InvoiceDetailDto = Omit<SheetInvoice, 'items' | 'client'> & {
  id: string
  clientId: string
  paidAmount: number
  sentAt: string | null
  sentTo: string | null
  client: SheetInvoice['client'] & { id: string; billingEmail: string | null }
  items: (SheetInvoice['items'][number] & { scheduleId: string | null })[]
  allocations: { id: string; amount: number; matchedBy: string; payment: { id: string; receivedOn: string; amount: number; payerName: string | null } }[]
  state: { label: string | null; remaining: number; overdue: boolean }
}
export type InvoiceDetailLoaded = { invoice: InvoiceDetailDto; issuer: SheetInvoice['issuerSnapshot'] }

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string'
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)

function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(v)) return false
  const time = Date.parse(v)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v.slice(0, 10)
}

function optionalTextFields(v: unknown, keys: string[]): boolean {
  return record(v) && keys.every((key) => v[key] === undefined || nullableText(v[key]))
}

function issuer(v: unknown): v is SheetInvoice['issuerSnapshot'] {
  return v === null || optionalTextFields(v, ['companyName', 'postalCode', 'address', 'tel', 'personName', 'invoiceRegNo',
    'bankName', 'bankBranch', 'bankAccountType', 'bankAccountNo', 'bankAccountHolder', 'invoiceNotes'])
}

function item(v: unknown): v is InvoiceDetailDto['items'][number] {
  return record(v) && (v.id === undefined || nonempty(v.id)) && typeof v.name === 'string' &&
    integer(v.quantity) && v.quantity > 0 && integer(v.unitPrice) && isTaxRate(v.taxRate) &&
    integer(v.amountExclTax) && nullableText(v.scheduleId)
}

function allocation(v: unknown): v is InvoiceDetailDto['allocations'][number] {
  if (!record(v) || !nonempty(v.id) || !integer(v.amount) || !nonempty(v.matchedBy) || !record(v.payment)) return false
  const payment = v.payment
  return nonempty(payment.id) && date(payment.receivedOn) && integer(payment.amount) && nullableText(payment.payerName)
}

function invoice(v: unknown, expectedId: string): v is InvoiceDetailDto {
  if (!record(v) || !nonempty(v.id) || v.id !== expectedId || !nonempty(v.clientId) || !nonempty(v.status)) return false
  if (!record(v.client) || v.client.id !== v.clientId || !nonempty(v.client.name)) return false
  for (const key of ['postalCode', 'address', 'billingDepartment', 'billingContactName', 'billingEmail']) {
    if (!nullableText(v.client[key])) return false
  }
  for (const key of ['invoiceNo', 'title', 'notes', 'sentTo']) {
    if (!nullableText(v[key])) return false
  }
  if (v.voidReason !== undefined && !nullableText(v.voidReason)) return false
  if (!date(v.issueDate) || !date(v.dueDate) || !(v.sentAt === null || date(v.sentAt))) return false
  for (const key of ['subtotalExclTax', 'taxAmount', 'totalInclTax', 'paidAmount']) {
    if (!integer(v[key])) return false
  }
  if (!issuer(v.issuerSnapshot) || !(v.clientSnapshot === null || optionalTextFields(v.clientSnapshot, ['name', 'postalCode', 'address', 'department', 'contactName']))) return false
  if (!record(v.state) || !nullableText(v.state.label) || !integer(v.state.remaining) || v.state.remaining < 0 || typeof v.state.overdue !== 'boolean') return false
  if (v.taxBreakdown !== null && !(Array.isArray(v.taxBreakdown) && v.taxBreakdown.every((row) =>
    record(row) && isTaxRate(row.rate) && integer(row.base) && integer(row.tax)))) return false
  return Array.isArray(v.items) && v.items.every(item) && Array.isArray(v.allocations) && v.allocations.every(allocation)
}

/** 検証前の応答では帳票や編集・確定等の操作を開かず、既存の読込再試行へ戻す。 */
export function readInvoiceDetailResponse(raw: unknown, expectedId: string): InvoiceDetailLoaded {
  if (!record(raw) || !invoice(raw.invoice, expectedId) || !issuer(raw.issuer)) {
    throw new Error('請求書の応答を読み取れませんでした。もう一度お試しください。')
  }
  return { invoice: raw.invoice, issuer: raw.issuer }
}
