// ============================================
// 音声（AI商談・AI面接）のドヤパワー（中身。部品は外から渡す）
// ============================================
// 本番の部品をつないだものは voice.ts。ここは DB・セッション・環境変数に直接触れない（テストで差し替えるため）。
// 決まり（2026-10-23 統括の依頼。量は costs.ts の voice.minute。1分 3、VOICE_COST_MODE で 5）:
// - 始める前に「最大の分数」ぶんを仮に減らす（AI面接は URL の発行のとき、AI商談は商談が始まるとき）
//   ⚠️ AI商談の URL（ルーム）は何回も使えるので、URL ではなく商談ごとに減らす
// - 終わったら（終わりの API・担当者の終了・放置の自動完了）、仮に減らした分を戻し、実際の分数ぶんを減らし直す
//   （実際の分数は、仮に減らした分を超えない）
// - 減らす相手は、組織の持ち主の会社（今の上限の数え方と同じ。ルームと面接の行に、発行した人は残っていない）
// - 旗（DOYA_POWER_ROLLOUT）が off なら、何も読まずに「減らさない」。preview なら、持ち主のメールが許可されているときだけ
// - 相手側（応募者・お客さま）の API は、発行した会社の台帳だけを見る。仮に減らした分を超えては続けない
import { NextResponse } from 'next/server'
import { doyaPowerCost } from './costs'
import type { ConsumeResult, GrantResult, RefundResult } from './ledger'

/** 自動で終わるまでの余り（クライアントは「分数 + 3分」で終える。useRealtimeMeeting / useRealtimeInterview） */
export const VOICE_CHARGE_GRACE_MINUTES = 3

export type VoiceService = 'aishodan' | 'mensetsu'

export type VoiceLedger = {
  consume: (companyId: string, amount: number, operationId: string) => Promise<ConsumeResult>
  refund: (operationId: string, opts?: { companyId?: string }) => Promise<RefundResult>
  grantMonthlyForPlan: (companyId: string, plan: string | null | undefined) => Promise<GrantResult | { ok: true; granted: 0; skipped: 'free_plan' }>
  operationStatus: (operationId: string) => Promise<'none' | 'consumed' | 'refunded'>
}

export type VoiceDeps = {
  rollout: () => string
  /** 組織の持ち主（今の上限の数え方と同じ人）のメール・プラン・会社。見つからなければ null */
  owner: (service: VoiceService, organizationId: string) => Promise<{ email: string | null; plan: string | null; companyId: string | null } | null>
  /** preview のときに、このメールの人を許可するか */
  allowed: (email: string | null) => boolean
  ledger: VoiceLedger
  log?: (msg: string, info: Record<string, unknown>) => void
}

export type VoiceCharge =
  | { kind: 'skip' }
  | { kind: 'charged'; operationId: string; amount: number; refund: () => Promise<void> }
  | { kind: 'blocked'; response: NextResponse }

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** 仮に減らす分数（設定の分数 + 自動で終わるまでの余り） */
export function voiceChargeMinutes(durationMin: number): number {
  const d = Number.isFinite(durationMin) && durationMin > 0 ? Math.ceil(durationMin) : 10
  return d + VOICE_CHARGE_GRACE_MINUTES
}

/** 実際の分数（始めた時刻から終わった時刻まで。始めていなければ 0。切り上げ） */
export function voiceActualMinutes(startedAt: Date | null | undefined, endedAt: Date | null | undefined): number {
  if (!startedAt || !endedAt) return 0
  const ms = endedAt.getTime() - startedAt.getTime()
  return ms > 0 ? Math.ceil(ms / 60000) : 0
}

