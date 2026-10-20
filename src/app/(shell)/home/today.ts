// ============================================
// 経営ホームの「今日やること」（UI 品質 S-10）
// ============================================
// 集計（HomeSummary）から、今日手を付けたほうがよいものだけを並べる。数字が0のものは出さない。
// ⚠️ 新しい数字は取らない。getHomeSummary() がすでに読んだ値だけを使う。
import type { HomeSummary } from '@/lib/home/summary'
import { homeJstDateKey, homeSnapshotEpoch } from './clock'

export interface TodayItem {
  key: string
  label: string
  href: string
  /** 急ぎ（期日を過ぎた・今日まで） */
  urgent?: boolean
}

const DAY = 24 * 3600_000

/** JST の日付（YYYY-MM-DD） */
function jstDay(t: number): string | null {
  const date = new Date(t + 9 * 3600_000)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null
}

export function todayItems(s: HomeSummary, now: number | null = homeSnapshotEpoch(s.generatedAt)): TodayItem[] {
  const items: TodayItem[] = []
  if (s.sales.state === 'ready' && s.sales.overdueTasks > 0) {
    items.push({ key: 'overdue', label: `期日を過ぎたタスクが ${s.sales.overdueTasks}件あります`, href: `${s.sales.href}/tasks`, urgent: true })
  }
  if (s.attendance.state === 'ready' && s.attendance.scope === 'org' && s.attendance.pendingRequests > 0) {
    items.push({ key: 'approvals', label: `承認を待っている勤怠の申請が ${s.attendance.pendingRequests}件あります`, href: '/kintai/approvals' })
  }
  // 今日と明日の予定（受注予定・タスクの期日・納期・見積の有効期限）
  const today = now !== null ? jstDay(now) : null
  const tomorrow = now !== null ? jstDay(now + DAY) : null
  for (const e of s.events) {
    if (!today || !tomorrow) break
    const d = homeJstDateKey(e.date)
    if (!d) continue
    if (d !== today && d !== tomorrow) continue
    items.push({ key: `event:${e.id}`, label: `${d === today ? '今日' : '明日'}: ${e.title}`, href: e.href, urgent: d === today })
  }
  if (s.quotes.state === 'ready' && s.quotes.draftCount > 0) {
    items.push({ key: 'drafts', label: `下書きのままの見積が ${s.quotes.draftCount}件あります`, href: s.quotes.href })
  }
  return items.slice(0, 6)
}
