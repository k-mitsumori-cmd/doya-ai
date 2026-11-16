// ============================================
// 新しい料金の Stripe の価格 ID（環境変数で受ける）
// ============================================
// ⚠️ Stripe 側の商品・価格は、このコードでは作らない。手順は設計書 §8（統括がユーザーの承認を取って作る）。
// ⚠️ 環境変数が無いときは「未設定」として扱い、新しい料金の Checkout を作らない（既定の文字列で埋めない）。
// ⚠️ 新しい価格 ID が、今の価格（STRIPE_PRICE_BANNER_PRO_MONTHLY など）と同じなら設定の誤りとして使わない。
//    同じだと、今の契約者が新しい料金の契約に見えてしまう（据え置きの見分けが崩れる）。
// Stripe の SDK を読まない（テストで秘密鍵なしに動かすため）。

import type { PricingModel } from './plans'

export type Env = Record<string, string | undefined>

/** 新しい料金の planId。末尾が -pro なので planTierFromPlanId() は PRO を返す（User.plan も PRO） */
export const TEAM_PLAN_ID = 'team-pro'

/** 環境変数の名前（設計書 §8 と同じ） */
export const NEW_PRICE_ENV = {
  baseMonthly: 'STRIPE_PRICE_TEAM_BASE_MONTHLY',
  baseYearly: 'STRIPE_PRICE_TEAM_BASE_YEARLY',
  seatMonthly: 'STRIPE_PRICE_TEAM_SEAT_MONTHLY',
  seatYearly: 'STRIPE_PRICE_TEAM_SEAT_YEARLY',
  /** 1人いくらの料金（基本料なし）の、人数の価格。段ごとの価格（graduated）1つを月払い・年払いで作る（1〜10人 3,980円・11〜30人 2,980円・31〜49人 2,480円。2026-11-10 追加。旗 PER_SEAT_PRICING_ROLLOUT が on のときだけ使う） */
  seatOnlyMonthly: 'STRIPE_PRICE_SEAT_ONLY_MONTHLY',
  seatOnlyYearly: 'STRIPE_PRICE_SEAT_ONLY_YEARLY',
  powerPack: 'STRIPE_PRICE_POWER_PACK',
  /** 任意。消費税（内税 10%）の Stripe の税率 ID。請求書に消費税の額を出すため */
  taxRate: 'STRIPE_TAX_RATE_JP_10',
} as const

const NEW_ENV_NAMES = new Set<string>(Object.values(NEW_PRICE_ENV))

function read(env: Env, name: string, prefix = 'price_'): string | null {
  const v = (env[name] ?? '').trim()
  return v.startsWith(prefix) && v.length > prefix.length ? v : null
}

/** 今の価格（据え置きの契約者が払っている価格）の ID。STRIPE_PRICE_ で始まり、新しい料金のものでない全部 */
export function legacyPriceIds(env: Env): Set<string> {
  const out = new Set<string>()
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('STRIPE_PRICE_') || NEW_ENV_NAMES.has(k)) continue
    const id = (v ?? '').trim()
    if (id) out.add(id)
  }
  return out
}

export type TeamPriceConfig =
  | { ok: true; base: { monthly: string; yearly: string }; seat: { monthly: string; yearly: string }; taxRate: string | null }
  | { ok: false; reason: 'missing' | 'overlaps_legacy' | 'duplicated' }

/** チームの価格の設定を読む。4つそろい、今の価格と重ならないときだけ ok */
export function teamPriceConfig(env: Env = process.env): TeamPriceConfig {
  const baseMonthly = read(env, NEW_PRICE_ENV.baseMonthly)
  const baseYearly = read(env, NEW_PRICE_ENV.baseYearly)
  const seatMonthly = read(env, NEW_PRICE_ENV.seatMonthly)
  const seatYearly = read(env, NEW_PRICE_ENV.seatYearly)
  if (!baseMonthly || !baseYearly || !seatMonthly || !seatYearly) return { ok: false, reason: 'missing' }
  const ids = [baseMonthly, baseYearly, seatMonthly, seatYearly]
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'duplicated' }
  const legacy = legacyPriceIds(env)
  if (ids.some((id) => legacy.has(id))) return { ok: false, reason: 'overlaps_legacy' }
  return {
    ok: true,
    base: { monthly: baseMonthly, yearly: baseYearly },
    seat: { monthly: seatMonthly, yearly: seatYearly },
    taxRate: read(env, NEW_PRICE_ENV.taxRate, 'txr_'),
  }
}

