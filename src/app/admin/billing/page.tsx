'use client'

import { useState } from 'react'
import { useAdminBilling } from '@/lib/use-admin-billing'
import { adminBillingCsv } from '@/lib/admin-billing-csv'
import type { AdminBillingPeriod } from '@/lib/admin-billing-period'

const yen = (value: number) => `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
const buttonClass = 'min-h-11 shrink-0 whitespace-nowrap rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50'
const panelClass = 'rounded-xl border border-white/10 bg-[#1F1F1F] p-4 sm:p-6'

export default function BillingPage() {
  const [period, setPeriod] = useState<AdminBillingPeriod>('month')
  const { data, error, isLoading, isRefreshing, refresh } = useAdminBilling(period)
  const [exportError, setExportError] = useState<string | null>(null)

  const exportReport = () => {
    if (!data || isRefreshing || error) return
    setExportError(null)
    let url: string | undefined
    let anchor: HTMLAnchorElement | undefined
    try {
      url = URL.createObjectURL(new Blob([adminBillingCsv(data)], { type: 'text/csv;charset=utf-8' }))
      anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `doya-billing-${data.period}-${data.label}.csv`
      document.body.appendChild(anchor)
      anchor.click()
    } catch {
      setExportError('CSVを出力できませんでした。もう一度お試しください。')
    } finally {
      anchor?.remove()
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1_000)
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-[#181818] p-6 text-white sm:p-8">
      <div className="mb-8 flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
        <div>
          <h1 className="mb-1 text-2xl font-bold">売上・課金管理</h1>
          <p className="text-sm text-white/70">定期契約の入金・返金と、現在の契約指標を確認できます。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="billing-period">入金・返金の集計期間</label>
          <select id="billing-period" value={period}
            onChange={event => { setPeriod(event.target.value as AdminBillingPeriod); setExportError(null) }}
            className={`${buttonClass} bg-[#1F1F1F]`}>
            <option value="month">今月</option>
            <option value="quarter">今四半期</option>
            <option value="year">今年</option>
          </select>
          <button type="button" onClick={exportReport} disabled={!data || isRefreshing || !!error} className={buttonClass}>CSV出力</button>
          <button type="button" onClick={refresh} disabled={isRefreshing} className={buttonClass}>更新</button>
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-red-300">{error}{data ? ' 前回取得したデータを表示しています。' : ''}</p>}
      {exportError && <p role="alert" className="mb-4 text-red-300">{exportError}</p>}
      {!data && error && <button type="button" onClick={refresh} disabled={isRefreshing} className={buttonClass}>再取得する</button>}
      {isLoading && (
        <div role="status" aria-label="売上・課金データを読み込み中" className="space-y-4">
          <p>売上・課金データを取得しています。</p>
          <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map(item => <div key={item} className={`${panelClass} h-32 bg-white/5`} />)}
          </div>
        </div>
      )}
      {isRefreshing && data && <p role="status" className="mb-4 text-sm text-white/70">更新しています。</p>}

      {data && <>
        <div className="mb-6 space-y-2 text-sm text-white/70">
          <p>入金・返金の期間：{data.label}（日本時間）</p>
          <p>取得基準：{new Date(data.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}（日本時間）</p>
          <p>ドヤAIの定期契約に紐づくJPYの請求・返金が対象です。単発購入や他事業の売上は含みません。</p>
        </div>
        <section aria-labelledby="billing-cash-title" className="mb-8">
          <h2 id="billing-cash-title" className="mb-4 text-lg font-semibold">{data.label}の入金・返金</h2>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['返金控除後の入金', yen(data.netRevenue)], ['入金合計', yen(data.paidTotal)],
              ['返金合計', yen(data.refundTotal)], ['入金済み請求書', `${data.paidInvoiceCount}件`],
            ].map(([label, value]) => <div key={label} className={panelClass}><dt className="mb-2 text-sm text-white/70">{label}</dt><dd className="break-words text-2xl font-bold tabular-nums">{value}</dd></div>)}
          </dl>
          <p className="mt-4 text-sm text-white/70">返金処理中：{data.pendingRefundCount}件・{yen(data.pendingRefundTotal)}。処理中の返金は、返金合計と控除後の入金にまだ反映していません。</p>
        </section>
        <section aria-labelledby="billing-current-title" className="mb-8">
          <h2 id="billing-current-title" className="mb-2 text-lg font-semibold">取得時点の契約指標</h2>
          <p className="mb-4 text-sm text-white/70">期間選択は入金・返金に適用されます。以下は取得時点の値です。MRRは税抜の月額換算で、期間内の入金額とは異なります。</p>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['MRR（月次経常収益）', yen(data.mrr)],
              ['MRR計上顧客数', data.activeCustomers === null ? '確認できません' : `${data.activeCustomers}人`],
              ['ARPU（月額）', data.arpu === null ? '確認できません' : yen(data.arpu)],
              ['試用中の契約', `${data.trialingSubscriptions}件`],
            ].map(([label, value]) => <div key={label} className={panelClass}><dt className="mb-2 text-sm text-white/70">{label}</dt><dd className="break-words text-2xl font-bold tabular-nums">{value}</dd></div>)}
          </dl>
          <div className="mt-4 space-y-2 text-sm text-white/70">
            <p>有効・支払遅延の契約：{data.activeSubscriptions}件。このうちMRR計上は{data.mrrSubscriptions}件です。試用中と従量課金部分はMRRに含みません。</p>
            <p>ARPUはMRRを計上した顧客IDの重複を除いた人数で割ります。顧客を特定できない場合は、人数とARPUを表示しません。</p>
            <p>割引の集計：繰り返し割引は{data.discountPolicy.subtractRecurringDiscounts ? '控除します' : '控除しません'}。一度限りの割引は{data.discountPolicy.subtractOneTimeDiscounts ? '控除します' : '控除しません'}。永続割引は常に控除します。Stripe Dashboardの集計設定との一致は未確認です。</p>
            <p>セット契約の金額は、サービス別に按分していません。</p>
          </div>
        </section>
      </>}
    </div>
  )
}
