'use client'

import { useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useAdminAnalyticsPeriod } from '@/lib/use-admin-analytics-period'
import { adminAnalyticsPeriodCsv } from '@/lib/admin-analytics-export'
import type { AdminAnalyticsPeriod } from '@/lib/admin-analytics-period'

const date = (value: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value))
const control = 'min-h-11 px-3 py-2 rounded-lg border border-white/20 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 disabled:opacity-50'

export default function AdminAnalyticsPeriod() {
  const [period, setPeriod] = useState<AdminAnalyticsPeriod>('week')
  const { data, error, pending, refresh } = useAdminAnalyticsPeriod(period)
  const [exportError, setExportError] = useState<string | null>(null)
  const download = () => {
    if (!data || pending) return
    let url: string | undefined
    const anchor = document.createElement('a')
    try {
      setExportError(null)
      url = URL.createObjectURL(new Blob([adminAnalyticsPeriodCsv(data)], { type: 'text/csv;charset=utf-8' }))
      anchor.href = url
      anchor.download = `doya-analytics-${data.period}-${data.until.replace(/[:.]/g, '-')}.csv`
      document.body.appendChild(anchor)
      anchor.click()
    } catch {
      setExportError('CSVを保存できませんでした。もう一度お試しください。')
    } finally {
      anchor.remove()
      if (url) URL.revokeObjectURL(url)
    }
  }
  return (
    <section aria-labelledby="period-analytics-title" className="mb-8 rounded-xl border border-white/10 bg-white/5 p-4 sm:p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h2 id="period-analytics-title" className="text-lg font-bold">期間内の利用記録</h2>
        <div className="flex flex-wrap gap-2">
          <select aria-label="表示期間" className={`${control} bg-[#181818]`} value={period} onChange={event => { setExportError(null); setPeriod(event.target.value as AdminAnalyticsPeriod) }}>
            <option value="week">過去7日</option><option value="month">過去30日</option><option value="year">過去1年</option>
          </select>
          <button type="button" className={`${control} flex items-center gap-2`} onClick={download} disabled={!data || pending}><Download aria-hidden="true" className="w-4 h-4" />期間データをCSV保存</button>
          <button type="button" className={`${control} flex items-center gap-2`} onClick={refresh} disabled={pending}><RefreshCw aria-hidden="true" className="w-4 h-4" />期間データを更新</button>
        </div>
      </div>
      <p className="text-sm text-white/70 mb-4">保存された利用記録を集計します。生成の成功回数や出力個数、プロジェクト数、打刻数とは異なります。記録のない利用やゲスト利用は含みません。</p>
      {pending && <p role="status" className="text-sm mb-4">期間内の利用統計を読み込み中です。</p>}
      {error && <div role="alert" className="text-sm mb-4"><p>{data ? '前回取得した同じ期間のデータを表示しています。' : ''}{error}</p><button type="button" className={`${control} mt-2`} onClick={refresh} disabled={pending}>期間データを再取得</button></div>}
      {exportError && <p role="alert" className="text-sm mb-4">{exportError}</p>}
      {data && <>
        <p className="text-sm text-white/70 mb-2">{data.label}：{date(data.since)} 〜 {date(data.until)}（終了日時を含みません・日本時間）</p>
        <p className="text-sm text-white/70 mb-4">比較対象：{date(data.previousSince)} 〜 {date(data.previousUntil)}。同じ長さの直前期間です。CSVは以下と同じ取得結果を保存します。</p>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {data.metrics.filter(metric => !metric.id.includes(':')).map(metric => <div key={metric.id} className="p-4 rounded-lg bg-white/5">
            <h3 className="text-sm text-white/70">{metric.label}</h3>
            <p className="text-2xl font-bold mt-2">{metric.value!.toLocaleString()}{metric.unit}</p>
            <p className="text-sm text-white/70 mt-2">直前期間：{metric.previousValue!.toLocaleString()}{metric.unit}</p>
          </div>)}
        </div>
        <details className="mb-4">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2">{period === 'year' ? '月別' : '日別'}の利用記録を見る</summary>
          <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left text-white/70 mb-2">日本時間。最初と最後の区間は一部期間になる場合があります。</caption><thead><tr><th scope="col" className="text-left p-2">日付</th><th scope="col" className="text-right p-2">利用記録</th><th scope="col" className="text-right p-2">区間</th></tr></thead><tbody>{data.chart.buckets.map(bucket => <tr key={bucket.since}><th scope="row" className="text-left p-2 font-normal">{bucket.label}</th><td className="text-right p-2">{bucket.value.toLocaleString()}件</td><td className="text-right p-2">{bucket.partial ? '一部期間' : '全期間'}</td></tr>)}</tbody></table></div>
        </details>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2">サービス別の利用記録を見る</summary>
          <p className="text-sm text-white/70 mb-2">共通の利用記録に保存された件数です。0件でも、そのサービス自体が利用されていないとは限りません。</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th scope="col" className="text-left p-2">サービス</th><th scope="col" className="text-right p-2">選択期間</th><th scope="col" className="text-right p-2">直前期間</th></tr></thead><tbody>{data.metrics.filter(metric => metric.id.startsWith('records:')).map(metric => <tr key={metric.id}><th scope="row" className="text-left p-2 font-normal">{metric.serviceName}</th><td className="text-right p-2 whitespace-nowrap">{metric.value!.toLocaleString()}件</td><td className="text-right p-2 whitespace-nowrap">{metric.previousValue!.toLocaleString()}件</td></tr>)}</tbody></table></div>
        </details>
      </>}
    </section>
  )
}
