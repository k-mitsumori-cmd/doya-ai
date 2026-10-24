// 経営ホームのドヤパワーの欄と、内訳・履歴の画面に渡す中身（サーバーだけ。読むだけ）
// ⚠️ 旗（DOYA_POWER_ROLLOUT）・新しい見た目・本人の会社の順に確かめる（doyaPowerCharger.target()）。どれかが違えば null。
//    旗が off なら、セッションも台帳も読まない。会社はセッションの本人の会社だけ（query や body の companyId は受け取らない）
// ⚠️ 毎月の付与（有料の人）と毎日の回復は、読むときに足りない分を付ける（balanceView と同じ）
import { doyaPowerCharger } from './charge'
import { doyaPowerRollout } from './flag'
import { history } from './index'
import { historyLabel } from './history-label'
import type { GrantKind } from './rules'

export type DoyaPowerHomeView = {
  remaining: number
  limit: number
  byKind: Record<GrantKind, number>
  nextRecoveryAt: string | null
  nextExpiry: { at: string; amount: number } | null
  /** 新しい順。history を読まないとき（ホームの欄）は空 */
  history: { at: string; label: string; amount: number; balanceAfter: number; type?: string; action?: string | null }[]
}

export async function loadDoyaPowerHome(opts: { withHistory?: boolean; limit?: number } = {}): Promise<DoyaPowerHomeView | null> {
  if (doyaPowerRollout() === 'off') return null
  try {
    const who = await doyaPowerCharger.target()
    if (!who) return null
    const view = await doyaPowerCharger.balanceView()
    if (!view) return null
    const rows = opts.withHistory ? await history(who.companyId, { limit: opts.limit ?? 50 }) : []
    return {
      remaining: view.remaining,
      limit: view.limit,
      byKind: view.byKind,
      nextRecoveryAt: view.nextRecoveryAt,
      nextExpiry: view.nextExpiry,
      history: rows.map((r) => ({ at: r.at.toISOString(), label: historyLabel(r), amount: r.amount, balanceAfter: r.balanceAfter, type: r.type, action: r.action })),
    }
  } catch (e) {
    if ((e as { name?: string })?.name === 'DoyaPowerDisabledError') return null
    console.error('[doya-power/home] failed', { name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
    return null
  }
}
