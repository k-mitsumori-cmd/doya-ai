// ============================================
// 経営ホームの「今日やること」（UI 品質 S-10）
// ============================================
// 集計（HomeSummary）から、今日手を付けたほうがよいものだけを並べる。数字が0のものは出さない。
// ⚠️ 新しい数字は取らない。getHomeSummary() がすでに読んだ値だけを使う。
import type { HomeSummary } from '@/lib/home/summary'

export interface TodayItem {
  key: string
  label: string
  href: string
  /** 急ぎ（期日を過ぎた・今日まで） */
  urgent?: boolean
  /** 開くツールの id（行の左にクマの絵を出す） */
  tool: string
}

const EVENT_TOOL: Record<HomeSummary['events'][number]['kind'], string> = { deal: 'sfa', task: 'sfa', project: 'promane', quote: 'quote' }

const DAY = 24 * 3600_000

/** JST の日付（YYYY-MM-DD） */
function jstDay(t: number): string {
  return new Date(t + 9 * 3600_000).toISOString().slice(0, 10)
}

export function todayItems(s: HomeSummary, now: number = Date.now()): TodayItem[] {
  const items: TodayItem[] = []
  if (s.sales.state === 'ready' && s.sales.overdueTasks > 0) {
    items.push({ key: 'overdue', label: `期日を過ぎたタスクが ${s.sales.overdueTasks}件あります`, href: `${s.sales.href}/tasks`, urgent: true, tool: 'sfa' })
  }
  if (s.attendance.state === 'ready' && s.attendance.scope === 'org' && s.attendance.pendingRequests > 0) {
    items.push({ key: 'approvals', label: `承認を待っている勤怠の申請が ${s.attendance.pendingRequests}件あります`, href: '/kintai/approvals', tool: 'kintai' })
  }
  // 今日と明日の予定（受注予定・タスクの期日・納期・見積の有効期限）
  const today = jstDay(now)
  const tomorrow = jstDay(now + DAY)
  for (const e of s.events) {
    const t = Date.parse(e.date)
    if (!Number.isFinite(t)) continue
    const d = jstDay(t)
    if (d !== today && d !== tomorrow) continue
    items.push({ key: `event:${e.id}`, label: `${d === today ? '今日' : '明日'}: ${e.title}`, href: e.href, urgent: d === today, tool: EVENT_TOOL[e.kind] ?? 'sfa' })
  }
  if (s.quotes.state === 'ready' && s.quotes.draftCount > 0) {
    items.push({ key: 'drafts', label: `下書きのままの見積が ${s.quotes.draftCount}件あります`, href: s.quotes.href, tool: 'quote' })
  }
  // 急ぎを先に（並びは保つ）
  return [...items.filter((i) => i.urgent), ...items.filter((i) => !i.urgent)].slice(0, 6)
}
