// ============================================
// 請求漏れ0の月（純粋関数）
// ============================================
// 収入管理の売上予定（income_revenue_schedules）から、「請求漏れが無かった月」を出す。
// - その月に請求予定日（plannedIssueDate）がある予定が1件以上ある
// - その全部が planned ではない（invoiced = 請求済み、skipped = 見送り）
// - 月が締まっている（今月はまだ数えない。月の途中で「0件」と出さないため）
// ⚠️ 月の区切りは日本時間。plannedIssueDate は @db.Date（日付だけ）なので UTC の日付をそのまま使う。

export interface ScheduleRow {
  plannedIssueDate: Date | string
  status: string
}

function monthKeyOfDate(d: Date | string): string {
  const iso = typeof d === 'string' ? d : d.toISOString()
  return iso.slice(0, 7)
}

/** 日本時間での今月（YYYY-MM） */
export function jstMonthKey(now: Date): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7)
}

export function cleanBillingMonths(rows: ScheduleRow[], now: Date): string[] {
  const current = jstMonthKey(now)
  const byMonth = new Map<string, { total: number; open: number }>()
  for (const r of rows) {
    const m = monthKeyOfDate(r.plannedIssueDate)
    if (m >= current) continue
    const e = byMonth.get(m) ?? { total: 0, open: 0 }
    e.total += 1
    if (r.status === 'planned') e.open += 1
    byMonth.set(m, e)
  }
  return [...byMonth.entries()].filter(([, e]) => e.total > 0 && e.open === 0).map(([m]) => m).sort()
}
