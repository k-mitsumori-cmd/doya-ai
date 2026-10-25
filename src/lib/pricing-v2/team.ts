// ============================================
// 会社のメンバーの数え方・人数の変更・チームの付与（DB と Stripe に触らない計算）
// ============================================
// 決まり:
// - 会社の持ち主（account_companies.userId）は、メンバーの行が無くても1人目として数える。
// - 招待中（invited）と参加（active）を人数に数える（招待した時点で席を取る。外した（removed）人は数えない）。
// - 買った人数（Stripe の契約の数量）より多くは招待できない。人数を減らすときは、使っている人数より下げられない。
// - 人数を増やしたら、その場で日割りを請求する。減らしたら、返金はせず、その場で減らす（設計書 §10.2）。
// - 人数を増やした月は、増えた人数の分のドヤパワーを、その月に1回だけ足す。
import { ENTERPRISE_MIN_SEATS, FREE_MAX_MEMBERS, TEAM_MONTHLY_POINTS_PER_SEAT, isEnterpriseSeatCount, isTeamSeatCount, teamMonthlyPoints } from './plans'

export type MemberStatus = 'invited' | 'active' | 'removed'
export type MemberRole = 'admin' | 'member'
export const MEMBER_STATUSES: readonly MemberStatus[] = ['invited', 'active', 'removed']
export const MEMBER_ROLES: readonly MemberRole[] = ['admin', 'member']

export interface MemberLike {
  email: string
  userId: string | null
  status: string
}

/** メールを比べる形にそろえる（前後の空白を除き、小文字）。形が明らかに違えば null */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (e.length < 3 || e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  return e
}

/** 席を取っている人数（持ち主1人 ＋ 招待中・参加のメンバー。持ち主と同じ人の行は重ねて数えない） */
export function seatsUsed(input: { ownerUserId: string; ownerEmail: string | null; members: MemberLike[] }): number {
  const ownerEmail = input.ownerEmail ? normalizeEmail(input.ownerEmail) : null
  const counted = input.members.filter((m) => {
    if (m.status !== 'invited' && m.status !== 'active') return false
    if (m.userId && m.userId === input.ownerUserId) return false
    if (ownerEmail && normalizeEmail(m.email) === ownerEmail) return false
    return true
  })
  return 1 + counted.length
}

export type InviteDecision =
  | { ok: true }
  | { ok: false; status: number; code: 'NO_SEAT' | 'INVALID_EMAIL' | 'ALREADY_MEMBER' | 'OWNER_SELF' }

/** メンバーを招待してよいか */
export function decideInvite(input: { email: unknown; ownerEmail: string | null; members: MemberLike[]; used: number; seats: number }): InviteDecision {
  const email = normalizeEmail(input.email)
  if (!email) return { ok: false, status: 400, code: 'INVALID_EMAIL' }
  if (input.ownerEmail && normalizeEmail(input.ownerEmail) === email) return { ok: false, status: 400, code: 'OWNER_SELF' }
  if (input.members.some((m) => normalizeEmail(m.email) === email && (m.status === 'invited' || m.status === 'active'))) {
    return { ok: false, status: 409, code: 'ALREADY_MEMBER' }
  }
  if (input.used >= input.seats) return { ok: false, status: 409, code: 'NO_SEAT' }
  return { ok: true }
}

export type SeatChangeDecision =
  | { ok: true; direction: 'up' | 'down'; prorationBehavior: 'always_invoice' | 'none'; addPoints: number }
  | { ok: false; status: number; code: 'INVALID_SEATS' | 'ENTERPRISE_QUOTE' | 'BELOW_USED' | 'NO_CHANGE' }

/**
 * 人数の変更の可否と、Stripe への渡し方。
 * - 増やす: 日割りをその場で請求する（always_invoice）。増えた人数の分のドヤパワーを足す
 * - 減らす: 返金しない（none）。使っている人数（持ち主＋招待中＋参加）より下げられない
 */
export function decideSeatChange(input: { current: number; requested: unknown; used: number }): SeatChangeDecision {
  const r = input.requested
  if (typeof r === 'number' && isEnterpriseSeatCount(r)) return { ok: false, status: 400, code: 'ENTERPRISE_QUOTE' }
  if (!isTeamSeatCount(r)) return { ok: false, status: 400, code: 'INVALID_SEATS' }
  if (r === input.current) return { ok: false, status: 400, code: 'NO_CHANGE' }
  if (r < input.used) return { ok: false, status: 409, code: 'BELOW_USED' }
  if (r > input.current) {
    return { ok: true, direction: 'up', prorationBehavior: 'always_invoice', addPoints: (r - input.current) * TEAM_MONTHLY_POINTS_PER_SEAT }
  }
  return { ok: true, direction: 'down', prorationBehavior: 'none', addPoints: 0 }
}

/**
 * 会社に入れる人数の上限（持ち主を含む）。
 * チーム → 買った人数 / まだ契約していない（フリー） → 3人 / 据え置き（1人の契約） → 1人（増やしたいときは相談）
 */
export function memberLimit(kind: 'none' | 'legacy' | 'team', teamSeats: number | null): number {
  if (kind === 'team') return typeof teamSeats === 'number' && teamSeats >= 1 ? teamSeats : 1
  if (kind === 'legacy') return 1
  return FREE_MAX_MEMBERS
}

/** 毎月の付与の量（チームは人数から。人数が分からない・範囲外なら null で、呼び出し側が今までの量を使う） */
export function teamMonthlyGrant(seats: number | null | undefined): number | null {
  if (typeof seats !== 'number') return null
  return teamMonthlyPoints(seats)
}

/** 契約の明細から、人数の明細（新しい料金の人数の価格）を探す */
export function findSeatItem<T extends { id: string; quantity?: number | null; price: { id: string } }>(items: T[], seatPriceIds: Set<string>): T | null {
  return items.find((i) => seatPriceIds.has(i.price.id)) ?? null
}

/** 控え（account_company_billing）を読み直すまでの時間 */
export const SEAT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function isSeatCacheFresh(checkedAt: Date | null | undefined, now: Date): boolean {
  return !!checkedAt && now.getTime() - checkedAt.getTime() < SEAT_CACHE_TTL_MS && checkedAt.getTime() <= now.getTime()
}

export { ENTERPRISE_MIN_SEATS }
