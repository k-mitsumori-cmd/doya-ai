import type { Schedule } from './types'
import { EmptyState, ErrorBox, Loading, StatusBadge, fmtMonthDay, formatYen } from './ui'

type PaymentRead = {
  data: { schedules: Schedule[] } | null
  loading: boolean
  error: string | null
  forbidden: boolean
  reload: () => void
}

/** Only a successful read for every required month proves that no payment is due. */
export default function UpcomingPayments({ today, limit, thisMonth, nextMonth }: {
  today: string
  limit: string
  thisMonth: PaymentRead
  nextMonth: PaymentRead
}) {
  const required = [{ label: '今月', read: thisMonth }, ...(limit.slice(0, 7) !== today.slice(0, 7) ? [{ label: '翌月', read: nextMonth }] : [])]
  const failed = required.filter(({ read }) => read.error || !read.loading && !read.data)
  const loading = required.some(({ read }) => read.loading)
  const rows = required.flatMap(({ read }) => read.error || read.loading ? [] : read.data?.schedules ?? [])
    .filter(s => s.status !== 'paid' && s.status !== 'skipped' && s.plannedPayDate >= today && s.plannedPayDate <= limit)
    .sort((a, b) => a.plannedPayDate.localeCompare(b.plannedPayDate))
  return (
    <>
      {failed.map(({ label, read }) => <div key={label}><p className="mb-2 text-sm font-medium text-[var(--sub)]">{label}の支払予定を確認できません。</p><ErrorBox forbidden={read.forbidden} onRetry={read.reload} /></div>)}
      {loading && <Loading rows={2} />}
      {!failed.length && !loading && rows.length === 0 && <EmptyState image="/expense/empty-calendar.webp" text="今後14日に払う予定はありません。" />}
      {rows.length > 0 && (
        <ul className="divide-y divide-[var(--line)]">
          {rows.map(u => (
            <li key={u.id} className="flex items-center gap-3 py-2">
              <span className="w-12 text-sm font-bold text-[var(--sub)]">{fmtMonthDay(u.plannedPayDate)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{u.title}</span>
              <StatusBadge status={u.status} />
              <span className="w-28 text-right text-sm font-bold text-[var(--ink)]">{formatYen(u.netPayAmount)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