export type PerSeatPriceConfig =
  | { ok: true; seat: { monthly: string; yearly: string }; taxRate: string | null }
  | { ok: false; reason: 'missing' | 'overlaps_legacy' | 'duplicated' }

/**
 * 1人いくらの料金（基本料なし）の価格の設定。月払いと年払いの 2 つがそろい、今の価格・基本料ありの価格と重ならないときだけ ok。
 * 基本料ありの価格が未設定でも、これだけで ok になる（基本料の価格は使わなくなるため）。
 */
export function perSeatPriceConfig(env: Env = process.env): PerSeatPriceConfig {
  const monthly = read(env, NEW_PRICE_ENV.seatOnlyMonthly)
  const yearly = read(env, NEW_PRICE_ENV.seatOnlyYearly)
  if (!monthly || !yearly) return { ok: false, reason: 'missing' }
  if (monthly === yearly) return { ok: false, reason: 'duplicated' }
  const legacy = legacyPriceIds(env)
  if (legacy.has(monthly) || legacy.has(yearly)) return { ok: false, reason: 'overlaps_legacy' }
  const base = teamPriceConfig(env)
  if (base.ok) {
    const used = new Set([base.base.monthly, base.base.yearly, base.seat.monthly, base.seat.yearly])
    if (used.has(monthly) || used.has(yearly)) return { ok: false, reason: 'duplicated' }
  }
  return { ok: true, seat: { monthly, yearly }, taxRate: read(env, NEW_PRICE_ENV.taxRate, 'txr_') }
}

/**
 * 新しい料金の Checkout を作れる設定か（料金の形ごと）。
 * base_plus_seat は今までどおり teamPriceConfig().ok だけを見る（旗が off のときの動きを変えない）。
 */
export function checkoutConfigured(model: PricingModel, env: Env = process.env): boolean {
  return model === 'per_seat' ? perSeatPriceConfig(env).ok : teamPriceConfig(env).ok
}

/**
 * 新しい料金の仕組み（会社の表・人数の読み取り）を動かせる設定か。
 * 基本料ありの価格がそろっているか、1人いくらの価格がそろっているときに true。
 * 1人いくらの価格だけで動かすのは、旗 PER_SEAT_PRICING_ROLLOUT が off でないときだけ。
 */
export function teamPricingConfigured(perSeatOn: boolean, env: Env = process.env): boolean {
  return teamPriceConfig(env).ok || (perSeatOn && perSeatPriceConfig(env).ok)
}

/**
 * teamPricingConfigured を、旗 PER_SEAT_PRICING_ROLLOUT（env の値）で呼ぶ。旗が off（値が無い・知らない値も）なら、基本料ありの設定だけを見る（今までと同じ）。
 * ⚠️ rollout.ts を読み込まない（セキュリティ回帰テストが prices.ts を単独で読み込むため）。旗の読み方は rollout.ts の parsePerSeatPricingRollout と同じ。
 */
export function teamPricingOperable(env: Env = process.env): boolean {
  const v = (env.PER_SEAT_PRICING_ROLLOUT ?? '').trim().toLowerCase()
  return teamPricingConfigured(v === 'preview' || v === 'all', env)
}

/** 新しい料金の価格 ID の一覧（設定が正しいものだけ。基本料あり・1人いくらの両方） */
export function newPricingPriceIds(env: Env = process.env): Set<string> {
  const out = new Set<string>()
  const c = teamPriceConfig(env)
  if (c.ok) for (const id of [c.base.monthly, c.base.yearly, c.seat.monthly, c.seat.yearly]) out.add(id)
  const p = perSeatPriceConfig(env)
  if (p.ok) { out.add(p.seat.monthly); out.add(p.seat.yearly) }
  return out
}

