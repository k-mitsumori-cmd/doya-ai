import type { ClientDto } from './ClientForm'

export type ClientListRow = Pick<ClientDto, 'id' | 'name' | 'isActive' | 'billingDepartment' | 'billingContactName' | 'closingDay' | 'paymentMonths' | 'paymentDay'> & {
  _count: { contracts: number; invoices: number }
}
export type ContractListRow = {
  id: string; title: string; status: string; type: string; amountExclTax: number; billingCycle: string
  startDate: string; endDate: string | null; client: { id: string; name: string }
}
export type InvoiceListRow = {
  id: string; invoiceNo: string | null; title: string | null; status: string; issueDate: string; dueDate: string; totalInclTax: number
  client: { id: string; name: string }; state: { label: string | null; remaining: number; overdue: boolean }
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const nullableText = (v: unknown): v is string | null => v === null || typeof v === 'string'
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v)
const count = (v: unknown): v is number => integer(v) && v >= 0
const nullableCount = (v: unknown): v is number | null => v === null || count(v)
const client = (v: unknown): v is { id: string; name: string } => record(v) && text(v.id) && text(v.name)

function date(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(v)) return false
  const time = Date.parse(v)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === v.slice(0, 10)
}

function clientRow(v: unknown): v is ClientListRow {
  return record(v) && text(v.id) && text(v.name) && typeof v.isActive === 'boolean' &&
    nullableText(v.billingDepartment) && nullableText(v.billingContactName) &&
    nullableCount(v.closingDay) && nullableCount(v.paymentMonths) && nullableCount(v.paymentDay) &&
    record(v._count) && count(v._count.contracts) && count(v._count.invoices)
}

function contractRow(v: unknown): v is ContractListRow {
  return record(v) && text(v.id) && text(v.title) && text(v.status) && text(v.type) &&
    integer(v.amountExclTax) && text(v.billingCycle) && date(v.startDate) &&
    (v.endDate === null || date(v.endDate)) && client(v.client)
}

function invoiceRow(v: unknown): v is InvoiceListRow {
  return record(v) && text(v.id) && nullableText(v.invoiceNo) && nullableText(v.title) && text(v.status) &&
    date(v.issueDate) && date(v.dueDate) && integer(v.totalInclTax) && client(v.client) && record(v.state) &&
    nullableText(v.state.label) && count(v.state.remaining) && typeof v.state.overdue === 'boolean'
}

function list<T extends { id: string }>(raw: unknown, key: string, valid: (v: unknown) => v is T): T[] {
  const rows = record(raw) ? raw[key] : undefined
  if (!Array.isArray(rows) || !rows.every(valid) || new Set(rows.map((row) => row.id)).size !== rows.length) {
    throw new Error('一覧の応答を読み取れませんでした。もう一度お試しください。')
  }
  return rows
}

export const readClientListResponse = (raw: unknown): ClientListRow[] => list(raw, 'clients', clientRow)
export const readContractListResponse = (raw: unknown): ContractListRow[] => list(raw, 'contracts', contractRow)
export const readInvoiceListResponse = (raw: unknown): InvoiceListRow[] => list(raw, 'invoices', invoiceRow)
