// ドヤパワーの台帳（本番の Prisma に結びつけたもの）。サーバーの中だけで使う。
// ⚠️ 画面・API に出すときは、新しい見た目の人（isUiNext()）だけにし、会社はセッションの本人の会社から決める
//    （body や query の companyId を信じない。balanceForUser(session.user.id) を使う）
// ⚠️ 本番DBに表が無いうちは呼ばない（DOYA-POWER-MIGRATION.md の SQL を統括が流したあとに使う）
import { prisma } from '@/lib/prisma'
import { createDoyaPowerLedger, type LedgerDb } from './ledger'

export const doyaPower = createDoyaPowerLedger(prisma as unknown as LedgerDb)

export const consume = doyaPower.consume
export const refund = doyaPower.refund
export const grant = doyaPower.grant
export const grantMonthlyForPlan = doyaPower.grantMonthlyForPlan
export const balance = doyaPower.balance
export const balanceForUser = doyaPower.balanceForUser

export * from './rules'
export type { BalanceResult, ConsumeResult, GrantResult, RefundResult } from './ledger'
