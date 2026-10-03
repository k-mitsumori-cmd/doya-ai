/** Stripeで確認した契約状態だけを運営通知に記載する。申込と入金は別イベント。 */
export function billingSubscriptionNotice(
  subscription: { status: string; trial_end?: number | null; current_period_end?: number | null },
  planId: string
): { type: 'trial_start' | 'subscription'; text: string } {
  const tier = planId === 'bundle' ? 'バンドル' :
    planId.endsWith('-enterprise') ? 'エンタープライズ' :
    planId.endsWith('-light') || planId.endsWith('-starter') ? 'ライト' : 'プロ'
  const trial = subscription.status === 'trialing'
  const parts = [`${tier}プラン（${planId}）`, `契約状態: ${subscription.status}`]
  const end = trial ? subscription.trial_end : subscription.current_period_end
  if (typeof end === 'number' && Number.isFinite(end) && end > 0) {
    const date = new Date(end * 1000).toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric',
    })
    parts.push(`${trial ? '無料体験終了予定' : '現在の契約期間終了予定'}: ${date}`)
  }
  if (subscription.status === 'past_due') parts.push('請求状態の確認が必要です')
  return { type: trial ? 'trial_start' : 'subscription', text: parts.join(' ｜ ') }
}
