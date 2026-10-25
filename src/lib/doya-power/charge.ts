// ============================================
// 生成の API で、ドヤパワーを減らす・戻す（本番の部品をつないだもの）
// ============================================
// 中身は charge-core.ts。ここは旗・セッション・会社・台帳（Prisma）をつなぐだけ。
// 使い方（API の入口を包む）:
//   async function postHandler(req: NextRequest) { ...今までの処理... }
//   export const POST = withDoyaPowerCharge({ action: 'text.generate', key: (b) => b?.operationId }, postHandler)
// ⚠️ 旗（DOYA_POWER_ROLLOUT）が off のときは、本文も読まず、セッションも台帳も読まずに、今までの処理をそのまま呼ぶ。
// ⚠️ 会社はセッションの本人の会社だけ（account_companies の userId）。body の companyId は信じない。
import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isPaidPlan } from '@/lib/unified-plan'
import { currentUserId } from '@/lib/shell/company.server'
import { resolveCompanyForUser } from '@/lib/pricing-v2/team.server'
import { doyaPowerRollout, isDoyaPowerEnabled } from './flag'
import { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume } from './index'
import { createDoyaPowerCharger } from './charge-core'
import { DOYA_POWER_RETRY_HEADER } from './retry'
import { readOperationalJson, OperationalBodyError } from '@/lib/operational-json'
export { parseCount } from './count'
export { DOYA_POWER_CONSUMED_HEADER } from './charge-core'

/** 包みが本文を読むときの上限（課金の判定に使う短い項目だけを見る） */
const CHARGE_BODY_MAX_BYTES = 64 * 1024
import type { DoyaPowerAction } from './costs'

export const doyaPowerCharger = createDoyaPowerCharger({
  rollout: () => doyaPowerRollout(),
  isEnabled: isDoyaPowerEnabled,
  account: async () => {
    const userId = await currentUserId()
    if (!userId) return null
    // 本人が持ち主の会社を先に見る。無ければ、参加しているチームの会社（旗 NEW_PRICING_ROLLOUT が on のときだけ）。
    // plan は会社の持ち主のプラン（チームの料金を払っているのは持ち主）
    const company = await resolveCompanyForUser(userId)
    return company ? { companyId: company.companyId, plan: company.plan } : null
  },
  ledger: { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume },
  isPaidPlan,
})

type Body = Record<string, unknown> | null

export type ChargeSpec = {
  /** 操作の名前。本文で変わるときは関数（null なら減らさない） */
  action: DoyaPowerAction | ((body: Body) => DoyaPowerAction | null)
  /** 本文が読めないとき、減らす前に 400 で断る理由（無ければ null）。off のときは呼ばない（ハンドラ自身が同じ判定をする） */
  invalid?: (body: Body) => string | null
  /** 件数（画像の枚数など）。無ければ 1 */
  units?: (body: Body) => number | undefined
  /** 同じ操作をまとめる ID（クライアントの operationId など）。無ければその呼び出しだけの操作 */
  key?: (body: Body) => unknown
  /** 作り直しのとき、前の操作のキー（クライアントが retryOf で示す）。5分以内なら半分 */
  retryOf?: (body: Body) => unknown
  /**
   * 作り直しのボタンがあるルートは true。リクエストのヘッダー（DOYA_POWER_RETRY_HEADER）の前の操作のキーを retryOf として見る。
   * 本文は読まない（大きな本文のルートでも上限の 413 にならない）。半分にするかは台帳が決める（同じ会社・同じ操作の名前・5分以内）
   */
  retry?: boolean
  /**
   * 同じ対象を表すキー。⚠️ サーバーが決める（ルートのパラメータや、本文の中の ID から。クライアントの自由な値をそのまま使わない）。
   * 作り直し（retry: true）で半分にするには、これが必要。null を返す・指定が無いルートは半分にしない。
   * 前の消費の note（target:<キー>）と同じで、同じルートの全額の消費だったときだけ半分になる。
   * 第2引数以降は、ルートの入口に渡るもの（req と、[id] などの ctx）
   */
  target?: (body: Body, req: NextRequest, ...rest: any[]) => unknown | Promise<unknown>
  /** target が本文の項目を使うときだけ true（本文を読む）。ルートのパラメータだけなら付けない */
  targetBody?: boolean
  /** 包みが本文を読むときの上限（バイト）。無ければ 64KB。target に使う項目が、大きな本文（画像など）の中にあるルートだけ上げる */
  bodyMaxBytes?: number
}

