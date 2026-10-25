// ============================================
// ドヤパワーの「はじめの付与（最初の100）」を付ける（サーバーだけ）
// ============================================
// 決まりは starter.ts（テストあり）。ここは DB と台帳をつなぐだけ。
// ⚠️ ドヤパワーの旗（DOYA_POWER_ROLLOUT）と新しい料金の旗（NEW_PRICING_ROLLOUT）の両方が off でないときだけ動く。
//    どちらかが off なら、表（doya_power_starter_claims）も台帳も読まない。
// ⚠️ 先に受け取りの記録を作り（ユーザーとメールの一意の制約で、同時の2回目は失敗する）、そのあと台帳に付ける。
//    台帳への付与に失敗したら、記録を消して、次の機会にやり直せるようにする。
import { prisma } from '@/lib/prisma'
import { doyaPowerLedgerAllowed } from '@/lib/doya-power/flag'
import { newPricingRollout } from './rollout'
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

    // 受け取りの記録を先に作る（一意の制約。同時の2回目・作り直しの2回目はここで止まる）
    let claimId: string
    try {
      claimId = (await prisma.doyaPowerStarterClaim.create({ data: { emailHash, userId, companyId: company.id, amount: STARTER_POWER }, select: { id: true } })).id
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        settled.add(userId)
        return { granted: 0, decision: { ok: false, reason: 'already_claimed' } }
      }
      throw e
    }
    const { grant } = await import('@/lib/doya-power')
    const r = await grant(company.id, 'daily_recovery', STARTER_POWER, null, { sourceKey: STARTER_SOURCE_KEY, note: 'starter' })
    if (!r.ok) {
      // 回復の上限に届いていた（recovery_cap）などで付かなかったときも、記録は残す（もう100ある＝はじめの状態）。
      // それ以外の失敗は、記録を消してやり直せるようにする
      if (r.reason !== 'recovery_cap') await prisma.doyaPowerStarterClaim.delete({ where: { id: claimId } }).catch(() => {})
      else settled.add(userId)
      return { granted: 0, decision }
    }
    settled.add(userId)
    return { granted: r.granted, decision }
  } catch {
    console.error('[starter] could not grant the starter power')
    return { granted: 0, decision: { ok: false, reason: 'flag_off' } }
  }
}
