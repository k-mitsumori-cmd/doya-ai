// ドヤパワーの台帳（本番の Prisma に結びつけたもの）。サーバーの中だけで使う。
// ⚠️ 旗（DOYA_POWER_ROLLOUT、src/lib/doya-power/flag.ts）が off のときは、どの関数も DB に触れずに
//    DoyaPowerDisabledError で止まる（gate.ts）。本番DBに台帳の表が無いうちは off のまま。
// ⚠️ 画面・API に出すときは、isDoyaPowerEnabled() を見て、
//    会社はセッションの本人の会社から決める（body や query の companyId を信じない。balanceForUser(session.user.id) を使う）
// ⚠️ 本番DBに表が無いうちは呼ばない（DOYA-POWER-MIGRATION.md の SQL を統括が流したあとに使う）
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/unified-plan'
import type { LedgerDb } from './ledger'
import { doyaPowerLedgerAllowed } from './flag'
import { createGatedLedger } from './gate'
import { newPricingMonthlyGrant } from '@/lib/pricing-v2/team.server'

// 毎日の回復は無料プランだけ。会社の持ち主（userId）のプランが有料なら付けない
async function isPaidCompany(companyId: string): Promise<boolean> {
  const company = await prisma.accountCompany.findUnique({ where: { id: companyId }, select: { userId: true } })
  if (!company) return false
  const user = await prisma.user.findUnique({ where: { id: company.userId }, select: { plan: true } })
  return isPaidPlan(user?.plan)
}

// 新しい料金（旗 NEW_PRICING_ROLLOUT の対象の人）の毎月の量。対象でなければ null（今までの量）
export const doyaPower = createGatedLedger(() => prisma as unknown as LedgerDb, () => doyaPowerLedgerAllowed(), { isPaidCompany, newPricingMonthlyGrantFor: newPricingMonthlyGrant })

export const consume = doyaPower.consume
export const refund = doyaPower.refund
export const grant = doyaPower.grant
export const grantMonthlyForPlan = doyaPower.grantMonthlyForPlan
export const balance = doyaPower.balance
export const balanceForUser = doyaPower.balanceForUser
export const operationStatus = doyaPower.operationStatus
export const operationInfo = doyaPower.operationInfo
export const recentConsume = doyaPower.recentConsume
export const history = doyaPower.history

export * from './rules'
export { DoyaPowerDisabledError } from './gate'
export { isDoyaPowerEnabled, doyaPowerRollout } from './flag'
export type { BalanceResult, ConsumeResult, GrantResult, RefundResult } from './ledger'
