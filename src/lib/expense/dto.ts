// ============================================
// ドヤ支出管理: API の返却形（DB の行 → JSON）
// ============================================
// ⚠️ 振込先口座は manager 以上にだけ返す（設計書 §9 権限）
import type { ExpenseContract, ExpenseContractPrice, ExpensePaymentMethod, ExpenseSchedule, ExpenseVendor } from '@prisma/client'
import { hasMinRole, type ExpenseContext } from './access'
import { fromDbDate } from './dates'
import { toRowLike } from './sync'

export function vendorDto(v: ExpenseVendor, ctx: ExpenseContext) {
  const canSeeBank = hasMinRole(ctx.role, 'manager')
  return {
    id: v.id,
    kind: v.kind,
    name: v.name,
    role: v.role,
    invoiceRegNo: v.invoiceRegNo,
    withholdingDefault: v.withholdingDefault,
    closingDay: v.closingDay,
    paymentMonths: v.paymentMonths,
    paymentDay: v.paymentDay,
    note: v.note,
    bank: canSeeBank
      ? { bankName: v.bankName, bankBranch: v.bankBranch, bankAccountType: v.bankAccountType, bankAccountNo: v.bankAccountNo, bankAccountHolder: v.bankAccountHolder }
      : null,
    hasBank: !!v.bankAccountNo,
  }
}

export function priceDto(p: ExpenseContractPrice) {
  return {
    id: p.id,
    effectiveFrom: fromDbDate(p.effectiveFrom),
    unitPrice: p.unitPrice,
    quantity: p.quantity,
    capQuantity: p.capQuantity,
    taxRate: p.taxRate,
    taxIncluded: p.taxIncluded,
  }
}

export function paymentMethodDto(m: ExpensePaymentMethod) {
  return { id: m.id, type: m.type, label: m.label, closingDay: m.closingDay, withdrawalMonths: m.withdrawalMonths, withdrawalDay: m.withdrawalDay }
}

export function contractDto(
  c: ExpenseContract & { prices: ExpenseContractPrice[]; vendor: ExpenseVendor; paymentMethod: ExpensePaymentMethod | null },
  ctx: ExpenseContext
) {
  const prices = [...c.prices].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime()).map(priceDto)
  return {
    id: c.id,
    title: c.title,
    category: c.category,
    billingModel: c.billingModel,
    frequencyMonths: c.frequencyMonths,
    anchorDate: fromDbDate(c.anchorDate),
    startDate: fromDbDate(c.startDate),
    endDate: c.endDate ? fromDbDate(c.endDate) : null,
    autoRenew: c.autoRenew,
    renewalNoticeDays: c.renewalNoticeDays,
    currency: c.currency,
    withholding: c.withholding,
    forecastMode: c.forecastMode,
    status: c.status,
    note: c.note,
    vendor: vendorDto(c.vendor, ctx),
    paymentMethod: c.paymentMethod ? paymentMethodDto(c.paymentMethod) : null,
    prices,
    currentPrice: prices[prices.length - 1] ?? null,
  }
}

export function scheduleDto(r: ExpenseSchedule & { contract?: (ExpenseContract & { vendor: ExpenseVendor }) | null }) {
  return {
    ...toRowLike(r),
    skipReason: r.skipReason,
    note: r.note,
    vendorName: r.contract?.vendor.name ?? null,
    vendorId: r.contract?.vendorId ?? null,
  }
}
