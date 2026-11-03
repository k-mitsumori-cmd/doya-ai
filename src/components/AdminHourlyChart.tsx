import { adminHourlyChartTimes } from '@/lib/admin-hourly-chart'

interface Props {
  lastUpdated: unknown
  values: unknown
  className?: string
}

const validCounts = (value: unknown): value is number[] => Array.isArray(value)
  && value.length === 12 && value.every(item => typeof item === 'number' && Number.isSafeInteger(item) && item >= 0)

/** A shared display for saved records. The parent owns fetching, stale-data retention and retry. */
export default function AdminHourlyChart({ lastUpdated, values, className = '' }: Props) {
  let hours: ReturnType<typeof adminHourlyChartTimes> | null = null
  if (typeof lastUpdated === 'string' && validCounts(values)) {
    try { hours = adminHourlyChartTimes(lastUpdated) } catch { /* Render an explicit unavailable state. */ }
  }
  const shell = `min-w-0 w-full rounded-xl border border-white/10 bg-[#181818] p-4 sm:p-6 ${className}`
  if (!hours || typeof lastUpdated !== 'string' || !validCounts(values)) return (
    <section className={shell} aria-label="時間別の保存記録">
      <h2 className="text-lg font-semibold text-white">時間別の保存記録</h2>
      <p role="alert" className="mt-3 text-sm text-white/70">時間別の統計を表示できません。画面の更新ボタンで再取得してください。</p>
    </section>
  )
  const max = Math.max(...values, 1)
  return (
    <section className={shell} aria-label="時間別の保存記録">
      <h2 className="text-lg font-semibold text-white">
        <span className="inline-block">時間別の保存記録</span>{' '}
        <span className="inline-block whitespace-nowrap">（日本時間）</span>
      </h2>
      <p className="mt-2 text-sm text-white/70">取得基準：<time dateTime={lastUpdated}>{new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(lastUpdated))}</time></p>
      <p className="mt-2 text-sm text-white/70">12区間を表示します。最後の区間は取得時点までの集計です。</p>
      <div role="region" aria-label="時間別グラフ（日本時間）" tabIndex={0} className="mt-4 overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">
        <ol aria-label="時間別の件数" className="flex h-48 min-w-[36rem] items-end gap-2">
          {values.map((value, index) => {
            const hour = hours[index]
            const description = `${hour.date} ${hour.label} 日本時間：${value}件${hour.partial ? '（取得時点まで）' : ''}`
            return (
              <li key={hour.since} aria-label={description} className="flex h-full min-w-0 flex-1 flex-col items-center gap-2">
                <span className="text-xs text-white/70">{value}件</span>
                <div aria-hidden="true" className="flex min-h-0 w-full flex-1 items-end">
                  <div className={`w-full rounded-t-lg ${index === 11 ? 'bg-blue-500' : 'bg-white/20'}`} style={{ height: `${value / max * 100}%` }} />
                </div>
                <time dateTime={hour.since} title={description} className="text-xs text-white/70">{hour.label}</time>
              </li>
            )
          })}
        </ol>
      </div>
      <p className="mt-2 text-xs text-white/70">横にスクロールすると全区間を確認できます。各時刻の説明には日付と件数を含めています。</p>
      <p className="mt-3 text-xs text-white/70">保存された利用・生成の記録です。利用ログを含み、生成成功回数や出力個数とは異なります。</p>
    </section>
  )
}
