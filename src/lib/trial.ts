// ============================================
// 初月無料トライアルの付与可否（単一ソース）
// 「過去に実サブスク履歴の無い新規顧客のみ」対象。解約→再契約での繰り返し取得(trial cycling)を防ぐ。
// checkout（実付与）と trial-eligibility API（表示出し分け）の両方から使う。
//
// 重要: checkout は customer_email で都度 Stripe 顧客を作るため、同一メールでも顧客が複数に分かれうる。
// またアカウント再作成等で User.stripeCustomerId が null になることもある。
// よって「保存済み customerId」だけでなく「メールに紐づく全 Stripe 顧客」を横断して履歴を見る。
//
// さらに DB の今の契約状態も見る。管理者の付与などで Stripe の履歴を持たずに有料になった利用者は、
// Stripe だけを見ると「新規」に見えてしまう。User.plan（料金判定の唯一の真実, INV-1）か、
// UserServiceSubscription のいずれかの行が有料なら、Stripe を照会せずに対象外とする。
// ============================================
import { stripe } from '@/lib/stripe'
import { isPaidPlan } from '@/lib/unified-plan'

/** 判定に必要な DB の列。checkout と trial-eligibility は同じ select を使う。 */
export const TRIAL_USER_SELECT = {
  stripeCustomerId: true,
  plan: true,
  serviceSubscriptions: { select: { plan: true } },
} as const

/**
 * DB 上に有料の契約状態があれば true。
 * - User.plan が有料（isPaidPlan）
 * - UserServiceSubscription のいずれかの行が有料（INV-2 が崩れた状態でも取りこぼさない）
 */
export function hasPaidPlanInDb(params: {
  plan?: string | null
  servicePlans?: ReadonlyArray<string | null | undefined> | null
}): boolean {
  if (isPaidPlan(params.plan)) return true
  return (params.servicePlans || []).some(p => isPaidPlan(p))
}

// incomplete/incomplete_expired は「カード入力途中で放棄」等で実際には開始していないサブスク。
// これらは履歴に数えない（初回放棄者を永久に対象外にしないため）。
function isRealSubscriptionStatus(status: string): boolean {
  return status !== 'incomplete' && status !== 'incomplete_expired'
}

/**
 * トライアル対象なら true。
 * - DB 上で有料（User.plan か UserServiceSubscription.plan）→ false。Stripe は照会しない
 * - メール／customerId いずれからも Stripe 顧客が見つからない（完全な新規）→ true
 * - メールに紐づくいずれかの顧客に実サブスク履歴あり → false（既存/再契約者）
 * - 照会失敗時 → 例外。対象外と区別し、無料期間なしの決済を作らない。
 */
export async function isTrialEligible(params: {
  email?: string | null
  stripeCustomerId?: string | null
  // DB の契約状態。呼び出し側が渡し忘れないよう、キーは必須にする（ユーザー行が無いときは undefined）。
  plan: string | null | undefined
  servicePlans: ReadonlyArray<string | null | undefined> | null | undefined
}): Promise<boolean> {
  if (hasPaidPlanInDb(params)) return false
  const customerIds = new Set<string>()
  const expectedEmail = params.email?.trim().toLowerCase() || ''
  if (params.email) {
    let cursor: string | undefined
    const seen = new Set<string>()
    while (true) {
      const customers = await stripe.customers.list({ email: params.email, limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
      for (const c of customers.data) {
        if (c.email?.trim().toLowerCase() === expectedEmail) customerIds.add(c.id)
      }
      if (!customers.has_more) break
      const next = customers.data[customers.data.length - 1]?.id
      if (!next || seen.has(next)) throw new Error('Trial customer pagination did not advance')
      seen.add(next)
      cursor = next
    }
  }
  if (params.stripeCustomerId && !customerIds.has(params.stripeCustomerId)) {
    // DBに保存されたIDだけでは本人の顧客と確定できない。別人の履歴で無料対象外にしない。
    if (!expectedEmail) throw new Error('Trial customer email is required')
    const stored = await stripe.customers.retrieve(params.stripeCustomerId)
    if (!stored.deleted && stored.email?.trim().toLowerCase() === expectedEmail) {
      customerIds.add(stored.id)
    }
  }
  for (const cid of customerIds) {
    let cursor: string | undefined
    const seen = new Set<string>()
    while (true) {
      const subs = await stripe.subscriptions.list({ customer: cid, status: 'all', limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
      if (subs.data.some(s => isRealSubscriptionStatus(s.status))) return false
      if (!subs.has_more) break
      const next = subs.data[subs.data.length - 1]?.id
      if (!next || seen.has(next)) throw new Error('Trial subscription pagination did not advance')
      seen.add(next)
      cursor = next
    }
  }
  return true
}
