// ============================================
// ドヤ収入管理: 請求書の金額と消費税（適格請求書）
// ============================================
// ⚠️ 消費税の端数処理は「請求書 1 枚につき、税率ごとに 1 回」（インボイス制度の要件）。
//    明細ごとに丸めて合計してはいけない。端数は切り捨て。
// ⚠️ 金額はすべて整数の円。浮動小数を混ぜない。

export const TAX_RATES = [10, 8, 0] as const
export type TaxRate = (typeof TAX_RATES)[number]

export function isTaxRate(value: unknown): value is TaxRate {
  return typeof value === 'number' && (TAX_RATES as readonly number[]).includes(value)
}

export type LineInput = { quantity: number; unitPrice: number; taxRate: number }

export type TaxBreakdownRow = { rate: TaxRate; base: number; tax: number }

export type InvoiceTotals = {
  lineAmounts: number[]
  subtotalExclTax: number
  taxAmount: number
  totalInclTax: number
  taxBreakdown: TaxBreakdownRow[]
}

/** 上限 10 億円。誤入力で桁があふれないように */
export const MAX_YEN = 1_000_000_000

export function lineAmount(line: LineInput): number {
  if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0 || line.quantity > 100_000) throw new Error('数量は 1 以上の整数で指定してください')
  if (!Number.isSafeInteger(line.unitPrice) || Math.abs(line.unitPrice) > MAX_YEN) throw new Error('単価は整数（円）で指定してください')
  if (!isTaxRate(line.taxRate)) throw new Error('税率は 10 / 8 / 0 のいずれかです')
  return line.quantity * line.unitPrice
}

export function computeInvoiceTotals(lines: LineInput[]): InvoiceTotals {
  const lineAmounts = lines.map(lineAmount)
  const bases = new Map<TaxRate, number>()
  lines.forEach((line, i) => {
    const rate = line.taxRate as TaxRate
    bases.set(rate, (bases.get(rate) ?? 0) + lineAmounts[i])
  })
  const taxBreakdown: TaxBreakdownRow[] = TAX_RATES.filter((rate) => bases.has(rate)).map((rate) => {
    const base = bases.get(rate)!
    // 値引きで base が負になる税率は、税も負（切り捨ては 0 方向）
    const tax = Math.trunc((base * rate) / 100)
    return { rate, base, tax }
  })
  const subtotalExclTax = lineAmounts.reduce((a, b) => a + b, 0)
  const taxAmount = taxBreakdown.reduce((a, r) => a + r.tax, 0)
  const totalInclTax = subtotalExclTax + taxAmount
  if (totalInclTax < 0) throw new Error('請求額の合計がマイナスです')
  if (totalInclTax > MAX_YEN) throw new Error('請求額が大きすぎます')
  return { lineAmounts, subtotalExclTax, taxAmount, totalInclTax, taxBreakdown }
}

export function formatYen(n: number): string {
  return `¥${n.toLocaleString('ja-JP')}`
}