/** 対象のキーを作る。種類（kind）と値から、台帳の note に入れても安全な短い文字列にする（値が空・文字列でなければ null） */
export function targetKeyOf(kind: string, value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  return /^[A-Za-z0-9_-]{1,100}$/.test(v) ? `${kind}:${v}` : `${kind}:h-${createHash('sha256').update(v).digest('hex').slice(0, 24)}`
}

/** [id] などのルートのパラメータを読む（ctx は Next.js の 2つ目の引数。Promise でもそのままでも） */
export async function routeParam(rest: unknown[], name: string): Promise<string | null> {
  const ctx = rest[0] as { params?: unknown } | undefined
  try {
    const params = (await (ctx?.params as unknown)) as Record<string, unknown> | undefined
    const v = params?.[name]
    return typeof v === 'string' ? v : null
  } catch {
    return null
  }
}

/** ルートの名前空間。道すじ（/api/sfa/ai/score など）の短い要約。同じ操作の名前を使う別のルートで、キーを共有させないために使う */
export function routeScope(req: Pick<NextRequest, 'url'>): string {
  let path = ''
  try { path = new URL(req.url).pathname } catch { path = '' }
  return `r-${createHash('sha256').update(path).digest('hex').slice(0, 12)}`
}

/** API の入口（POST など）を包み、生成の前に減らし、失敗なら戻す */
export function withDoyaPowerCharge<R extends unknown[]>(spec: ChargeSpec, handler: (req: NextRequest, ...rest: R) => Promise<Response>) {
  return async (req: NextRequest, ...rest: R): Promise<Response> => {
    // 旗が off なら、本文も読まずに今までの処理へ（台帳にもセッションにも触れない）
    if (doyaPowerRollout() === 'off') return handler(req, ...rest)
    // 本文は、決まり（spec）が本文を見るときだけ読む。読むときも大きさに上限を付ける（大きな本文で処理を止められないように）
    const needsBody = typeof spec.action === 'function' || !!(spec.invalid || spec.units || spec.key || spec.retryOf || (spec.target && spec.targetBody))
    let body: Body = null
    if (needsBody) {
      try {
        body = await readOperationalJson(req.clone(), spec.bodyMaxBytes ?? CHARGE_BODY_MAX_BYTES)
      } catch (e) {
        if (e instanceof OperationalBodyError && e.status === 413) return NextResponse.json({ error: '送った内容が大きすぎます。' }, { status: 413, headers: { 'Cache-Control': 'private, no-store' } })
        body = null
      }
    }
    const bad = spec.invalid?.(body)
    if (bad) return NextResponse.json({ error: bad }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } })
    const action = typeof spec.action === 'function' ? spec.action(body) : spec.action
    if (!action) return handler(req, ...rest)
    const outcome = await doyaPowerCharger.charge(action, { units: spec.units?.(body), key: spec.key?.(body), retryOf: spec.retryOf?.(body) ?? (spec.retry ? req.headers.get(DOYA_POWER_RETRY_HEADER) : undefined), target: spec.target ? await Promise.resolve().then(() => spec.target!(body, req, ...rest)).catch(() => null) : undefined, scope: routeScope(req) })
    return doyaPowerCharger.run(outcome, () => handler(req, ...rest))
  }
}

/** 本文の数（count など）を、範囲に収めた整数にする */
export function intIn(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}
