// ============================================
// 請求の状態の見せ方（DB と Stripe に触らない計算）
// ============================================
// 支払いの状態ごとに、画面に出す文と行き先を1か所で決める。
// 料金ページ（TeamManage の請求のまとめ）と、ドヤくんの知らせ（UI リニューアルの GUIDE_POPUPS_ROLLOUT）で同じ文を使う。
// 状態の扱いは課金の正本 §5 のとおり: past_due は猶予（有料のまま）、unpaid・canceled で FREE。

/** カスタマーポータル（支払い方法の変更・請求の履歴・解約）。戻り先は料金ページ */
export const BILLING_PORTAL_HREF = '/api/stripe/portal?returnTo=%2Fpricing'

export type BillingStatusView = {
  tone: 'ok' | 'note' | 'bad'
  title: string
  body: string
  action: { label: string; href: string } | null
}

export function billingStatusView(input: { status: string; cancelAtPeriodEnd: boolean }): BillingStatusView {
  if (input.status === 'past_due') {
    return {
      tone: 'bad',
      title: 'お支払いが確認できていません',
      body: 'カードの有効期限や限度額をご確認のうえ、お支払い方法を更新してください。更新するまでのあいだも、今のプランのままお使いいただけます。',
      action: { label: 'お支払い方法を更新する', href: BILLING_PORTAL_HREF },
    }
  }
  if (input.status === 'unpaid') {
    return {
      tone: 'bad',
      title: 'お支払いが済んでいないため、無料のプランになりました',
      body: 'お支払い方法を更新すると、もう一度お申し込みいただけます。',
      action: { label: 'お支払い方法を更新する', href: BILLING_PORTAL_HREF },
    }
  }
  if (input.cancelAtPeriodEnd) {
    return {
      tone: 'note',
      title: '解約の予約があります',
      body: '今の期間の終わりまでお使いいただけます。解約の予約は、期間の終わりまで取り消せます。',
      action: { label: '解約の予約を取り消す', href: BILLING_PORTAL_HREF },
    }
  }
  if (input.status === 'trialing') {
    return { tone: 'ok', title: '無料の期間中です', body: '無料の期間が終わると、お支払いが始まります。', action: null }
  }
  return { tone: 'ok', title: 'ご契約中です', body: '', action: null }
}
