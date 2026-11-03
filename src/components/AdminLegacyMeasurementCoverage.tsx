import { adminLegacyMeasurementCoverage, adminLegacyServiceMeasurement } from '@/lib/admin-stats-measurement'

export default function AdminLegacyMeasurementCoverage({ legacyIds = [] }: { legacyIds?: readonly string[] }) {
  const services = adminLegacyMeasurementCoverage()
  const partial = services.filter(service => service.status === 'partial')
  const missing = services.filter(service => service.status === 'not-measured')
  const retired = legacyIds.map(adminLegacyServiceMeasurement).filter((service): service is NonNullable<ReturnType<typeof adminLegacyServiceMeasurement>> => service?.isRetired === true)
  return (
    <section aria-label="サービス別統計の対象" className="my-6 min-w-0 rounded-xl border border-white/10 bg-[#181818] p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-white">サービス別統計の対象</h2>
      <p className="mt-2 text-sm text-white/70">稼働中・内部利用の{services.length}サービスのうち、{partial.length}サービスの一部指標を集計しています。</p>
      <p className="mt-2 text-sm text-white/70">ここではサービス別の登録・保存件数を示します。項目名と単位で集計対象を確認できます。期間別の共通保存記録レポートとは集計範囲が異なります。</p>
      <details className="mt-3 text-sm text-white/70">
        <summary className="flex min-h-11 cursor-pointer items-center rounded px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400">集計対象外の{missing.length}サービスを確認</summary>
        <p className="mt-2">未集計は、サービス別の件数をまだ取得していない状態です。</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {missing.map(service => <li key={service.id}>{service.name}：未集計</li>)}
        </ul>
      </details>
      {retired.length > 0 && <p className="mt-3 text-sm text-white/70">参考値として、提供終了済みの{retired.length}サービスの保存件数も表示します。{retired.map(service => service.name).join('、')}</p>}
    </section>
  )
}
