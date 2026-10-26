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
import { RETRY_HALF_WINDOW_MS, DOYA_POWER_OP_HEADER, halfAmount, cleanRetryKey } from './retry'
export { RETRY_HALF_WINDOW_MS, DOYA_POWER_OP_HEADER, halfAmount } from './retry'

export type ChargeLedger = {
  consume: (companyId: string, amount: number, operationId: string, opts?: { note?: string }) => Promise<ConsumeResult>
  refund: (operationId: string, opts?: { companyId?: string }) => Promise<RefundResult>
  grantMonthlyForPlan: (companyId: string, plan: string | null | undefined) => Promise<GrantResult | { ok: true; granted: 0; skipped: 'free_plan' }>
  balance: (companyId: string) => Promise<BalanceResult | null>
  operationStatus: (operationId: string) => Promise<'none' | 'consumed' | 'refunded'>
  /** 5分以内の作り直しの相手（同じ会社・同じ操作の名前・同じルート・同じ対象で、全額で減らして戻していない消費）を探す */
  recentConsume: (companyId: string, action: string, opts: { withinMs: number; retryOf?: string | null; target?: string | null; scope?: string | null }) => Promise<{ operationId: string; at: Date } | null>
}

/**
 * 有料の AI を呼んだあとに失敗した応答に、ハンドラが付ける印（値は '1'）。
 * 付いた失敗の応答は戻さない（4xx/5xx でも、使った分は使ったものとして数える）。印は利用者に返す前に外す
 */
export const DOYA_POWER_CONSUMED_HEADER = 'x-doya-power-consumed'

export type ChargeDeps = {
  /** 旗の値（off / preview / all）。off ならほかの部品を一度も呼ばない */
  rollout: () => string
  /** 今の人にドヤパワーを出すか（preview の許可を含む） */
  isEnabled: () => Promise<boolean>
  /**
   * セッションの本人の会社とプラン。会社が未登録なら null。
   * monthlyGrant は、新しい料金（旗 NEW_PRICING_ROLLOUT の対象）の毎月の量。対象でなければ無い（ゲージの上限は今までどおり）
   */
  account: () => Promise<{ companyId: string; plan: string | null; monthlyGrant?: number | null } | null>
  ledger: ChargeLedger
  isPaidPlan: (plan?: string | null) => boolean
  now?: () => Date
  newKey?: () => string
  log?: (msg: string, info: Record<string, unknown>) => void
}

export type ChargeOutcome =
  | { kind: 'skip' }
  | {
      kind: 'charged'
      operationId: string
      /** 操作のキー（operationId の3つ目の欄）。成功の応答のヘッダー（DOYA_POWER_OP_HEADER）で返し、作り直しの retryOf に使ってもらう */
      opKey: string
      amount: number
      duplicated: boolean
      halved: boolean
      refund: () => Promise<void>
    }
  | { kind: 'blocked'; response: NextResponse }

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/** キーに使える文字だけにする（台帳の id は 200 文字まで） */
const cleanKey = cleanRetryKey

/** 日本時間の時刻を「10月24日 0:00」の形で */
function jstLabel(d: Date): string {
  const j = new Date(d.getTime() + 9 * 3600_000)
  return `${j.getUTCMonth() + 1}月${j.getUTCDate()}日 ${j.getUTCHours()}:${String(j.getUTCMinutes()).padStart(2, '0')}`
}

/**
 * 枠のゲージの「上限」。有料の人は毎月の付与の量、無料の人は回復で貯まる上限（残りがそれより多ければ残り）。
 * monthlyGrant（新しい料金の対象の人の毎月の量）を渡したときは、有料の人の基準をそれにする
 */
export function gaugeLimit(total: number, plan: string | null, isPaidPlan: (p?: string | null) => boolean, monthlyGrant?: number | null): number {
  const paidBase = typeof monthlyGrant === 'number' && monthlyGrant > 0 ? monthlyGrant : SOLO_PRO_MONTHLY_GRANT
  return Math.max(total, isPaidPlan(plan) ? paidBase : DAILY_RECOVERY_CAP)
}

