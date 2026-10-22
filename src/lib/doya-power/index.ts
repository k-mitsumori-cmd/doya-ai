// ドヤパワーの台帳（本番の Prisma に結びつけたもの）。サーバーの中だけで使う。
// ⚠️ 旗（DOYA_POWER_ROLLOUT、src/lib/doya-power/flag.ts）が off のときは、どの関数も DB に触れずに
//    DoyaPowerDisabledError で止まる（gate.ts）。本番DBに台帳の表が無いうちは off のまま。
// ⚠️ 画面・API に出すときは、isDoyaPowerEnabled() と新しい見た目（isUiNext()）の両方を見て、
//    会社はセッションの本人の会社から決める（body や query の companyId を信じない。balanceForUser(session.user.id) を使う）
// ⚠️ 本番DBに表が無いうちは呼ばない（DOYA-POWER-MIGRATION.md の SQL を統括が流したあとに使う）
import { prisma } from '@/lib/prisma'
import type { LedgerDb } from './ledger'
import { doyaPowerLedgerAllowed } from './flag'
import { createGatedLedger } from './gate'

export const doyaPower = createGatedLedger(() => prisma as unknown as LedgerDb, () => doyaPowerLedgerAllowed())

export const consume = doyaPower.consume
export const refund = doyaPower.refund
export const grant = doyaPower.grant
export const grantMonthlyForPlan = doyaPower.grantMonthlyForPlan
export const balance = doyaPower.balance
export const balanceForUser = doyaPower.balanceForUser
export const operationStatus = doyaPower.operationStatus

export * from './rules'
export { DoyaPowerDisabledError } from './gate'
export { isDoyaPowerEnabled, doyaPowerRollout } from './flag'
export type { BalanceResult, ConsumeResult, GrantResult, RefundResult } from './ledger'
