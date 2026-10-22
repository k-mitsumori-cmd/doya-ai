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
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isUiNext } from '@/lib/ui-next'
import { isPaidPlan } from '@/lib/unified-plan'
import { currentUserId } from '@/lib/shell/company.server'
import { doyaPowerRollout, isDoyaPowerEnabled } from './flag'
import { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume } from './index'
import { createDoyaPowerCharger } from './charge-core'
import type { DoyaPowerAction } from './costs'

export const doyaPowerCharger = createDoyaPowerCharger({
  rollout: () => doyaPowerRollout(),
  isEnabled: isDoyaPowerEnabled,
  isUiNext,
  account: async () => {
    const userId = await currentUserId()
    if (!userId) return null
    const [company, user] = await Promise.all([
      prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    ])
    return company ? { companyId: company.id, plan: user?.plan ?? null } : null
  },
  ledger: { consume, refund, grantMonthlyForPlan, balance, operationStatus, recentConsume },
  isPaidPlan,
})

type Body = Record<string, unknown> | null

export type ChargeSpec = {
  /** 操作の名前。本文で変わるときは関数（null なら減らさない） */
  action: DoyaPowerAction | ((body: Body) => DoyaPowerAction | null)
  /** 件数（画像の枚数など）。無ければ 1 */
  units?: (body: Body) => number | undefined
  /** 同じ操作をまとめる ID（クライアントの operationId など）。無ければその呼び出しだけの操作 */
  key?: (body: Body) => unknown
  /** 作り直しのとき、前の操作のキー（クライアントが retryOf で示す）。5分以内なら半分 */
  retryOf?: (body: Body) => unknown
  /** 同じ対象を表すキー（同じ対象を5分以内に作り直したら半分） */
  target?: (body: Body) => unknown
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
    const body = (await req.clone().json().catch(() => null)) as Body
    const action = typeof spec.action === 'function' ? spec.action(body) : spec.action
    if (!action) return handler(req, ...rest)
    const outcome = await doyaPowerCharger.charge(action, { units: spec.units?.(body), key: spec.key?.(body), retryOf: spec.retryOf?.(body), target: spec.target?.(body), scope: routeScope(req) })
    return doyaPowerCharger.run(outcome, () => handler(req, ...rest))
  }
}

/** 本文の数（count など）を、範囲に収めた整数にする */
export function intIn(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}
