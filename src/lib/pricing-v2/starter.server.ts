// ============================================
// ドヤパワーの「はじめの付与（最初の100）」を付ける（サーバーだけ）
// ============================================
// 決まりは starter.ts（テストあり）。ここは DB と台帳をつなぐだけ。
// ⚠️ ドヤパワーの旗（DOYA_POWER_ROLLOUT）と新しい料金の旗（NEW_PRICING_ROLLOUT）の両方が off でないときだけ動く。
//    どちらかが off なら、表（doya_power_starter_claims）も台帳も読まない。新しい料金は人ごとに判定する（preview なら許可した人だけ）。
// ⚠️ 受け取りの記録と台帳への付与は、台帳の1つのトランザクションの中で行う（GrantOptions.inTransaction）。
//    片方だけが残ることはない。ユーザーとメールの一意の制約で、同時の2回目も止まる。
import { prisma } from '@/lib/prisma'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { isNewPricingEnabledFor, newPricingRollout } from './rollout'
import { decideStarter, starterEmailHash, STARTER_POWER, STARTER_SOURCE_KEY, type StarterDecision } from './starter'

/** 付け終わった（または受け取り済みと分かった）人。同じサーバーの中で、毎回 DB を見に行かないため */
const settled = new Set<string>()

export function starterTablesAllowed(): boolean {
  return newPricingRollout() !== 'off'
}

/**
 * 本人が持ち主の会社に、はじめの付与を1回だけ付ける。付けたら付けた量、付けなければ 0。
 * 何度呼んでもよい（2回目からは記録を見て 0 を返す）。失敗しても例外を投げない（生成やゲージの表示を止めない）。
 */
export async function ensureStarterGrant(userId: string): Promise<{ granted: number; decision: StarterDecision }> {
  const ledgerAllowed = doyaPowerLedgerAllowed()
  const tablesAllowed = starterTablesAllowed()
  if (!ledgerAllowed || !tablesAllowed) return { granted: 0, decision: { ok: false, reason: 'flag_off' } }
  if (settled.has(userId)) return { granted: 0, decision: { ok: false, reason: 'already_claimed' } }
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } })
    // 人ごとの判定（preview なら許可した人だけ）。対象でなければ、受け取りの表を読まない
    if (!isNewPricingEnabledFor(user?.email)) return { granted: 0, decision: { ok: false, reason: 'flag_off' } }
    const company = await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
    const email = user?.email ?? null
    const google = await prisma.account.findFirst({ where: { userId, provider: 'google' }, select: { id: true } })
    const emailHash = email ? starterEmailHash(email) : null
    const claim = await prisma.doyaPowerStarterClaim.findFirst({
      where: { OR: [{ userId }, ...(emailHash ? [{ emailHash }] : [])] },
      select: { id: true },
    })
    const decision = decideStarter({
      ledgerAllowed, tablesAllowed,
      hasCompany: !!company, isOwner: !!company,
      email, verified: !!google || !!user?.emailVerified, claimed: !!claim,
    })
    if (!decision.ok && decision.reason === 'already_claimed') settled.add(userId)
    if (!decision.ok || !company || !emailHash) return { granted: 0, decision }

    // 受け取りの記録と台帳への付与を、1つのトランザクションで行う（統括の点検 C）。
    // 同じトランザクションの中で、もう受け取っていないかを確かめ直してから記録を作る。同時の2回目は、やり直したときに記録を見つけて止まる
    const { grant } = await import('@/lib/doya-power')
    const r = await grant(company.id, 'starter', STARTER_POWER, null, {
      sourceKey: STARTER_SOURCE_KEY,
      note: 'starter',
      inTransaction: async (tx) => {
        const exists = await tx.doyaPowerStarterClaim.findFirst({ where: { OR: [{ userId }, { emailHash }] }, select: { id: true } })
        if (exists) return false
        await tx.doyaPowerStarterClaim.create({ data: { emailHash, userId, companyId: company.id, amount: STARTER_POWER } })
        return true
      },
    })
    if (!r.ok) {
      // precondition ＝ もう受け取っている（記録はトランザクションごと戻るので、付かなければ記録も残らない）
      if (r.reason === 'precondition') settled.add(userId)
      return { granted: 0, decision: r.reason === 'precondition' ? { ok: false, reason: 'already_claimed' } : decision }
    }
    settled.add(userId)
    return { granted: r.duplicated ? 0 : r.granted, decision }
  } catch {
    console.error('[starter] could not grant the starter power')
    return { granted: 0, decision: { ok: false, reason: 'flag_off' } }
  }
}
