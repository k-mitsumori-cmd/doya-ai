// ドヤパワーの台帳（会社ごとのポイントの増減）。
// - 残りの正は DoyaPowerGrant.remaining の合計（期限内の分）。DoyaPowerAccount.balance は表示用の写し
// - consume は operationId の unique 制約で、同じ操作を二重に減らさない（記録を先に作り、減らすのはその後）
// - refund は refundOf の unique 制約で、戻しは1回だけ
// - 期限切れの分は、読み書きのたびに expire の記録を付けて 0 にする。減らすのは期限の近い順
// - 毎日の回復（日本時間の日付で切り替え）も、読み書きのたびに足す（cron に頼らない）
// - 会社の決め方（セッションの本人の会社だけ）は呼ぶ側の責任。ユーザーから引くときは balanceForUser を使う
// ⚠️ DB の外（有料の API など）は呼ばない。db は Prisma のクライアント（テストでは memory-db）を渡す
import { isPaidPlan } from '@/lib/unified-plan'
import {
  BONUS_KINDS,
  DAILY_RECOVERY_CAP,
  GRANT_KINDS,
  MONTHLY_BONUS_CAP,
  allocate,
  clampPurchaseExpiresAt,
  dailyRecoveryToAdd,
  isGrantKind,
  isUsable,
  isValidAmount,
  jstDayKey,
  jstMonthKey,
  jstMonthStart,
  jstNextDayStart,
  monthlyGrantExpiresAt,
  monthlyGrantForPlan,
  type Allocation,
  type GrantKind,
} from './rules'

/** Prisma のクライアントのうち、台帳が使う部分（テストでは memory-db が同じ形を持つ） */
export type LedgerDb = {
  $transaction: (fn: (tx: any) => Promise<any>, options?: any) => Promise<any>
}

type GrantRow = {
  id: string
  accountId: string
  kind: string
  amount: number
  remaining: number
  grantedAt: Date
  expiresAt: Date | null
  sourceKey: string | null
}
type AccountRow = { id: string; companyId: string; balance: number; lastRecoveryDay: string | null }

export type ConsumeResult =
  | { ok: true; operationId: string; amount: number; balance: number; duplicated: boolean }
  | { ok: false; reason: 'invalid' | 'company_not_found' | 'operation_conflict' }
  | { ok: false; reason: 'insufficient'; balance: number }

export type RefundResult =
  | { ok: true; operationId: string; amount: number; duplicated: boolean }
  | { ok: false; reason: 'invalid' | 'not_found' }

export type GrantResult =
  | { ok: true; grantId: string; granted: number; balance: number; duplicated: boolean }
  | { ok: false; reason: 'invalid' | 'company_not_found' | 'monthly_bonus_cap' | 'recovery_cap' }

export type BalanceResult = {
  companyId: string
  total: number
  byKind: Record<GrantKind, number>
  /** 次に毎日の回復が付く時刻（回復が上限まで貯まっていれば null） */
  nextRecoveryAt: Date | null
  /** いちばん近い期限と、そのとき消える量（期限のある分が無ければ null） */
  nextExpiry: { at: Date; amount: number } | null
}

export type GrantOptions = { sourceKey?: string; note?: string }

class RetryableError extends Error {}
const MAX_ATTEMPTS = 4

function prismaCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined
}
const isRetryable = (e: unknown) => e instanceof RetryableError || prismaCode(e) === 'P2002' || prismaCode(e) === 'P2034'
const validId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 200

