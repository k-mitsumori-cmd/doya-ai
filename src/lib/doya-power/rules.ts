// ドヤパワーの決まり（定数と、DB に触らない計算）。
// 日付・月の切り替えは日本時間（Asia/Tokyo）。日本には夏時間が無いので、UTC+9 の固定で計算する
// （Intl のタイムゾーンの表に頼らない。サーバーの TZ の設定にも左右されない）。

/** 付与の種類 */
/**
 * 付与の種類。starter は「はじめの付与（最初の100）」（2026-10-26。src/lib/pricing-v2/starter.ts）。
 * 期限なし・回復の上限で削られない。毎日の回復の計算では、starter の残りも回復でためた分に数える（100 から始まり、使った分が戻る）
 */
export const GRANT_KINDS = ['monthly', 'daily_recovery', 'bonus', 'mission', 'purchase', 'starter'] as const
/** 毎日の回復の計算で「回復でためた分」に数える種類 */
export const RECOVERY_POOL_KINDS: readonly string[] = ['daily_recovery', 'starter']
export type GrantKind = (typeof GRANT_KINDS)[number]
export function isGrantKind(v: unknown): v is GrantKind {
  return typeof v === 'string' && (GRANT_KINDS as readonly string[]).includes(v)
}

/** 無料の毎日の回復: 1日の量と、回復で貯まる上限 */
export const DAILY_RECOVERY_AMOUNT = 10
export const DAILY_RECOVERY_CAP = 100

/** はじめの手順（bonus）とミッション（mission）の付与の、会社ごとの月の上限 */
export const MONTHLY_BONUS_CAP = 200
export const BONUS_KINDS: readonly GrantKind[] = ['bonus', 'mission']

/** 追加購入の有効期限の上限（か月）。前払式支払手段の扱いを避けるため 6 か月以内に必ず収める（法務の確認が要る） */
export const PURCHASE_MAX_MONTHS = 6

/** 毎月の付与の使い残しを繰り越せる月数（1 = 翌月の終わりまで使える） */
export const MONTHLY_CARRYOVER_MONTHS = 1

/**
 * 毎月の付与（旗 NEW_PRICING_ROLLOUT が off のとき・対象でない人の量。今までどおり）。
 * 新しい料金の対象の人は、料金の表（src/lib/pricing-v2/plans.ts）の量を使う（据え置き 1,500・チームは人数から）。
 * 切り替えは台帳の newPricingMonthlyGrantFor（index.ts → src/lib/pricing-v2/team.server.ts の newPricingMonthlyGrant）。
 */
export const TEAM_MONTHLY_GRANT = 3000
export const SOLO_PRO_MONTHLY_GRANT = TEAM_MONTHLY_GRANT

/** 一度に動かせる量の上限（打ち間違い・桁あふれの防止） */
export const MAX_AMOUNT_PER_OPERATION = 1_000_000

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

function jstParts(d: Date) {
  const j = new Date(d.getTime() + JST_OFFSET_MS)
  return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, day: j.getUTCDate() }
}
const pad = (n: number) => String(n).padStart(2, '0')

/** 日本時間の日付（YYYY-MM-DD） */
export function jstDayKey(d: Date): string {
  const p = jstParts(d)
  return `${p.y}-${pad(p.m)}-${pad(p.day)}`
}
/** 日本時間の年月（YYYY-MM） */
export function jstMonthKey(d: Date): string {
  const p = jstParts(d)
  return `${p.y}-${pad(p.m)}`
}
/** 日本時間のその日の 0:00 */
export function jstStartOfDay(d: Date): Date {
  const p = jstParts(d)
  return new Date(Date.UTC(p.y, p.m - 1, p.day) - JST_OFFSET_MS)
}
/** 日本時間の次の日の 0:00 */
export function jstNextDayStart(d: Date): Date {
  return new Date(jstStartOfDay(d).getTime() + DAY_MS)
}
/** 日本時間のその月の 1日 0:00 から、months か月後の 1日 0:00 */
export function jstMonthStart(d: Date, months = 0): Date {
  const p = jstParts(d)
  return new Date(Date.UTC(p.y, p.m - 1 + months, 1) - JST_OFFSET_MS)
}
/** 日本時間の日付の差（b − a の日数）。dayKey は YYYY-MM-DD */
export function jstDaysBetween(aKey: string, bKey: string): number {
  const t = (k: string) => Date.UTC(Number(k.slice(0, 4)), Number(k.slice(5, 7)) - 1, Number(k.slice(8, 10)))
  return Math.round((t(bKey) - t(aKey)) / DAY_MS)
}
/** 日本時間で months か月後の同じ時刻（月末は丸める。1/31 + 1 か月 = 2/28 or 29） */
export function jstAddMonths(d: Date, months: number): Date {
  const j = new Date(d.getTime() + JST_OFFSET_MS)
  const y = j.getUTCFullYear()
  const m = j.getUTCMonth() + months
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const out = Date.UTC(y, m, Math.min(j.getUTCDate(), last), j.getUTCHours(), j.getUTCMinutes(), j.getUTCSeconds(), j.getUTCMilliseconds())
  return new Date(out - JST_OFFSET_MS)
}

