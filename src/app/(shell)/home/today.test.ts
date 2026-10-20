// 実行: npx tsx --test "src/app/(shell)/home/today.test.ts"
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { HomeSummary } from '@/lib/home/summary'
import { todayItems } from './today'

const base = (over: Partial<HomeSummary> = {}): HomeSummary => ({
  generatedAt: '', sources: { revenue: 'sfa_quote', cost: 'promane' }, user: { name: null, email: null },
  contract: { tier: 'FREE', label: '', paid: false, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
  sales: { state: 'ready', href: '/sfa/a', wonThisMonth: 0, wonCountThisMonth: 0, openPipeline: 0, weightedPipeline: 0, openDeals: 0, stages: [], openTasks: 0, overdueTasks: 0, newLeads: 0 },
  quotes: { state: 'ready', href: '/quote', confirmedThisMonth: 0, draftCount: 0, sentCount: 0 },
  projects: { state: 'empty', href: '/promane', activeProjects: 0, revenue: 0, cost: 0, profit: 0, openTasks: 0, top: [] },
  attendance: { state: 'ready', href: '/kintai/dashboard', scope: 'self', workHoursThisMonth: 0, overtimeHoursThisMonth: 0, pendingRequests: 3, employees: 1 },
  people: { state: 'empty', href: '/hr/dashboard', activeEmployees: 0, departments: 0 },
  trend: [], events: [], ...over,
} as HomeSummary)

// 2026-10-19 10:00 JST
const NOW = Date.parse('2026-10-19T01:00:00Z')

test('何も無ければ空', () => {
  assert.deepEqual(todayItems(base(), NOW), [])
})

test('期日切れ・承認待ち（組織の管理者だけ）・下書きを出す', () => {
  const s = base({ sales: { ...base().sales, overdueTasks: 2 }, attendance: { ...base().attendance, scope: 'org' }, quotes: { ...base().quotes, draftCount: 1 } })
  assert.deepEqual(todayItems(s, NOW).map((i) => i.key), ['overdue', 'approvals', 'drafts'])
  assert.equal(todayItems(s, NOW)[0].href, '/sfa/a/tasks')
})

test('予定は今日と明日（JST）だけ', () => {
  const ev = (id: string, date: string) => ({ id, date, title: id, kind: 'task' as const, href: '/x' })
  const s = base({ events: [ev('today', '2026-10-19T14:00:00Z'), ev('tomorrow', '2026-10-20T03:00:00Z'), ev('later', '2026-10-21T03:00:00Z'), ev('bad', 'x')] })
  const items = todayItems(s, NOW)
  assert.deepEqual(items.map((i) => i.label), ['今日: today', '明日: tomorrow'])
  assert.equal(items[0].urgent, true)
})

test('現在時刻ではなく取得時刻を使って今日を決める', () => {
  const s = base({
    generatedAt: '2026-10-31T14:59:59Z',
    events: [{ id: 'edge', date: '2026-10-31T15:00:00Z', title: '翌月の予定', kind: 'task', href: '/x' }],
  })
  assert.deepEqual(todayItems(s).map((item) => item.label), ['明日: 翌月の予定'])
})

test('日時が無効でも日付に依存しないタスクは残す', () => {
  const s = base({
    generatedAt: 'invalid',
    quotes: { ...base().quotes, draftCount: 1 },
    events: [{ id: 'event', date: '2026-10-20T06:00:00Z', title: '予定', kind: 'task', href: '/x' }],
  })
  assert.deepEqual(todayItems(s).map((item) => item.key), ['drafts'])
  assert.deepEqual(todayItems(s, null).map((item) => item.key), ['drafts'])
  assert.deepEqual(todayItems({ ...s, generatedAt: '2026-10-20T15:24:00' }).map((item) => item.key), ['drafts'])
})

test('予定のタイムゾーンなし日時を除き、日付だけの意味は維持する', () => {
  const event = (id: string, date: string) => ({ id, date, title: id, kind: 'task' as const, href: '/x' })
  const s = base({
    generatedAt: '2026-10-20T06:00:00Z',
    events: [event('date-only', '2026-10-20'), event('implicit', '2026-10-20T18:00:00'), event('offset', '2026-10-20T18:00:00+09:00')],
  })
  assert.deepEqual(todayItems(s).map((item) => item.label), ['今日: date-only', '今日: offset'])
})