export function createDoyaPowerLedger(db: LedgerDb, options: { now?: () => Date } = {}) {
  const clock = options.now ?? (() => new Date())

  /** 直列化できる取引で実行し、競合（unique・直列化の失敗・同時に減らされた）のときはやり直す */
  async function run<T>(fn: (tx: any, now: Date) => Promise<T>): Promise<T> {
    let last: unknown
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const now = clock()
      try {
        return await db.$transaction((tx) => fn(tx, now), { isolationLevel: 'Serializable' })
      } catch (e) {
        if (!isRetryable(e)) throw e
        last = e
      }
    }
    throw last
  }

  async function findAccount(tx: any, companyId: string, create: boolean): Promise<AccountRow | null> {
    const found = await tx.doyaPowerAccount.findUnique({ where: { companyId } })
    if (found || !create) return found
    const company = await tx.accountCompany.findUnique({ where: { id: companyId }, select: { id: true } })
    if (!company) return null
    return tx.doyaPowerAccount.create({ data: { companyId, balance: 0, lastRecoveryDay: null } })
  }

  async function liveGrants(tx: any, accountId: string): Promise<GrantRow[]> {
    return tx.doyaPowerGrant.findMany({ where: { accountId, remaining: { gt: 0 } } })
  }

  const usableTotal = (grants: GrantRow[], now: Date) => grants.filter((g) => isUsable(g, now)).reduce((s, g) => s + g.remaining, 0)

  async function writeBalance(tx: any, account: AccountRow, grants: GrantRow[], now: Date): Promise<number> {
    const total = usableTotal(grants, now)
    if (account.balance !== total) {
      await tx.doyaPowerAccount.update({ where: { id: account.id }, data: { balance: total } })
      account.balance = total
    }
    return total
  }

  /** 期限切れを 0 にし、毎日の回復を足す。整えたあとの付与を返す */
  async function settle(tx: any, account: AccountRow, now: Date): Promise<GrantRow[]> {
    let grants = await liveGrants(tx, account.id)
    let running = usableTotal(grants, now)
    for (const g of grants) {
      if (g.expiresAt === null || g.expiresAt.getTime() > now.getTime()) continue
      const r = await tx.doyaPowerGrant.updateMany({ where: { id: g.id, remaining: g.remaining }, data: { remaining: 0 } })
      if (r.count !== 1) throw new RetryableError('grant changed while expiring')
      await tx.doyaPowerTransaction.create({
        data: { accountId: account.id, type: 'expire', amount: -g.remaining, balanceAfter: running, grantId: g.id, note: 'expired' },
      })
      g.remaining = 0
    }
    grants = grants.filter((g) => g.remaining > 0)

    const today = jstDayKey(now)
    if (account.lastRecoveryDay !== today) {
      const recovering = grants.filter((g) => g.kind === 'daily_recovery').reduce((s, g) => s + g.remaining, 0)
      const add = dailyRecoveryToAdd(account.lastRecoveryDay, today, recovering)
      if (add > 0) {
        const g: GrantRow = await tx.doyaPowerGrant.create({
          data: { accountId: account.id, kind: 'daily_recovery', amount: add, remaining: add, grantedAt: now, expiresAt: null, sourceKey: `daily:${today}` },
        })
        running += add
        await tx.doyaPowerTransaction.create({
          data: { accountId: account.id, type: 'grant', amount: add, balanceAfter: running, grantId: g.id, note: 'daily_recovery' },
        })
        grants.push(g)
      }
      await tx.doyaPowerAccount.update({ where: { id: account.id }, data: { lastRecoveryDay: today } })
      account.lastRecoveryDay = today
    }
    return grants
  }

  /** 会社の残りから amount を減らす。同じ operationId では1回だけ。足りなければ減らさずに拒む */
  async function consume(companyId: string, amount: number, operationId: string): Promise<ConsumeResult> {
    if (!validId(companyId) || !validId(operationId) || !isValidAmount(amount)) return { ok: false, reason: 'invalid' }
    return run(async (tx, now): Promise<ConsumeResult> => {
      const existing = await tx.doyaPowerTransaction.findUnique({ where: { operationId } })
      const account = await findAccount(tx, companyId, !existing)
      if (existing) {
        // 他の会社の操作の id なら、その会社の残りは何も返さない
        if (!account || existing.accountId !== account.id || existing.type !== 'consume') return { ok: false, reason: 'operation_conflict' }
        const grants = await liveGrants(tx, account.id)
        return { ok: true, operationId, amount: -existing.amount, balance: usableTotal(grants, now), duplicated: true }
      }
      if (!account) return { ok: false, reason: 'company_not_found' }
      const grants = await settle(tx, account, now)
      const plan = allocate(grants, amount, now)
      if (!plan) return { ok: false, reason: 'insufficient', balance: await writeBalance(tx, account, grants, now) }
      const after = usableTotal(grants, now) - amount
      // 記録を先に作る（operationId の unique で、同時に来た2回目はここで止まり、取引ごと取り消される）
      await tx.doyaPowerTransaction.create({
        data: { accountId: account.id, type: 'consume', amount: -amount, balanceAfter: after, operationId, allocations: plan },
      })
      for (const a of plan) {
        const r = await tx.doyaPowerGrant.updateMany({
          where: { id: a.grantId, accountId: account.id, remaining: { gte: a.amount } },
          data: { remaining: { decrement: a.amount } },
        })
        if (r.count !== 1) throw new RetryableError('grant changed while consuming')
        const g = grants.find((x) => x.id === a.grantId)!
        g.remaining -= a.amount
      }
      return { ok: true, operationId, amount, balance: await writeBalance(tx, account, grants, now), duplicated: false }
    })
  }

  /**
   * 失敗した操作の分を戻す（1回だけ）。減らしたときと同じ付与に戻す。
   * その付与が戻すまでに期限切れになっていれば、戻した分も次に整えるときに期限切れになる（期限を延ばさない）。
   * companyId を渡すと、その会社の操作でなければ not_found（他の会社の操作は戻さない・あるかも言わない）
   */
  async function refund(operationId: string, opts: { companyId?: string } = {}): Promise<RefundResult> {
    if (!validId(operationId) || (opts.companyId !== undefined && !validId(opts.companyId))) return { ok: false, reason: 'invalid' }
    return run(async (tx, now): Promise<RefundResult> => {
      const consumed = await tx.doyaPowerTransaction.findUnique({ where: { operationId } })
      if (!consumed || consumed.type !== 'consume') return { ok: false, reason: 'not_found' }
      if (opts.companyId !== undefined) {
        const account = await findAccount(tx, opts.companyId, false)
        if (!account || account.id !== consumed.accountId) return { ok: false, reason: 'not_found' }
      }
      const amount = -consumed.amount
      const done = await tx.doyaPowerTransaction.findUnique({ where: { refundOf: operationId } })
      if (done) return { ok: true, operationId, amount, duplicated: true }
      const account: AccountRow = await tx.doyaPowerAccount.findUnique({ where: { id: consumed.accountId } })
      const before = usableTotal(await liveGrants(tx, account.id), now)
      // 記録を先に作る（refundOf の unique で、戻しは1回だけ）
      await tx.doyaPowerTransaction.create({
        data: { accountId: account.id, type: 'refund', amount, balanceAfter: before, refundOf: operationId, note: 'refund' },
      })
      const allocations = (Array.isArray(consumed.allocations) ? consumed.allocations : []) as Allocation[]
      for (const a of allocations) {
        await tx.doyaPowerGrant.updateMany({ where: { id: a.grantId, accountId: account.id }, data: { remaining: { increment: a.amount } } })
      }
      const grants = await settle(tx, account, now)
      const total = await writeBalance(tx, account, grants, now)
      await tx.doyaPowerTransaction.updateMany({ where: { refundOf: operationId }, data: { balanceAfter: total } })
      return { ok: true, operationId, amount, duplicated: false }
    })
  }

  /**
   * 付与する。
   * - monthly: 期限は翌月の終わりまで（使い残しは1か月分だけ繰り越す）。既定の sourceKey は monthly:YYYY-MM（月に1回）
   * - daily_recovery: 期限なし。回復の残りと合わせて上限（DAILY_RECOVERY_CAP）まで
   * - bonus / mission: 会社ごとに日本時間の月で合わせて MONTHLY_BONUS_CAP まで（超える分は付けない）
   * - purchase: 期限は 6 か月以内に必ず収める（指定が無ければ 6 か月後）
   * 同じ sourceKey は1回だけ（2回目は duplicated）
   */
  async function grant(companyId: string, kind: GrantKind, amount: number, expiresAt: Date | null = null, opts: GrantOptions = {}): Promise<GrantResult> {
    if (!validId(companyId) || !isGrantKind(kind) || !isValidAmount(amount)) return { ok: false, reason: 'invalid' }
    if (opts.sourceKey !== undefined && !validId(opts.sourceKey)) return { ok: false, reason: 'invalid' }
    if (expiresAt !== null && (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime()))) return { ok: false, reason: 'invalid' }
    return run(async (tx, now): Promise<GrantResult> => {
      const account = await findAccount(tx, companyId, true)
      if (!account) return { ok: false, reason: 'company_not_found' }
      const sourceKey = opts.sourceKey ?? (kind === 'monthly' ? `monthly:${jstMonthKey(now)}` : null)
      if (sourceKey) {
        const dup = await tx.doyaPowerGrant.findUnique({ where: { accountId_sourceKey: { accountId: account.id, sourceKey } } })
        if (dup) {
          const grants = await liveGrants(tx, account.id)
          return { ok: true, grantId: dup.id, granted: dup.amount, balance: usableTotal(grants, now), duplicated: true }
        }
      }
      const grants = await settle(tx, account, now)

      let granted = amount
      let expires: Date | null = expiresAt
      if (kind === 'monthly') {
        const max = monthlyGrantExpiresAt(now)
        expires = expires && expires.getTime() < max.getTime() ? expires : max
      } else if (kind === 'daily_recovery') {
        expires = null
        const recovering = grants.filter((g) => g.kind === 'daily_recovery').reduce((s, g) => s + g.remaining, 0)
        granted = Math.min(amount, Math.max(0, DAILY_RECOVERY_CAP - recovering))
        if (granted <= 0) return { ok: false, reason: 'recovery_cap' }
      } else if (kind === 'purchase') {
        expires = clampPurchaseExpiresAt(now, expiresAt)
        if (!expires) return { ok: false, reason: 'invalid' }
      } else if ((BONUS_KINDS as readonly string[]).includes(kind)) {
        // 今月（日本時間）の bonus + mission の付与の合計。期限切れ・使い済みの分も数える
        const monthGrants: { amount: number }[] = await tx.doyaPowerGrant.findMany({
          where: { accountId: account.id, kind: { in: [...BONUS_KINDS] }, grantedAt: { gte: jstMonthStart(now) } },
          select: { amount: true },
        })
        const used = monthGrants.reduce((s, g) => s + g.amount, 0)
        granted = Math.min(amount, Math.max(0, MONTHLY_BONUS_CAP - used))
        if (granted <= 0) return { ok: false, reason: 'monthly_bonus_cap' }
      }
      if (expires && expires.getTime() <= now.getTime()) return { ok: false, reason: 'invalid' }

      const g: GrantRow = await tx.doyaPowerGrant.create({
        data: { accountId: account.id, kind, amount: granted, remaining: granted, grantedAt: now, expiresAt: expires, sourceKey },
      })
      grants.push(g)
      const total = await writeBalance(tx, account, grants, now)
      await tx.doyaPowerTransaction.create({
        data: { accountId: account.id, type: 'grant', amount: granted, balanceAfter: total, grantId: g.id, note: opts.note ?? kind },
      })
      return { ok: true, grantId: g.id, granted, balance: total, duplicated: false }
    })
  }

  /** プランに合わせた毎月の付与（無料は付けない。今の 1人の PRO はチームと同じ量）。月に1回だけ */
  async function grantMonthlyForPlan(companyId: string, plan: string | null | undefined): Promise<GrantResult | { ok: true; granted: 0; skipped: 'free_plan' }> {
    const amount = monthlyGrantForPlan(plan, isPaidPlan)
    if (amount <= 0) return { ok: true, granted: 0, skipped: 'free_plan' }
    return grant(companyId, 'monthly', amount, null)
  }

  /** 残り・種類ごとの内訳・次の回復の時刻。会社が無ければ null */
  async function balance(companyId: string): Promise<BalanceResult | null> {
    if (!validId(companyId)) return null
    return run(async (tx, now): Promise<BalanceResult | null> => {
      const account = await findAccount(tx, companyId, true)
      if (!account) return null
      const grants = (await settle(tx, account, now)).filter((g) => isUsable(g, now))
      const total = await writeBalance(tx, account, grants, now)
      const byKind = Object.fromEntries(GRANT_KINDS.map((k) => [k, 0])) as Record<GrantKind, number>
      for (const g of grants) if (isGrantKind(g.kind)) byKind[g.kind] += g.remaining
      const expiring = grants.filter((g) => g.expiresAt !== null)
      let nextExpiry: BalanceResult['nextExpiry'] = null
      if (expiring.length) {
        const at = Math.min(...expiring.map((g) => g.expiresAt!.getTime()))
        nextExpiry = { at: new Date(at), amount: expiring.filter((g) => g.expiresAt!.getTime() === at).reduce((s, g) => s + g.remaining, 0) }
      }
      return {
        companyId,
        total,
        byKind,
        nextRecoveryAt: byKind.daily_recovery < DAILY_RECOVERY_CAP ? jstNextDayStart(now) : null,
        nextExpiry,
      }
    })
  }

  /** セッションのユーザーの会社だけの残り（他の会社は引けない）。会社が未登録なら null */
  async function balanceForUser(userId: string): Promise<BalanceResult | null> {
    if (!validId(userId)) return null
    const company = await db.$transaction((tx) => tx.accountCompany.findUnique({ where: { userId }, select: { id: true } }))
    return company ? balance(company.id) : null
  }

  return { consume, refund, grant, grantMonthlyForPlan, balance, balanceForUser }
}

export type DoyaPowerLedger = ReturnType<typeof createDoyaPowerLedger>