/** 人数の明細（数量が人数になる価格）の ID の一覧。基本料あり・1人いくらの両方 */
export function seatItemPriceIds(env: Env = process.env): Set<string> {
  const out = new Set<string>()
  const c = teamPriceConfig(env)
  if (c.ok) { out.add(c.seat.monthly); out.add(c.seat.yearly) }
  const p = perSeatPriceConfig(env)
  if (p.ok) { out.add(p.seat.monthly); out.add(p.seat.yearly) }
  return out
}

/** 人数の明細の価格の間隔（月か年か）。人数の明細でなければ null */
export function seatItemInterval(priceId: string | null | undefined, env: Env = process.env): 'month' | 'year' | null {
  if (!priceId) return null
  const c = teamPriceConfig(env)
  const p = perSeatPriceConfig(env)
  if ((c.ok && c.seat.yearly === priceId) || (p.ok && p.seat.yearly === priceId)) return 'year'
  if ((c.ok && c.seat.monthly === priceId) || (p.ok && p.seat.monthly === priceId)) return 'month'
  return null
}

/** 契約の人数の価格 ID から、その契約の料金の形を決める（1人いくらの価格なら per_seat。それ以外は今までの形） */
export function contractPricingModel(stripePriceId: string | null | undefined, env: Env = process.env): PricingModel {
  if (!stripePriceId) return 'base_plus_seat'
  const p = perSeatPriceConfig(env)
  return p.ok && (p.seat.monthly === stripePriceId || p.seat.yearly === stripePriceId) ? 'per_seat' : 'base_plus_seat'
}

/** 価格 ID → planId（新しい料金のものだけ。それ以外は null で、今までの対応表に任せる） */
export function newPricingPlanIdForPriceId(priceId: string | null | undefined, env: Env = process.env): typeof TEAM_PLAN_ID | null {
  if (!priceId) return null
  return newPricingPriceIds(env).has(priceId) ? TEAM_PLAN_ID : null
}

export interface CheckoutLineItem {
  price: string
  quantity: number
  tax_rates?: string[]
}

/**
 * チームの Checkout の明細（基本料1 ＋ 人数）。人数の段階の額は Stripe の段階別の価格が計算する。
 * 設定が無い・人数が範囲外なら null（Checkout を作らない）。
 */
export function buildTeamLineItems(
  input: { seats: number; interval: 'monthly' | 'yearly' },
  isValidSeats: (n: unknown) => boolean,
  env: Env = process.env,
  model: PricingModel = 'base_plus_seat',
): CheckoutLineItem[] | null {
  if (model === 'per_seat') {
    // 1人いくら: 基本料の明細は付けず、人数の明細だけ。価格 ID は STRIPE_PRICE_SEAT_ONLY_*
    const p = perSeatPriceConfig(env)
    if (!p.ok || !isValidSeats(input.seats)) return null
    return [{ price: p.seat[input.interval === 'yearly' ? 'yearly' : 'monthly'], quantity: input.seats, ...(p.taxRate ? { tax_rates: [p.taxRate] } : {}) }]
  }
  const c = teamPriceConfig(env)
  if (!c.ok || !isValidSeats(input.seats)) return null
  const tax = c.taxRate ? { tax_rates: [c.taxRate] } : {}
  return [
    { price: c.base[input.interval], quantity: 1, ...tax },
    { price: c.seat[input.interval], quantity: input.seats, ...tax },
  ]
}

/** 追加購入（一回払い）の価格 ID。未設定・形が違う・今の価格やチームの価格と同じなら null（売らない） */
export function powerPackPriceId(env: Env = process.env): string | null {
  const id = read(env, NEW_PRICE_ENV.powerPack)
  if (!id) return null
  if (legacyPriceIds(env).has(id) || newPricingPriceIds(env).has(id)) return null
  return id
}

/** 追加購入の一回の数（パックの数）の上限 */
export const POWER_PACK_MAX_PER_ORDER = 10
