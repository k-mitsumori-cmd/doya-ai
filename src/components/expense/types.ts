// ドヤ支出管理: 画面で使う API の返却形（src/lib/expense/dto.ts と合わせる）
import type { ExpenseRole } from '@/lib/expense/constants'

export type Role = ExpenseRole

export interface BankInfo {
  bankName: string | null
  bankBranch: string | null
  bankAccountType: string | null
  bankAccountNo: string | null
  bankAccountHolder: string | null
}

export interface Vendor {
  id: string
  kind: 'company' | 'individual'
  name: string
  role: string | null
  invoiceRegNo: string | null
  withholdingDefault: boolean
  closingDay: number
  paymentMonths: number
  paymentDay: number
  note: string | null
  bank: BankInfo | null
  hasBank: boolean
}

export interface Price {
  id: string
  effectiveFrom: string
  unitPrice: number
  quantity: number
  capQuantity: number | null
  taxRate: number
  taxIncluded: boolean
}

export interface PaymentMethod {
  id: string
  type: 'transfer' | 'card' | 'debit'
  label: string
  closingDay: number | null
  withdrawalMonths: number | null
  withdrawalDay: number | null
}

export interface Contract {
  id: string
  title: string
  category: string
  billingModel: string
  frequencyMonths: number
  anchorDate: string
  startDate: string
  endDate: string | null
  autoRenew: boolean
  renewalNoticeDays: number
  currency: string
  withholding: boolean
  forecastMode: string
  status: string
  note: string | null
  vendor: Vendor
  paymentMethod: PaymentMethod | null
  prices: Price[]
  currentPrice: Price | null
  nextPayment?: { date: string; netPayAmount: number; amountExclTax: number } | null
}

export interface Schedule {
  id: string
  kind: 'contract' | 'one_time' | 'withholding_tax' | string
  title: string
  category: string
  period: string
  plannedPayDate: string
  plannedAmountExclTax: number
  amountExclTax: number
  taxAmount: number
  withholdingAmount: number
  netPayAmount: number
  status: string
  paidOn: string | null
  paidAmount: number | null
  estimated: boolean
  contractId: string | null
  skipReason: string | null
  note: string | null
  vendorName: string | null
  vendorId: string | null
}

export interface ForecastCell {
  amount: number
  estimated: number
}
export interface ForecastMatrix {
  months: string[]
  categories: string[]
  cells: Record<string, Record<string, ForecastCell>>
  totals: Record<string, ForecastCell>
}
