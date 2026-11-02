import type { AdminBillingData } from './admin-billing-contract'

const cell = (value: string | number) => {
  // テキストの数式評価を防ぐ。検証済みの数値（返金超過の負数を含む）は数値として出力。
  const text = typeof value === 'number' ? String(value) : (/^[\s]*[=+\-@]/.test(value) ? `'${value}` : value)
  return `"${text.replace(/"/g, '""')}"`
}

export function adminBillingCsv(data: AdminBillingData): string {
  const rows: (string | number)[][] = [
    ['項目', '値', '単位・対象'],
    ['集計対象', 'ドヤAIの定期契約の入金・返金', 'JPYのみ。単発購入・他事業は含まない'],
    ['期間', data.label, '日本時間の暦期間'], ['開始日時', data.since, '含む'], ['終了日時', data.until, '含まない'],
    ['取得基準日時', data.updatedAt, '契約指標はこの時点の値'],
    ['入金済み請求書', data.paidInvoiceCount, '件'], ['入金合計', data.paidTotal, '円'], ['返金合計', data.refundTotal, '円'],
    ['返金控除後入金', data.netRevenue, '円'], ['返金処理中', data.pendingRefundCount, '件'], ['返金処理中金額', data.pendingRefundTotal, '円。控除前'],
    ['MRR', data.mrr, '円/月。税抜・現在の契約月額換算'], ['契約数', data.activeSubscriptions, 'active/past_due'],
    ['MRR計上契約数', data.mrrSubscriptions, '件'], ['MRR計上顧客数', data.activeCustomers ?? '確認できません', '人。顧客IDで重複除外'],
    ['ARPU', data.arpu ?? '確認できません', '円/月。MRR÷MRR計上顧客数'], ['試用契約数', data.trialingSubscriptions, '件。MRR対象外'],
    ['繰り返し割引', data.discountPolicy.subtractRecurringDiscounts ? '控除' : '控除しない', '永続割引は常に控除'],
    ['一度限りの割引', data.discountPolicy.subtractOneTimeDiscounts ? '控除' : '控除しない', 'Stripe Dashboardの集計設定との一致は未確認'],
  ]
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