export function createDoyaPowerCharger(deps: ChargeDeps) {
  const now = deps.now ?? (() => new Date())
  const newKey = deps.newKey ?? (() => globalThis.crypto.randomUUID())
  const log = deps.log ?? ((msg, info) => console.error(msg, info))

  /** 減らす相手（会社とプラン）。減らさない人なら null。off なら何も読まない */
  async function target(): Promise<{ companyId: string; plan: string | null; monthlyGrant?: number | null } | null> {
    if (deps.rollout() === 'off') return null
    if (!(await deps.isEnabled())) return null
    return deps.account()
  }

  /**
   * 生成の前に呼ぶ。units は件数（画像の枚数・質問の数など）、key は同じ操作をまとめるための ID（クライアントの operationId など）。
   * key が無いときは、その場で作る（その呼び出しだけの操作になる）
   * 半分になるのは「同じ対象の作り直し」だけ。次を全部満たす前の操作が見つかったときに限る（見つからなければ全額）。
   * - retryOf（前の操作のキー。クライアントが送る合図）と target（同じ対象のキー。サーバーがルートのパラメータや本文の ID から決める）の両方がある
   * - 同じ会社・同じ操作の名前・同じルート（scope）で、5分以内に減らした
   * - 前の操作は全額で減らしたもの（半分で減らした操作は土台にしない。連鎖させない）で、まだ戻していない
   */
  async function charge(action: DoyaPowerAction, opts: { units?: number; key?: unknown; retryOf?: unknown; target?: unknown; scope?: unknown; watch?: boolean } = {}): Promise<ChargeOutcome> {
    const who = await target()
    if (!who) return { kind: 'skip' }
    const fullAmount = doyaPowerCost(action, opts.units ?? 1)
    if (fullAmount === null || fullAmount <= 0) return { kind: 'skip' }
    const key = cleanKey(opts.key)
    const retryOf = cleanKey(opts.retryOf)
    const targetKey = cleanKey(opts.target)
    let amount = fullAmount
    let halved = false
    const scope = cleanKey(opts.scope)
    // ⚠️ target が決められないルート・retryOf が無い呼び出しは、半分にしない（クライアントの値だけで半分にさせない）
    if (retryOf && retryOf !== key && targetKey) {
      try {
        const prev = await deps.ledger.recentConsume(who.companyId, action, { withinMs: RETRY_HALF_WINDOW_MS, retryOf, target: targetKey, scope })
        if (prev) {
          amount = halfAmount(fullAmount)
          halved = true
        }
      } catch (e) {
        if ((e as { name?: string })?.name === 'DoyaPowerDisabledError') return { kind: 'skip' }
        // 探せないときは全額（安い側に倒さない）
        log('[doya-power] recent lookup failed', { action, name: (e as { name?: string })?.name })
      }
    }
    // 操作の ID に量も含める（同じキーで量だけ変えた呼び出しを、同じ操作として扱わない）
    // ⚠️ scope は呼ばれたルートの名前空間（charge.ts がルートの道すじから作る）。クライアントのキーは、同じ操作の名前でも
    //    別のルートでは別の ID になる（安いルートで払ったキーを、高いルートに送ってタダにできない）。
    //    キーの後ろ・量の前に置く（作り直しの探し方「操作の名前:会社:キー:」を変えないため）
    const opKey = key ?? newKey()
    let operationId = `${action}:${who.companyId}:${opKey}${scope ? `:${scope}` : ''}:${amount}`
    try {
      // 有料の人の毎月の付与は、残りを使うときに足りない分を付ける（月に1回だけ。cron に頼らない）。毎日の回復は台帳が足す
      await deps.ledger.grantMonthlyForPlan(who.companyId, who.plan)
      // ⚠️ 前に失敗して戻した操作の ID がもう一度来たら、新しい操作として減らし直す（戻した操作をタダで動かさない）
      if (key && (await deps.ledger.operationStatus(operationId)) === 'refunded') operationId = `${operationId}:retry-${newKey()}`
      // 自動点検（system-watch の B1）の消費には watch:1 を足す。内訳と履歴で「自動点検」と分けて出すため（作り直しの判定は先頭の target: と halved:1 だけを見る）
      const noteParts = [targetKey ? `target:${targetKey}${halved ? ' halved:1' : ''}` : '', opts.watch === true ? 'watch:1' : ''].filter(Boolean)
      const r = await deps.ledger.consume(who.companyId, amount, operationId, noteParts.length ? { note: noteParts.join(' ') } : undefined)
      if (r.ok) {
        // ⚠️ 同じ ID の2回目（duplicated）は、この呼び出しでは減らしていないので、失敗しても戻さない。
        //    戻すと、前の呼び出しで成功した分まで戻ってしまう（同じ ID を使い回して、タダで作り直せてしまう）。
        // ⚠️ 2回目を減らさずに通すのは、処理の側が同じキーで結果を返し直す（または食い違いを断る）API だけに限る。
        //    クライアントのキーを渡してよい API は、verify-doya-power-charge-routes.cjs の KEYED で固定している
        if (r.duplicated) return { kind: 'charged', operationId, opKey, amount: r.amount, duplicated: true, halved, refund: async () => {} }
        const refund = async () => {
          try {
            await deps.ledger.refund(operationId, { companyId: who.companyId })
          } catch (e) {
            log('[doya-power] refund failed', { action, name: (e as { name?: string })?.name, code: (e as { code?: string })?.code })
          }
        }
        return { kind: 'charged', operationId, opKey, amount: r.amount, duplicated: r.duplicated, halved, refund }
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
              limit: gaugeLimit(r.balance, who.plan, deps.isPaidPlan, who.monthlyGrant),
              recoveryAmount: DAILY_RECOVERY_AMOUNT,
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
    // 有料の AI を呼んだあとの失敗は、ハンドラが印（DOYA_POWER_CONSUMED_HEADER）を付けて知らせる。印があれば戻さない
    // （失敗を起こして無料で AI を使えないように。印は利用者に返す前に外す）
    const consumed = res.headers.get(DOYA_POWER_CONSUMED_HEADER) === '1'
    if (consumed) { try { res.headers.delete(DOYA_POWER_CONSUMED_HEADER) } catch { /* 変えられない応答なら、そのまま返す */ } }
    if (res.status >= 400 && !consumed) {
      await outcome.refund()
      return res
    }
    // 戻さなかった（減ったままの）操作だけ、キーを返す。画面はこれを「作り直す」の retryOf に使う
    try { res.headers.set(DOYA_POWER_OP_HEADER, outcome.opKey) } catch { /* 変えられない応答なら、そのまま返す */ }
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
      return { balance: { remaining: b.total, limit: gaugeLimit(b.total, who.plan, deps.isPaidPlan, who.monthlyGrant) }, costs: {} }
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
      limit: gaugeLimit(b.total, who.plan, deps.isPaidPlan, who.monthlyGrant),
      byKind: b.byKind,
      nextRecoveryAt: b.nextRecoveryAt ? b.nextRecoveryAt.toISOString() : null,
      nextExpiry: b.nextExpiry ? { at: b.nextExpiry.at.toISOString(), amount: b.nextExpiry.amount } : null,
    }
  }

  return { charge, run, shellState, balanceView, target }
}

export type DoyaPowerCharger = ReturnType<typeof createDoyaPowerCharger>