/** 毎月の付与の有効期限: 付与した月の翌月の終わり（＝ 2 か月後の 1日 0:00）。使い残しは1か月分まで繰り越す */
export function monthlyGrantExpiresAt(grantedAt: Date): Date {
  return jstMonthStart(grantedAt, 1 + MONTHLY_CARRYOVER_MONTHS)
}

/** 追加購入の有効期限を 6 か月以内に収める（指定が無い・遅すぎるときは上限に、過去なら null＝不正） */
export function clampPurchaseExpiresAt(grantedAt: Date, requested?: Date | null): Date | null {
  const max = jstAddMonths(grantedAt, PURCHASE_MAX_MONTHS)
  if (!requested) return max
  if (!(requested instanceof Date) || Number.isNaN(requested.getTime())) return null
  if (requested.getTime() <= grantedAt.getTime()) return null
  return requested.getTime() > max.getTime() ? max : requested
}

/** プランごとの毎月の付与（無料は 0。今の 1人の PRO はチームと同じ量） */
export function monthlyGrantForPlan(plan: string | null | undefined, isPaid: (p?: string | null) => boolean): number {
  return isPaid(plan) ? SOLO_PRO_MONTHLY_GRANT : 0
}

/** 量として正しいか（正の整数・上限以内） */
export function isValidAmount(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= MAX_AMOUNT_PER_OPERATION
}

export type GrantLike = { id: string; kind: string; remaining: number; expiresAt: Date | null; grantedAt: Date }

/** 今使える付与か（残りがあり、期限が来ていない） */
export function isUsable(g: GrantLike, now: Date): boolean {
  return g.remaining > 0 && (g.expiresAt === null || g.expiresAt.getTime() > now.getTime())
}

/** 減らす順: 期限の近い順（期限なしは最後）→ 古い付与から → id */
export function consumeOrder(a: GrantLike, b: GrantLike): number {
  const ea = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY
  const eb = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY
  if (ea !== eb) return ea < eb ? -1 : 1
  const ga = a.grantedAt.getTime()
  const gb = b.grantedAt.getTime()
  if (ga !== gb) return ga - gb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export type Allocation = { grantId: string; amount: number }

/** amount を期限の近い順に割り当てる。足りなければ null */
export function allocate(grants: GrantLike[], amount: number, now: Date): Allocation[] | null {
  const usable = grants.filter((g) => isUsable(g, now)).sort(consumeOrder)
  let rest = amount
  const out: Allocation[] = []
  for (const g of usable) {
    if (rest <= 0) break
    const take = Math.min(g.remaining, rest)
    out.push({ grantId: g.id, amount: take })
    rest -= take
  }
  return rest > 0 ? null : out
}

/** 毎日の回復で今回足す量（前回から日が何日進んだか × 1日の量。回復の残りと合わせて上限まで） */
export function dailyRecoveryToAdd(lastDayKey: string | null, todayKey: string, currentRecoveryRemaining: number): number {
  const days = lastDayKey === null ? 1 : jstDaysBetween(lastDayKey, todayKey)
  if (days <= 0) return 0
  const room = Math.max(0, DAILY_RECOVERY_CAP - currentRecoveryRemaining)
  return Math.min(room, days * DAILY_RECOVERY_AMOUNT)
}
