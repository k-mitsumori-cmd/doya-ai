// ============================================
// 契約の1回の請求額（明細が複数・段階別の価格に対応。DB と Stripe に触らない計算）
// ============================================
// 日次監査の月次売上の見込み（MRR）で使う（src/lib/billing-audit.ts）。
// 今までは最初の明細の単価だけで計算していたので、新しい料金のチーム（基本料＋人数。人数は段階別の価格）を少なく数えていた。
// - 定額の価格: unit_amount × 数量
// - 段階別（graduated）: 各段の (その段の人数 × unit_amount ＋ flat_amount) の合計
// - 段階別（volume）: 数量が入る段の unit_amount × 数量 ＋ flat_amount
// - 段階の表が無い段階別の価格は、計算できないので known=false（0 として足さない）

export interface TierLike {
  up_to: number | null
  unit_amount: number | null
  flat_amount: number | null
}

export interface PriceLike {
  id: string
  unit_amount: number | null
  billing_scheme?: string | null
  tiers_mode?: string | null
  tiers?: TierLike[] | null
  recurring?: { interval?: string | null; interval_count?: number | null } | null
}

export interface ItemLike {
  quantity?: number | null
  price: PriceLike
}

/** 段階別の価格の額。tiers は up_to の小さい順（null は最後の上限なし） */
export function tieredAmount(tiers: TierLike[], quantity: number, mode: string | null | undefined): number {
  const q = Math.max(0, Math.floor(quantity))
  if (q === 0) return 0
  if (mode === 'volume') {
    const t = tiers.find((x) => x.up_to === null || q <= x.up_to) ?? tiers[tiers.length - 1]
    return t ? (t.unit_amount ?? 0) * q + (t.flat_amount ?? 0) : 0
  }
  let sum = 0
  let prev = 0
  for (const t of tiers) {
    const cap = t.up_to === null ? q : Math.min(q, t.up_to)
    const n = cap - prev
    if (n > 0) sum += n * (t.unit_amount ?? 0) + (t.flat_amount ?? 0)
    if (t.up_to === null || q <= t.up_to) break
    prev = t.up_to
  }
  return sum
}

/** 明細1つの額。tiersByPrice は、明細の価格に段階の表が付いていないときに使う（価格 ID → 段階の表） */
export function itemAmount(item: ItemLike, tiersByPrice: Map<string, TierLike[]> = new Map()): { amount: number; known: boolean } {
  const qty = typeof item.quantity === 'number' ? item.quantity : 1
  const p = item.price
  if (p.billing_scheme === 'tiered') {
    const tiers = p.tiers ?? tiersByPrice.get(p.id)
    if (!tiers || tiers.length === 0) return { amount: 0, known: false }
    return { amount: tieredAmount(tiers, qty, p.tiers_mode), known: true }
  }
  return { amount: (p.unit_amount ?? 0) * qty, known: true }
}

/** 契約の1回の請求額（全部の明細の合計）と、その間隔。間隔は最初の明細の価格から読む */
export function subscriptionAmount(items: ItemLike[], tiersByPrice?: Map<string, TierLike[]>): {
  amount: number
  known: boolean
  interval: string | null
  intervalCount: number
} {
  let amount = 0
  let known = true
  for (const it of items) {
    const r = itemAmount(it, tiersByPrice)
    amount += r.amount
    if (!r.known) known = false
  }
  const rec = items[0]?.price.recurring
  return { amount, known, interval: rec?.interval ?? null, intervalCount: Math.max(1, Number(rec?.interval_count || 1)) }
}

/** 段階の表を取りに行く必要がある価格 ID（段階別で、表が付いていないもの） */
export function tieredPriceIdsMissingTiers(items: ItemLike[]): string[] {
  const out = new Set<string>()
  for (const it of items) if (it.price.billing_scheme === 'tiered' && !(it.price.tiers && it.price.tiers.length)) out.add(it.price.id)
  return [...out]
}
