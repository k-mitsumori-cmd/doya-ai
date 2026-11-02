// ============================================
// ドヤパワーを、ユーザーを指定して減らす（つなぎ目）
// ============================================
// API の入口でセッションの本人に減らすなら、charge.ts の withDoyaPowerCharge を使う。
// この関数は、セッションが無い場所（Cloud Run のワーカーの完了通知、cron、別の機能のサーバー処理）から、
// 「このユーザーの会社に、この機能の分を減らす」ときに使う。会社は userId から決める（resolveCompanyForUser）。
//
// 使い方（処理の前に減らし、失敗したら戻す）:
//   const r = await consumeDoyaPower(userId, 'video.process.gb', gb, { key: jobId })
//   if (!r.ok) return NextResponse.json(r.body, { status: r.status })   // 402 なら不足
//   try { ...処理... } catch (e) { await r.refund(); throw e }
//
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が off のときは何も減らさず ok（charged: 0）で返す。今の動きは変わらない。
// ⚠️ key は同じ処理を二重に減らさないための ID（ジョブ ID など）。同じ key の2回目は減らさない（duplicated: true）。
// ⚠️ units は整数（GB は切り上げて渡す。1GB 未満でも 1）。端数の扱いは呼ぶ側で決め、ここでは変えない。
import { doyaPowerRollout, isDoyaPowerEnabled } from './flag'
import { doyaPowerCost, type DoyaPowerAction } from './costs'
import { isPaidPlan } from '@/lib/unified-plan'
import { createDoyaPowerCharger } from './charge-core'
import { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume } from './index'
import { resolveCompanyForUser } from '@/lib/pricing-v2/team.server'

export type ConsumeForUserResult =
  | {
      ok: true
      /** 実際に減らした量。旗が off・量が 0・会社が無いときは 0 */
      charged: number
      duplicated: boolean
      operationId: string | null
      /** 失敗したときに戻す。減らしていないときは何もしない */
      refund: () => Promise<void>
    }
  | {
      ok: false
      /** 402 = ドヤパワーが足りない / 503 = 残りを確かめられない */
      status: 402 | 503
      body: Record<string, unknown>
    }

/** 機能の名前のうち、減る量が決まっているもの（表に無い名前は減らさない） */
export function isChargeable(feature: string): feature is DoyaPowerAction {
  const c = doyaPowerCost(feature)
  return c !== null && c > 0
}

/** units を整数にする（1 未満・数でないものは 1。小数は切り上げ） */
function wholeUnits(units: number): number {
  if (!Number.isFinite(units) || units <= 0) return 1
  return Math.ceil(units)
}

export async function consumeDoyaPower(
  userId: string,
  feature: DoyaPowerAction,
  units = 1,
  opts: { key?: string } = {},
): Promise<ConsumeForUserResult> {
  const noop: ConsumeForUserResult = { ok: true, charged: 0, duplicated: false, operationId: null, refund: async () => {} }
  if (doyaPowerRollout() === 'off') return noop
  if (!userId) return noop

  // 会社はこの userId から決める（セッションの本人ではない）。旗の判定（preview の許可）も呼び出し側の責任
  const charger = createDoyaPowerCharger({
    rollout: () => doyaPowerRollout(),
    isEnabled: isDoyaPowerEnabled,
    account: async () => {
      const company = await resolveCompanyForUser(userId)
      return company ? { companyId: company.companyId, plan: company.plan } : null
    },
    ledger: { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume },
    isPaidPlan,
  })

  const outcome = await charger.charge(feature, { units: wholeUnits(units), key: opts.key })
  if (outcome.kind === 'skip') return noop
  if (outcome.kind === 'blocked') {
    const status = outcome.response.status === 402 ? 402 : 503
    const body = (await outcome.response.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: false, status, body }
  }
  return {
    ok: true,
    charged: outcome.duplicated ? 0 : outcome.amount,
    duplicated: outcome.duplicated,
    operationId: outcome.operationId,
    refund: outcome.refund,
  }
}
