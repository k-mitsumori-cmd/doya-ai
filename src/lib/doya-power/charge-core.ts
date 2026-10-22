// ============================================
// 生成の API で、ドヤパワーを減らす・戻す（中身。部品は外から渡す）
// ============================================
// 本番の部品をつないだものは charge.ts。ここは DB・セッション・環境変数に直接触れない（テストで差し替えるため）。
// 決まり:
// - 旗（DOYA_POWER_ROLLOUT）が off のときは、セッションも台帳も読まずに「減らさない」で通す（API は今どおり動く）
// - preview で許可されていない人・新しい見た目でない人・会社が未登録の人も「減らさない」で通す
// - 減らす量は costs.ts の表から決める。0 の操作は減らさない
// - 操作の ID（operationId）は「操作の名前:会社:キー」。同じ ID では1回だけ減らす（台帳の unique 制約）
// - 生成の前に減らし、失敗（例外・4xx/5xx の応答）なら戻す（台帳の refund は1回だけ）
// - 足りなければ 402 と日本語の案内を返し、有料の API を呼ばない
// - 台帳が読めないときは 503 で止める（減らせないまま有料の API を呼ばない）
import { NextResponse } from 'next/server'
import { doyaPowerCost, type DoyaPowerAction } from './costs'
import { DAILY_RECOVERY_AMOUNT, jstNextDayStart, SOLO_PRO_MONTHLY_GRANT, DAILY_RECOVERY_CAP } from './rules'
import type { BalanceResult, ConsumeResult, GrantResult, RefundResult } from './ledger'

export type ChargeLedger = {
  consume: (companyId: string, amount: number, operationId: string) => Promise<ConsumeResult>
  refund: (operationId: string, opts?: { companyId?: string }) => Promise<RefundResult>
  grantMonthlyForPlan: (companyId: string, plan: string | null | undefined) => Promise<GrantResult | { ok: true; granted: 0; skipped: 'free_plan' }>
  balance: (companyId: string) => Promise<BalanceResult | null>
}

export type ChargeDeps = {
  /** 旗の値（off / preview / all）。off ならほかの部品を一度も呼ばない */
  rollout: () => string
  /** 今の人にドヤパワーを出すか（preview の許可を含む） */
  isEnabled: () => Promise<boolean>
  /** 新しい見た目か */
  isUiNext: () => Promise<boolean>
  /** セッションの本人の会社とプラン。会社が未登録なら null */
  account: () => Promise<{ companyId: string; plan: string | null } | null>
  ledger: ChargeLedger
  isPaidPlan: (plan?: string | null) => boolean
  now?: () => Date
  newKey?: () => string
  log?: (msg: string, info: Record<string, unknown>) => void
}

export type ChargeOutcome =
  | { kind: 'skip' }
  | { kind: 'charged'; operationId: string; amount: number; duplicated: boolean; refund: () => Promise<void> }
  | { kind: 'blocked'; response: NextResponse }

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** キーに使える文字だけにする（台帳の id は 200 文字まで） */
function cleanKey(k: unknown): string | null {
  if (typeof k !== 'string') return null
  const v = k.trim()
  return /^[A-Za-z0-9_.:-]{1,120}$/.test(v) ? v : null
}

/** 日本時間の時刻を「10月24日 0:00」の形で */
function jstLabel(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600_000)
  return `${j.getUTCMonth() + 1}月${j.getUTCDate()}日 ${j.getUTCHours()}:${String(j.getUTCMinutes()).padStart(2, '0')}`
}

/** 枠のゲージの「上限」。有料の人は毎月の付与の量、無料の人は回復で貯まる上限（残りがそれより多ければ残り） */
export function gaugeLimit(total: number, plan: string | null, isPaidPlan: (p?: string | null) => boolean): number {
  return Math.max(total, isPaidPlan(plan) ? SOLO_PRO_MONTHLY_GRANT : DAILY_RECOVERY_CAP)
}

