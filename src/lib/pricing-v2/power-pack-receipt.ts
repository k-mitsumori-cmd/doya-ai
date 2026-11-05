// Verified cash-purchase facts survive while the point ledger is disabled.
// This module must not read or write point accounts, grants or transactions.
export type PurchaseReceipt = { id: string; companyId: string; sourceKey: string; amount: number; cancelTarget: number; cashAmount: number | null; cashRefunded: number | null; paymentIntentId: string | null }
type ReceiptDb = { $transaction: (fn: (tx: any) => Promise<any>, options?: any) => Promise<any> }
export type CashReceiptInput = { companyId: string; sourceKey: string; amount: number; cashAmount: number; paymentIntentId: string; cashRefunded?: number }
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200
const positiveInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647
function validReceipt(row: PurchaseReceipt): boolean {
  return validId(row.companyId) && validId(row.sourceKey) && positiveInt(row.amount) && Number.isSafeInteger(row.cancelTarget) && row.cancelTarget >= 0 && row.cancelTarget <= row.amount
    && (row.cashAmount === null || positiveInt(row.cashAmount))
    && (row.cashRefunded === null || (row.cashAmount !== null && Number.isSafeInteger(row.cashRefunded) && row.cashRefunded >= 0 && row.cashRefunded <= row.cashAmount))
}
function retryable(error: unknown): boolean { const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''; return code === 'P2002' || code === 'P2034' || code === 'CASH_RECEIPT_CHANGED' }
export async function recordPowerPackReceipt(db: ReceiptDb, input: CashReceiptInput): Promise<{ ok: true; receipt: PurchaseReceipt } | { ok: false; reason: 'invalid' | 'binding' }> {
  if (!validId(input.companyId) || !validId(input.sourceKey) || !validId(input.paymentIntentId) || !positiveInt(input.amount) || !positiveInt(input.cashAmount) || (input.cashRefunded !== undefined && (!Number.isSafeInteger(input.cashRefunded) || input.cashRefunded < 0 || input.cashRefunded > input.cashAmount))) return { ok: false, reason: 'invalid' }
  let last: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async tx => {
        const old: PurchaseReceipt | null = await tx.powerPackPurchase.findUnique({ where: { sourceKey: input.sourceKey } })
        if (old && !validReceipt(old)) throw new Error('Invalid persisted cash purchase')
        if (old && (old.companyId !== input.companyId || old.amount !== input.amount || (old.cashAmount !== null && old.cashAmount !== input.cashAmount) || (old.paymentIntentId !== null && old.paymentIntentId !== input.paymentIntentId))) return { ok: false as const, reason: 'binding' as const }
        // An ordinary paid Checkout does not establish that no refund exists. Keep unknown as null.
        const cashRefunded = input.cashRefunded === undefined ? old?.cashRefunded ?? null : Math.max(old?.cashRefunded ?? 0, input.cashRefunded)
        const measuredTarget = cashRefunded === null ? 0 : Number(BigInt(input.amount) * BigInt(cashRefunded) / BigInt(input.cashAmount))
        const cancelTarget = Math.max(old?.cancelTarget ?? 0, measuredTarget)
        const data = { companyId: input.companyId, sourceKey: input.sourceKey, amount: input.amount, cashAmount: input.cashAmount, paymentIntentId: input.paymentIntentId, cashRefunded, cancelTarget }
        if (!old) return { ok: true as const, receipt: await tx.powerPackPurchase.create({ data }) }
        const changed = await tx.powerPackPurchase.updateMany({ where: { id: old.id, cancelTarget: old.cancelTarget, cashRefunded: old.cashRefunded }, data })
        if (changed.count !== 1) throw Object.assign(new Error('Cash purchase changed'), { code: 'CASH_RECEIPT_CHANGED' })
        const receipt: PurchaseReceipt | null = await tx.powerPackPurchase.findUnique({ where: { sourceKey: input.sourceKey } })
        if (!receipt || !validReceipt(receipt)) throw new Error('Cash purchase update unavailable')
        return { ok: true as const, receipt }
      }, { isolationLevel: 'Serializable' })
    } catch (error) { if (!retryable(error)) throw error; last = error }
  }
  throw last
}
