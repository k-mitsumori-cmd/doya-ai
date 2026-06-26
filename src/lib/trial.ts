// ============================================
// 初月無料トライアルの付与可否（単一ソース）
// 「過去に実サブスク履歴の無い新規顧客のみ」対象。解約→再契約での繰り返し取得(trial cycling)を防ぐ。
// checkout（実付与）と trial-eligibility API（表示出し分け）の両方から使う。
//
// 重要: checkout は customer_email で都度 Stripe 顧客を作るため、同一メールでも顧客が複数に分かれうる。
// またアカウント再作成等で User.stripeCustomerId が null になることもある。
// よって「保存済み customerId」だけでなく「メールに紐づく全 Stripe 顧客」を横断して履歴を見る。
// ============================================
import { stripe } from '@/lib/stripe'

// incomplete/incomplete_expired は「カード入力途中で放棄」等で実際には開始していないサブスク。
// これらは履歴に数えない（初回放棄者を永久に対象外にしないため）。
function isRealSubscriptionStatus(status: string): boolean {
  return status !== 'incomplete' && status !== 'incomplete_expired'
}

/**
 * トライアル対象なら true。
 * - メール／customerId いずれからも Stripe 顧客が見つからない（完全な新規）→ true
 * - メールに紐づくいずれかの顧客に実サブスク履歴あり → false（既存/再契約者）
 * - 照会失敗時 → false（安全側。過剰付与＝trial cycling を防ぐ）
 */
export async function isTrialEligible(params: {
  email?: string | null
  stripeCustomerId?: string | null
}): Promise<boolean> {
  try {
    const customerIds = new Set<string>()
    if (params.stripeCustomerId) customerIds.add(params.stripeCustomerId)
    if (params.email) {
      const customers = await stripe.customers.list({ email: params.email, limit: 100 })
      for (const c of customers.data) customerIds.add(c.id)
    }
    // 顧客レコードが1件も無い＝完全な新規ユーザー
    if (customerIds.size === 0) return true

    for (const cid of customerIds) {
      const subs = await stripe.subscriptions.list({ customer: cid, status: 'all', limit: 100 })
      if (subs.data.some((s) => isRealSubscriptionStatus(s.status))) return false
    }
    return true
  } catch {
    return false
  }
}
