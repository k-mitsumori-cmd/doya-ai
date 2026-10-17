// 実行: npm run test:income
// エージェントの道具・カレンダー・督促文面（ADDON-SERVICES D-5）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildCalendarEvents } from './calendar-events'
import { buildDunningDraft, dunningStage } from './dunning'
import { INCOME_AGENT_TOOLS } from './agent-tools'
import { INCOME_NAV, activeNavHref } from './nav'

test('道具: 名前・承認・冪等の規約（README §8.2）', () => {
  const keys = new Set<string>()
  for (const t of INCOME_AGENT_TOOLS) {
    assert.match(t.key, /^income\.[a-zA-Z]+$/)
    assert.match(t.providerName, /^[a-zA-Z0-9_-]{1,64}$/)
    assert.equal(t.providerName, t.key.replace('.', '__'))
    assert.ok(!keys.has(t.key)); keys.add(t.key)
    if (t.reversibility === 'irreversible') assert.equal(t.requiresApproval, true, `${t.key} は承認必須`)
    if (t.costClass === 'high') assert.equal(t.requiresApproval, true)
    if (t.reversibility !== 'read') assert.notEqual(t.downstreamIdempotency, 'none', `${t.key} は冪等の宣言が要る`)
  }
  // ADDON-SERVICES §5 の 4 本がそろっている
  for (const k of ['income.summary', 'income.draftInvoice', 'income.issueInvoice', 'income.draftDunning']) assert.ok(keys.has(k), k)
  assert.ok(INCOME_AGENT_TOOLS.some((t) => t.reversibility === 'read'))
})

test('道具: 入力は型で上限を固定する', () => {
  const draft = INCOME_AGENT_TOOLS.find((t) => t.key === 'income.draftInvoice')!
  assert.equal(draft.input.safeParse({ scheduleIds: Array.from({ length: 51 }, (_, i) => `s${i}`) }).success, false)
  assert.equal(draft.input.safeParse({ scheduleIds: [] }).success, false)
  assert.equal(draft.input.safeParse({ scheduleIds: ['a'], issueDate: '2026-13-01' }).success, false)
  const summary = INCOME_AGENT_TOOLS.find((t) => t.key === 'income.summary')!
  assert.equal(summary.input.safeParse({ month: '2026-11' }).success, true)
  assert.equal(summary.input.safeParse({ month: '2026-1' }).success, false)
})

test('カレンダー: 期間内の予定だけ・遅れの印・並び順', () => {
  const events = buildCalendarEvents(
    {
      schedules: [
        { id: 's1', plannedIssueDate: '2026-10-31', amountExclTax: 300000, clientName: 'A社', contractTitle: '保守', periodMonth: '2026-10' },
        { id: 's2', plannedIssueDate: '2026-12-31', amountExclTax: 300000, clientName: 'A社', contractTitle: '保守', periodMonth: '2026-12' },
      ],
      invoices: [
        { id: 'i1', invoiceNo: 'INV-2026-0001', dueDate: '2026-11-30', remaining: 330000, clientName: 'B社' },
        { id: 'i2', invoiceNo: 'INV-2026-0002', dueDate: '2026-11-10', remaining: 0, clientName: 'C社' },
      ],
      contracts: [
        { id: 'c1', title: '顧問', clientName: 'D社', endDate: '2027-03-31', autoRenew: true, renewalNoticeDays: 150 },
        { id: 'c2', title: '開発', clientName: 'E社', endDate: '2026-11-15', autoRenew: false, renewalNoticeDays: null },
      ],
    },
    '2026-10-01',
    '2026-11-30',
    '2026-11-05',
  )
  assert.deepEqual(events.map((e) => e.id), ['income:issue_due:s1', 'income:renewal_notice:c1', 'income:contract_end:c2', 'income:payment_due:i1'])
  assert.equal(events[0].late, true)
  // 2027-03-31 の 150 日前 = 2026-11-01
  assert.equal(events[1].date, '2026-11-01')
  assert.equal(events.find((e) => e.kind === 'payment_due')!.late, false)
})

test('督促: 段階と文面（敬語・絵文字なし・送付先の情報を含む）', () => {
  assert.equal(dunningStage('2026-11-30', '2026-11-30'), null)
  assert.equal(dunningStage('2026-11-30', '2026-12-14'), 1)
  assert.equal(dunningStage('2026-11-30', '2026-12-15'), 2)
  assert.equal(dunningStage('2026-11-30', '2026-12-31'), 3)
  const d = buildDunningDraft({
    clientName: '株式会社サンプル商事', contactName: '山田', invoiceNo: 'INV-2026-0001', issueDate: '2026-10-31', dueDate: '2026-11-30',
    remaining: 330000, issuerName: '株式会社ドヤ', issuerPerson: '佐藤', today: '2026-12-03',
  })!
  assert.equal(d.stage, 1)
  assert.match(d.subject, /INV-2026-0001/)
  assert.match(d.body, /山田 様/)
  assert.match(d.body, /330,000円/)
  assert.match(d.body, /2026年11月30日/)
  assert.doesNotMatch(d.subject + d.body, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
})

test('ナビ: データで持ち、今いる画面を 1 つだけ選ぶ', () => {
  assert.ok(INCOME_NAV.length >= 6)
  assert.equal(activeNavHref('/income'), '/income')
  assert.equal(activeNavHref('/income/invoices/abc'), '/income/invoices')
  assert.equal(activeNavHref('/income/revenue'), '/income/revenue')
})
