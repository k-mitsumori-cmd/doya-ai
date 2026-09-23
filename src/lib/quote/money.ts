// ============================================
// ドヤ見積もりAI 金額計算
// ============================================
// ⚠️ 金額は整数（円）だけで扱う。浮動小数を混ぜると丸め誤差が実害になる。
// ⚠️ 消費税は税率ごとに小計してから端数処理する（税率別の区分計算）。
//    行ごとに切り捨てると合計が合わず、実務で使えない。

/**
 * 合計に含める明細か。
 * ⚠️ この判定は**必ずここだけに置く**。画面・保存・PDFで別々に書いた結果、
 *    PDFの総額だけが「要見積」行を含み、顧客に届く見積書の合計が
 *    画面ともDBとも食い違っていた（2026-08-10 のレビューで発覚）。
 */
export function isBillableLine(l: { priceSource?: string | null; unitPrice: number }): boolean {
  return l.priceSource !== 'unknown' && l.unitPrice > 0
}

/** 合計対象の明細だけを取り出す */
export function billableLines<T extends { priceSource?: string | null; unitPrice: number }>(lines: T[]): T[] {
  return lines.filter(isBillableLine)
}

export interface LineForCalc {
  qty: number
  unitPrice: number
  taxRate: number
}

export interface QuoteTotals {
  /** 税率別の小計（税抜） */
  subtotalByRate: Record<number, number>
  /** 値引き後の税抜合計 */
  totalExclTax: number
  /** 税率別の消費税額 */
  taxByRate: Record<number, number>
  taxAmount: number
  totalInclTax: number
  discountAmount: number
}

/** 端数処理は切り捨てで統一する（1か所に集約し、他所で丸めない） */
function round(n: number): number {
  return Math.floor(n)
}

export function calcTotals(
  lines: LineForCalc[],
  discountType?: string | null,
  discountValue = 0
): QuoteTotals {
  const subtotalByRate: Record<number, number> = {}
  for (const l of lines) {
    const rate = Number.isFinite(l.taxRate) ? l.taxRate : 10
    const amount = round(Math.max(0, l.qty) * Math.max(0, l.unitPrice))
    subtotalByRate[rate] = (subtotalByRate[rate] || 0) + amount
  }

  const rawTotal = Object.values(subtotalByRate).reduce((a, b) => a + b, 0)

  // 値引きは税抜合計に対して掛け、税率別の小計へ按分する。
  // 按分しないと、複数税率があるときに税額が合わなくなる。
  let discountAmount = 0
  if (discountType === 'rate') {
    discountAmount = round((rawTotal * Math.max(0, Math.min(100, discountValue))) / 100)
  } else if (discountType === 'amount') {
    discountAmount = Math.min(rawTotal, Math.max(0, round(discountValue)))
  }

  // 割引後の整数円を税率別に配る。小数の比率を掛けると、
  // 単一税率でも15円が14.999...円となり1円失われる。
  const totalExclTax = rawTotal - discountAmount
  const denominator = BigInt(rawTotal || 1)
  const allocations = Object.entries(subtotalByRate).map(([rateStr, sub]) => {
    const numerator = BigInt(sub) * BigInt(totalExclTax)
    return {
      rate: Number(rateStr),
      amount: Number(numerator / denominator),
      remainder: numerator % denominator,
    }
  })
  // 切り捨てで余った円を剰余の大きい税率から1円ずつ配る。
  // 同じ剰余なら税率の低い順とし、明細順序に依存させない。
  allocations.sort((a, b) => a.remainder === b.remainder
    ? a.rate - b.rate : a.remainder > b.remainder ? -1 : 1)
  const remaining = totalExclTax - allocations.reduce((sum, a) => sum + a.amount, 0)
  const taxByRate: Record<number, number> = {}
  allocations.forEach((a, index) => {
    const afterDiscount = a.amount + (index < remaining ? 1 : 0)
    taxByRate[a.rate] = round((afterDiscount * a.rate) / 100)
  })

  const taxAmount = Object.values(taxByRate).reduce((a, b) => a + b, 0)
  return {
    subtotalByRate,
    totalExclTax,
    taxByRate,
    taxAmount,
    totalInclTax: totalExclTax + taxAmount,
    discountAmount,
  }
}

/** 表示用（3桁区切り・円） */
export function yen(n: number | null | undefined): string {
  if (n == null) return '—'
  return `¥${Math.round(n).toLocaleString('ja-JP')}`
}