export function createVoiceCharger(deps: VoiceDeps) {
  const log = deps.log ?? ((msg, info) => console.error(msg, info))
  const opId = (companyId: string, key: string) => `voice.minute:${companyId}:${key}`

  /** 減らす相手の会社。減らさない人なら null。off なら何も読まない */
  async function target(service: VoiceService, organizationId: string): Promise<{ companyId: string; plan: string | null } | null> {
    const rollout = deps.rollout()
    if (rollout === 'off') return null
    const o = await deps.owner(service, organizationId)
    if (!o?.companyId) return null
    if (rollout !== 'all' && !deps.allowed(o.email)) return null
    return { companyId: o.companyId, plan: o.plan }
  }

  /** 始める前に、最大の分数ぶんを仮に減らす。key は面接・商談ごとの ID */
  async function hold(service: VoiceService, organizationId: string, key: string, minutes: number, message: { insufficient: string }): Promise<VoiceCharge> {
    const who = await target(service, organizationId)
    if (!who) return { kind: 'skip' }
    const amount = doyaPowerCost('voice.minute', Math.max(1, Math.ceil(minutes)))
    if (amount === null || amount <= 0) return { kind: 'skip' }
    const operationId = opId(who.companyId, key)
    try {
      await deps.ledger.grantMonthlyForPlan(who.companyId, who.plan)
      const r = await deps.ledger.consume(who.companyId, amount, operationId)
      if (r.ok) {
        // 同じ ID の2回目は、この呼び出しでは減らしていないので戻さない
        const refund = r.duplicated ? async () => {} : async () => {
          try { await deps.ledger.refund(operationId, { companyId: who.companyId }) } catch (e) {
            log('[doya-power/voice] refund failed', { service, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
          }
        }
        return { kind: 'charged', operationId, amount: r.amount, refund }
      }
      if (r.reason === 'insufficient') {
        return { kind: 'blocked', response: NextResponse.json({ error: message.insufficient, code: 'DOYA_POWER_INSUFFICIENT', balance: r.balance, required: amount }, { status: 402, headers: NO_STORE }) }
      }
      log('[doya-power/voice] hold skipped', { service, reason: r.reason })
      return { kind: 'skip' }
    } catch (e) {
      if ((e as { name?: string })?.name === 'DoyaPowerDisabledError') return { kind: 'skip' }
      log('[doya-power/voice] hold failed', { service, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
      return { kind: 'blocked', response: NextResponse.json({ error: '利用できる量を確かめられませんでした。時間をおいて、もう一度お試しください。', code: 'DOYA_POWER_UNAVAILABLE' }, { status: 503, headers: NO_STORE }) }
    }
  }

  /**
   * 相手側（応募者・お客さま）が通話の鍵をもらうときに見る。発行した会社の台帳だけを見る。
   * - 減らさない人（旗 off・許可なし・会社なし）・旗を入れる前の面接（台帳に記録なし）: 今までどおり（null）
   * - 仮に減らした分が残っている: 続けてよい分数（仮に減らした分数）を返す
   * - 戻したあと（終わった・中止した）: 続けない（'closed'）
   */
  async function allowance(service: VoiceService, organizationId: string, key: string, minutes: number): Promise<null | { minutes: number } | 'closed'> {
    const who = await target(service, organizationId)
    if (!who) return null
    const status = await deps.ledger.operationStatus(opId(who.companyId, key)).catch(() => 'none' as const)
    if (status === 'none') return null
    if (status === 'refunded') return 'closed'
    return { minutes: voiceChargeMinutes(minutes) }
  }

  /**
   * 終わったら、仮に減らした分を戻し、実際の分数ぶんを減らし直す（仮に減らした分を超えない）。何度呼んでも1回だけ
   * - actualMinutes が 0（始めなかった）なら、戻すだけ
   */
  async function settle(service: VoiceService, organizationId: string, key: string, actualMinutes: number): Promise<void> {
    const who = await target(service, organizationId)
    if (!who) return
    const operationId = opId(who.companyId, key)
    try {
      if ((await deps.ledger.operationStatus(operationId)) !== 'consumed') return
      const r = await deps.ledger.refund(operationId, { companyId: who.companyId })
      if (!r.ok || r.duplicated) return
      const used = doyaPowerCost('voice.minute', Math.max(0, Math.ceil(actualMinutes)))
      const amount = Math.min(r.amount, used ?? 0)
      if (actualMinutes > 0 && amount > 0) {
        const c = await deps.ledger.consume(who.companyId, amount, `${operationId}:settled`)
        if (!c.ok) log('[doya-power/voice] settle consume failed', { service, reason: c.reason })
      }
    } catch (e) {
      log('[doya-power/voice] settle failed', { service, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
    }
  }

  return { hold, allowance, settle, target }
}

export type VoiceCharger = ReturnType<typeof createVoiceCharger>
