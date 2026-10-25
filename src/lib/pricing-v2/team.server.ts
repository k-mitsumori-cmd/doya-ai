// ============================================
// 新しい料金（チーム）の会社・メンバー・買った人数（サーバーだけ）
// ============================================
// ⚠️ 旗 NEW_PRICING_ROLLOUT が off、または新しい料金の価格が未設定なら、新しい表（account_company_members /
//    account_company_billing）を一切読まない・書かない（本番DBに表が無いうちに落ちないように）。
// ⚠️ 買った人数の正は Stripe の契約の数量。account_company_billing は控え（1日で読み直す）。User.plan は書かない。
// ⚠️ 会社を操作できるのは持ち主（account_companies.userId）だけ。body の companyId は信じない。
// 計算の決まりは team.ts（テストあり）。
import { prisma } from '@/lib/prisma'
import { stripe, findActiveLikeSubscriptions } from '@/lib/stripe'
import { newPricingRollout } from './rollout'
import { newPricingPriceIds, teamPriceConfig, TEAM_PLAN_ID } from './prices'
import { findSeatItem, isSeatCacheFresh, seatsUsed, type MemberLike } from './team'

/** 新しい表を使ってよいか（旗が on で、新しい料金の価格がそろっている） */
export function teamTablesAllowed(): boolean {
  return newPricingRollout() !== 'off' && teamPriceConfig().ok
}

export interface TeamSubscription {
  companyId: string
  subscriptionId: string
  seatItemId: string
  seats: number
  interval: 'month' | 'year'
}

/** Stripe から、持ち主のチームの契約と人数を読む（無ければ null）。読めなければ例外（「契約なし」と取り違えない） */
async function readTeamSubscriptionFromStripe(owner: { id: string; email: string | null; stripeCustomerId: string | null }, companyId: string): Promise<TeamSubscription | null> {
  const live = await findActiveLikeSubscriptions({ userId: owner.id, email: owner.email, stripeCustomerId: owner.stripeCustomerId })
  const team = live.find((s) => s.planId === TEAM_PLAN_ID)
  if (!team) return null
  const sub = await stripe.subscriptions.retrieve(team.id)
  const c = teamPriceConfig()
  if (!c.ok) return null
  const seatItem = findSeatItem(sub.items.data as any[], new Set([c.seat.monthly, c.seat.yearly]))
  if (!seatItem || !seatItem.quantity) return null
  const interval = seatItem.price.id === c.seat.yearly ? 'year' : 'month'
  return { companyId, subscriptionId: sub.id, seatItemId: seatItem.id, seats: seatItem.quantity, interval }
}

/** 控えを書き直す（無ければ作る）。チームの契約が無くなっていれば消す */
async function writeSeatCache(companyId: string, t: TeamSubscription | null, now = new Date()) {
  if (!t) {
    await prisma.accountCompanyBilling.deleteMany({ where: { companyId } })
    return
  }
  await prisma.accountCompanyBilling.upsert({
    where: { companyId },
    create: { companyId, stripeSubscriptionId: t.subscriptionId, seats: t.seats, billingInterval: t.interval, checkedAt: now },
    update: { stripeSubscriptionId: t.subscriptionId, seats: t.seats, billingInterval: t.interval, checkedAt: now },
  })
}

/**
 * 会社の買った人数（チームの契約が無ければ null）。控えが新しければ控えを、古ければ Stripe を読み直す。
 * 旗が off・価格が未設定なら、表を読まずに null。
 */
export async function teamSeatsForCompany(companyId: string, opts: { refresh?: boolean } = {}): Promise<number | null> {
  if (!teamTablesAllowed()) return null
  const now = new Date()
  const cached = await prisma.accountCompanyBilling.findUnique({ where: { companyId } })
  if (cached && !opts.refresh && isSeatCacheFresh(cached.checkedAt, now)) return cached.seats
  const company = await prisma.accountCompany.findUnique({ where: { id: companyId }, select: { userId: true } })
  if (!company) return null
  const owner = await prisma.user.findUnique({ where: { id: company.userId }, select: { id: true, email: true, stripeCustomerId: true, stripePriceId: true } })
  if (!owner) return null
  // DB の上でチームでない人（据え置き・無料）は、Stripe を読みに行かない
  if (!owner.stripePriceId || !newPricingPriceIds().has(owner.stripePriceId)) {
    if (cached) await writeSeatCache(companyId, null, now)
    return null
  }
  const t = await readTeamSubscriptionFromStripe(owner, companyId)
  await writeSeatCache(companyId, t, now)
  return t?.seats ?? null
}

/** 会社の席を取っている人数（持ち主＋招待中＋参加） */
export async function teamSeatsUsed(companyId: string): Promise<number> {
  const company = await prisma.accountCompany.findUnique({ where: { id: companyId }, select: { userId: true, user: { select: { email: true } } } })
  if (!company) return 0
  if (!teamTablesAllowed()) return 1
  const members: MemberLike[] = await prisma.accountCompanyMember.findMany({
    where: { companyId, status: { in: ['invited', 'active'] } },
    select: { email: true, userId: true, status: true },
  })
  return seatsUsed({ ownerUserId: company.userId, ownerEmail: company.user?.email ?? null, members })
}

/**
 * ドヤパワーを使う会社。本人が持ち主の会社を先に見て、無ければ参加している会社（旗が on のときだけ）。
 * plan は会社の持ち主の User.plan（チームの料金を払っているのは持ち主）。
 */
export async function resolveCompanyForUser(userId: string): Promise<{ companyId: string; plan: string | null; role: 'owner' | 'member' } | null> {
  const own = await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true, user: { select: { plan: true } } } })
  if (own) return { companyId: own.id, plan: own.user?.plan ?? null, role: 'owner' }
  if (!teamTablesAllowed()) return null
  const m = await prisma.accountCompanyMember.findFirst({
    where: { userId, status: 'active' },
    orderBy: { joinedAt: 'asc' },
    select: { companyId: true, company: { select: { user: { select: { plan: true } } } } },
  })
  return m ? { companyId: m.companyId, plan: m.company.user?.plan ?? null, role: 'member' } : null
}

/** 持ち主の会社と、チームの契約（人数の変更・メンバーの招待の入口）。持ち主でなければ null */
export async function ownerTeamContext(userId: string): Promise<{
  companyId: string
  owner: { id: string; email: string | null; stripeCustomerId: string | null; plan: string | null; stripePriceId: string | null }
} | null> {
  const company = await prisma.accountCompany.findUnique({
    where: { userId },
    select: { id: true, user: { select: { id: true, email: true, stripeCustomerId: true, plan: true, stripePriceId: true } } },
  })
  if (!company?.user) return null
  return { companyId: company.id, owner: company.user }
}

/** 人数の変更のため、Stripe の契約を読み直す（控えではなく正を見る） */
export async function readOwnerTeamSubscription(ctx: NonNullable<Awaited<ReturnType<typeof ownerTeamContext>>>): Promise<TeamSubscription | null> {
  return readTeamSubscriptionFromStripe(ctx.owner, ctx.companyId)
}

/** Stripe の人数を変えたあと、控えを書き直す */
export async function saveSeatCache(companyId: string, t: TeamSubscription | null) {
  await writeSeatCache(companyId, t)
}