export function createDoyaPowerCharger(deps: ChargeDeps) {
  const now = deps.now ?? (() => new Date())
  const newKey = deps.newKey ?? (() => globalThis.crypto.randomUUID())
  const log = deps.log ?? ((msg, info) => console.error(msg, info))

  /** 減らす相手（会社とプラン）。減らさない人なら null。off なら何も読まない */
  async function target(): Promise<{ companyId: string; plan: string | null } | null> {
    if (deps.rollout() === 'off') return null
    if (!(await deps.isEnabled())) return null
    if (!(await deps.isUiNext())) return null
    return deps.account()
  }

  /**
   * 生成の前に呼ぶ。units は件数（画像の枚数・質問の数など）、key は同じ操作をまとめるための ID（クライアントの operationId など）。
   * key が無いときは、その場で作る（その呼び出しだけの操作になる）
   */
  async function charge(action: DoyaPowerAction, opts: { units?: number; key?: unknown } = {}): Promise<ChargeOutcome> {
    const who = await target()
    if (!who) return { kind: 'skip' }
    const amount = doyaPowerCost(action, opts.units ?? 1)
    if (amount === null || amount <= 0) return { kind: 'skip' }
    const operationId = `${action}:${who.companyId}:${cleanKey(opts.key) ?? newKey()}`
    try {
      // 有料の人の毎月の付与は、残りを使うときに足りない分を付ける（月に1回だけ。cron に頼らない）。毎日の回復は台帳が足す
      await deps.ledger.grantMonthlyForPlan(who.companyId, who.plan)
      const r = await deps.ledger.consume(who.companyId, amount, operationId)
      if (r.ok) {
        const refund = async () => {
          try {
            await deps.ledger.refund(operationId, { companyId: who.companyId })
          } catch (e) {
            log('[doya-power] refund failed', { action, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
          }
        }
        return { kind: 'charged', operationId, amount: r.amount, duplicated: r.duplicated, refund }
      }
      if (r.reason === 'insufficient') {
        const next = jstNextDayStart(now())
        return {
          kind: 'blocked',
          response: NextResponse.json(
            {
              error: `ドヤパワーが足りません（今の残り ${r.balance}、この操作には ${amount} 使います）。${jstLabel(next)}（日本時間）に ${DAILY_RECOVERY_AMOUNT} 回復します。`,
              code: 'DOYA_POWER_INSUFFICIENT',
              balance: r.balance,
              required: amount,
              nextRecoveryAt: next.toISOString(),
            },
            { status: 402, headers: NO_STORE },
          ),
        }
      }
      // 会社が無い・ID の食い違いなどは、減らさずに通す（会社の決め方は account() の責任）
      log('[doya-power] consume skipped', { action, reason: r.reason })
      return { kind: 'skip' }
    } catch (e) {
      if ((e as { name?: string })?.name === 'DoyaPowerDisabledError') return { kind: 'skip' }
      log('[doya-power] consume failed', { action, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
      return {
        kind: 'blocked',
        response: NextResponse.json(
          { error: 'ドヤパワーの残りを確かめられませんでした。時間をおいて、もう一度お試しください。', code: 'DOYA_POWER_UNAVAILABLE' },
          { status: 503, headers: NO_STORE },
        ),
      }
    }
  }

  /**
   * 生成の処理を包む。前に減らし、例外や 4xx/5xx の応答なら戻す。
   * ⚠️ 流しながら返す応答（SSE）は、流し始めたあとの失敗では戻せない（応答の status が 200 のため）
   */
  async function run(outcome: ChargeOutcome, fn: () => Promise<Response>): Promise<Response> {
    if (outcome.kind === 'blocked') return outcome.response
    if (outcome.kind === 'skip') return fn()
    let res: Response
    try {
      res = await fn()
    } catch (e) {
      await outcome.refund()
      throw e
    }
    if (res.status >= 400) await outcome.refund()
    return res
  }

  /** 枠のゲージに出す残り。出さない人・読めないときは null */
  async function shellState(): Promise<{ balance: { remaining: number; limit: number }; costs: Record<string, number> } | null> {
    const who = await target()
    if (!who) return null
    try {
      await deps.ledger.grantMonthlyForPlan(who.companyId, who.plan)
      const b = await deps.ledger.balance(who.companyId)
      if (!b) return null
      return { balance: { remaining: b.total, limit: gaugeLimit(b.total, who.plan, deps.isPaidPlan) }, costs: {} }
    } catch (e) {
      log('[doya-power] balance failed', { name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
      return null
    }
  }

  /** 残りの API に返す中身。出さない人は null */
  async function balanceView() {
    const who = await target()
    if (!who) return null
    await deps.ledger.grantMonthlyForPlan(who.companyId, who.plan)
    const b = await deps.ledger.balance(who.companyId)
    if (!b) return null
    return {
      remaining: b.total,
      limit: gaugeLimit(b.total, who.plan, deps.isPaidPlan),
      byKind: b.byKind,
      nextRecoveryAt: b.nextRecoveryAt ? b.nextRecoveryAt.toISOString() : null,
      nextExpiry: b.nextExpiry ? { at: b.nextExpiry.at.toISOString(), amount: b.nextExpiry.amount } : null,
    }
  }

  return { charge, run, shellState, balanceView, target }
}

export type DoyaPowerCharger = ReturnType<typeof createDoyaPowerCharger>
