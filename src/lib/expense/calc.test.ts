// 実行: npm run test:expense
// 設計書 §10.3「検証スクリプトで必ず押さえる計算」をすべて確かめる。ここが間違うと金額がずれる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { payDateFor, addDays, diffDays, todayJst } from './dates'
import { withholdingFor, remittanceBucket } from './withholding'
import { occurrenceMonths, planContract, priceAt, resolvePayTerms, splitTax, FxRateMissingError, type ContractInput } from './plan'
import { monthlyExpenses, cashOutEvents, forecastByPayMonth, scheduleActionItems, contractAlerts, calendarEvents, type ScheduleRowLike } from './aggregate'

// ---------- 出金日 ----------
test('月末締め翌月末払い', () => {
  const t = { closingDay: 31, months: 1, payDay: 31 }
  assert.equal(payDateFor('2026-10-20', t), '2026-11-30')
  assert.equal(payDateFor('2026-10-31', t), '2026-11-30')
  assert.equal(payDateFor('2026-01-15', t), '2026-02-28')
})

test('20日締め翌月10日払い（締め日の前後）', () => {
  const t = { closingDay: 20, months: 1, payDay: 10 }
  assert.equal(payDateFor('2026-10-20', t), '2026-11-10')
  assert.equal(payDateFor('2026-10-21', t), '2026-12-10')
})

test('カード 15日締め翌月10日引落', () => {
  const t = resolvePayTerms({ type: 'card', closingDay: 15, withdrawalMonths: 1, withdrawalDay: 10 }, { closingDay: 31, paymentMonths: 1, paymentDay: 31 })
  assert.equal(payDateFor('2026-10-15', t), '2026-11-10')
  assert.equal(payDateFor('2026-10-20', t), '2026-12-10')
})

test('2月末・うるう年、31日指定で30日の月', () => {
  const t = { closingDay: 31, months: 1, payDay: 31 }
  assert.equal(payDateFor('2028-01-10', t), '2028-02-29')
  assert.equal(payDateFor('2026-08-31', t), '2026-09-30')
  assert.equal(payDateFor('2026-12-31', t), '2027-01-31')
})

test('口座振替は発生月の引落日（過ぎていれば翌月）', () => {
  const t = resolvePayTerms({ type: 'debit', closingDay: null, withdrawalMonths: null, withdrawalDay: 27 }, { closingDay: 31, paymentMonths: 1, paymentDay: 31 })
  assert.equal(payDateFor('2026-10-05', t), '2026-10-27')
  assert.equal(payDateFor('2026-10-28', t), '2026-11-27')
})

test('日付の補助関数', () => {
  assert.equal(addDays('2026-12-30', 5), '2027-01-04')
  assert.equal(diffDays('2026-10-18', '2026-10-23'), 5)
  assert.equal(todayJst(new Date('2026-10-17T15:30:00Z')), '2026-10-18')
})

// ---------- 支払予定 ----------
const base = (over: Partial<ContractInput> = {}): ContractInput => ({
  billingModel: 'fixed', frequencyMonths: 1, anchorDate: '2026-04-01', startDate: '2026-04-01', endDate: null,
  autoRenew: false, status: 'active', currency: 'JPY', withholding: false, forecastMode: 'planned',
  prices: [{ effectiveFrom: '2026-04-01', unitPrice: 300_000, quantity: 1, capQuantity: null, taxRate: 10, taxIncluded: false }],
  ...over,
})
const ctx = (over: Partial<Parameters<typeof planContract>[1]> = {}) => ({
  fromYm: '2026-10', toYm: '2027-09', terms: { closingDay: 31, months: 1, payDay: 31 }, fxRate: () => 150, recentActuals: [], ...over,
})

test('周期: 毎月・四半期・半年・年払い', () => {
  assert.equal(occurrenceMonths(base(), '2026-10', '2027-09').length, 12)
  assert.deepEqual(occurrenceMonths(base({ frequencyMonths: 3 }), '2026-10', '2027-09'), ['2026-10', '2027-01', '2027-04', '2027-07'])
  assert.deepEqual(occurrenceMonths(base({ frequencyMonths: 6 }), '2026-10', '2027-09'), ['2026-10', '2027-04'])
  assert.deepEqual(occurrenceMonths(base({ frequencyMonths: 12, anchorDate: '2025-11-15' }), '2026-10', '2027-09'), ['2026-11'])
})

test('周期: 月途中の開始・終了日・自動更新・停止・単発', () => {
  assert.deepEqual(occurrenceMonths(base({ startDate: '2026-12-10', anchorDate: '2026-12-10' }), '2026-10', '2027-01'), ['2026-12', '2027-01'])
  assert.deepEqual(occurrenceMonths(base({ endDate: '2026-11-30' }), '2026-10', '2027-09'), ['2026-10', '2026-11'])
  assert.equal(occurrenceMonths(base({ endDate: '2026-11-30', autoRenew: true }), '2026-10', '2027-09').length, 12)
  assert.deepEqual(occurrenceMonths(base({ status: 'paused' }), '2026-10', '2027-09'), [])
  assert.deepEqual(occurrenceMonths(base({ frequencyMonths: 0, anchorDate: '2026-12-01' }), '2026-10', '2027-09'), ['2026-12'])
  assert.deepEqual(occurrenceMonths(base({ frequencyMonths: 0, anchorDate: '2026-05-01' }), '2026-10', '2027-09'), [])
})

test('月途中開始の初回は開始日を発生日にする', () => {
  const rows = planContract(base({ startDate: '2026-10-20', anchorDate: '2026-10-01' }), ctx({ toYm: '2026-11' }))
  assert.equal(rows[0].eventDate, '2026-10-20')
  assert.equal(rows[1].eventDate, '2026-11-01')
})

test('値上げ（effectiveFrom）と席数の変更', () => {
  const c = base({
    billingModel: 'per_seat',
    prices: [
      { effectiveFrom: '2026-04-01', unitPrice: 1_600, quantity: 5, capQuantity: null, taxRate: 10, taxIncluded: false },
      { effectiveFrom: '2026-12-01', unitPrice: 1_800, quantity: 8, capQuantity: null, taxRate: 10, taxIncluded: false },
    ],
  })
  const rows = planContract(c, ctx({ toYm: '2027-01' }))
  assert.deepEqual(rows.map((r) => r.amountExclTax), [8_000, 8_000, 14_400, 14_400])
  assert.equal(priceAt(c.prices, '2026-11')?.unitPrice, 1_600)
})

test('税込単価の分解と外税の計算（切り捨て）', () => {
  assert.deepEqual(splitTax(11_000, 10, true), { exclTax: 10_000, tax: 1_000 })
  assert.deepEqual(splitTax(1_234, 10, true), { exclTax: 1_122, tax: 112 })
  assert.deepEqual(splitTax(1_234, 10, false), { exclTax: 1_234, tax: 123 })
})

test('時給×稼働: avg3（実績0〜2か月）と cap', () => {
  const c = base({ billingModel: 'hourly', forecastMode: 'avg3', prices: [{ effectiveFrom: '2026-04-01', unitPrice: 4_000, quantity: 100, capQuantity: 120, taxRate: 10, taxIncluded: false }] })
  assert.equal(planContract(c, ctx({ toYm: '2026-10' }))[0].amountExclTax, 400_000) // 実績なし → 予定数量
  assert.equal(planContract(c, ctx({ toYm: '2026-10', recentActuals: [500_000] }))[0].amountExclTax, 500_000)
  assert.equal(planContract(c, ctx({ toYm: '2026-10', recentActuals: [500_000, 400_001] }))[0].amountExclTax, 450_000)
  assert.equal(planContract(c, ctx({ toYm: '2026-10', recentActuals: [300_000, 300_000, 300_000, 900_000] }))[0].amountExclTax, 300_000)
  const cap = planContract({ ...c, forecastMode: 'cap' }, ctx({ toYm: '2026-10', recentActuals: [100] }))[0]
  assert.equal(cap.amountExclTax, 480_000)
  assert.equal(cap.estimated, true)
})

test('成果物ごと: 単価×予定本数', () => {
  const c = base({ billingModel: 'per_deliverable', prices: [{ effectiveFrom: '2026-04-01', unitPrice: 30_000, quantity: 3, capQuantity: null, taxRate: 10, taxIncluded: false }] })
  assert.equal(planContract(c, ctx({ toYm: '2026-10' }))[0].amountExclTax, 90_000)
})

test('USD の円換算とレート未設定', () => {
  const c = base({ currency: 'USD', prices: [{ effectiveFrom: '2026-04-01', unitPrice: 2_000, quantity: 3, capQuantity: null, taxRate: 0, taxIncluded: false }] })
  const r = planContract(c, ctx({ toYm: '2026-10', fxRate: () => 151.25 }))[0]
  assert.equal(r.amountExclTax, 9_075) // $60 × 151.25
  assert.equal(r.estimated, true)
  assert.throws(() => planContract(c, ctx({ toYm: '2026-10', fxRate: () => null })), FxRateMissingError)
})

// ---------- 源泉 ----------
test('源泉: 30万円・100万円ちょうど・150万円', () => {
  assert.equal(withholdingFor(300_000), 30_630)
  assert.equal(withholdingFor(1_000_000), 102_100)
  assert.equal(withholdingFor(1_500_000), 102_100 + 102_100)
  assert.equal(withholdingFor(0), 0)
})

test('源泉ありの業務委託: 振込額は税込−源泉（税抜基準）', () => {
  const r = planContract(base({ withholding: true }), ctx({ toYm: '2026-10' }))[0]
  assert.equal(r.amountExclTax, 300_000)
  assert.equal(r.taxAmount, 30_000)
  assert.equal(r.withholdingAmount, 30_630)
  assert.equal(r.netPayAmount, 299_370)
  assert.equal(r.plannedPayDate, '2026-11-30')
})

test('源泉の納付: 毎月・納期の特例の境目・年またぎ', () => {
  assert.deepEqual(remittanceBucket('2026-11-30', 'monthly'), { period: '2026-11-01', dueDate: '2026-12-10', label: '源泉所得税 2026年11月支払分' })
  assert.equal(remittanceBucket('2026-12-31', 'monthly').dueDate, '2027-01-10')
  assert.equal(remittanceBucket('2026-06-30', 'special').dueDate, '2026-07-10')
  assert.equal(remittanceBucket('2026-07-01', 'special').dueDate, '2027-01-20')
  assert.equal(remittanceBucket('2026-07-01', 'special').period, '2026-07-01')
})

// ---------- 集計 ----------
const row = (over: Partial<ScheduleRowLike>): ScheduleRowLike => ({
  id: 'r', kind: 'contract', title: 'x', category: 'saas', period: '2026-10-01', plannedPayDate: '2026-11-10',
  plannedAmountExclTax: 10_000, amountExclTax: 10_000, taxAmount: 1_000, withholdingAmount: 0, netPayAmount: 11_000,
  status: 'planned', paidOn: null, paidAmount: null, estimated: false, contractId: 'c', ...over,
})

test('monthly: 源泉税を二重に数えない・業務委託は人件費・skip は除外', () => {
  const rows = [
    row({ category: 'contractor', amountExclTax: 300_000, withholdingAmount: 30_630, netPayAmount: 299_370, status: 'paid' }),
    row({ kind: 'withholding_tax', category: 'withholding_tax', amountExclTax: 30_630, netPayAmount: 30_630, contractId: null }),
    row({ amountExclTax: 12_800 }),
    row({ amountExclTax: 99_999, status: 'skipped' }),
  ]
  const [oct] = monthlyExpenses(rows, '2026-10', '2026-10')
  assert.equal(oct.laborCost, 300_000)
  assert.equal(oct.expense, 12_800)
  assert.equal(oct.total, 312_800)
  assert.equal(oct.confirmed, 300_000)
  assert.equal(oct.planned, 12_800)
})

test('cashOut: 源泉税の納付を含め、支払済みは実額と支払日', () => {
  const rows = [
    row({ category: 'contractor', netPayAmount: 299_370, plannedPayDate: '2026-11-30', status: 'paid', paidOn: '2026-11-28', paidAmount: 299_000 }),
    row({ kind: 'withholding_tax', title: '源泉', netPayAmount: 30_630, plannedPayDate: '2026-12-10', contractId: null }),
    row({ status: 'skipped' }),
  ]
  const ev = cashOutEvents(rows, '2026-11-01', '2026-12-31')
  assert.deepEqual(ev.map((e) => [e.date, e.amount, e.status, e.category]), [
    ['2026-11-28', 299_000, 'paid', 'contractor'],
    ['2026-12-10', 30_630, 'planned', 'withholding_tax'],
  ])
})

test('予測: 出金月でまとめ、予定分を見込みとして区別する', () => {
  const m = forecastByPayMonth([row({}), row({ status: 'billed', plannedPayDate: '2026-11-30' }), row({ plannedPayDate: '2027-02-01' })], '2026-11', '2026-12')
  assert.equal(m.totals['2026-11'].amount, 22_000)
  assert.equal(m.totals['2026-11'].estimated, 11_000)
  assert.equal(m.totals['2026-12'].amount, 0)
})

test('要対応: 請求書待ち・支払遅延・金額差異・源泉の納付', () => {
  const items = scheduleActionItems([
    row({ id: 'a', plannedPayDate: '2026-10-22' }),
    row({ id: 'b', plannedPayDate: '2026-10-30' }),
    row({ id: 'c', plannedPayDate: '2026-10-15', status: 'approved' }),
    row({ id: 'd', plannedPayDate: '2026-11-30', status: 'billed', amountExclTax: 560_000, plannedAmountExclTax: 480_000 }),
    row({ id: 'e', kind: 'withholding_tax', plannedPayDate: '2026-10-20', contractId: null }),
    row({ id: 'f', plannedPayDate: '2026-10-20', status: 'paid' }),
  ], '2026-10-18')
  assert.deepEqual(items.map((i) => [i.scheduleId, i.kind]), [['c', 'overdue'], ['e', 'withholding_due'], ['a', 'bill_missing'], ['d', 'amount_diff']])
})

test('契約の通知: 自動更新の期限と業務委託の終了', () => {
  const a = contractAlerts([
    { id: '1', title: 'Notion', endDate: '2026-11-01', autoRenew: true, renewalNoticeDays: 14, status: 'active', category: 'saas' },
    { id: '2', title: 'Dさん', endDate: '2026-11-15', autoRenew: false, renewalNoticeDays: 30, status: 'active', category: 'contractor' },
    { id: '3', title: '遠い', endDate: '2027-11-15', autoRenew: true, renewalNoticeDays: 30, status: 'active', category: 'saas' },
  ], '2026-10-18')
  assert.deepEqual(a.map((x) => [x.contractId, x.kind]), [['1', 'renewal'], ['2', 'contract_end']])
})

// ---------- 読み取り（listCalendarEvents の中身） ----------
test('カレンダー: 支払日・源泉税の納付日・更新日・終了日を日付順に', () => {
  const ev = calendarEvents(
    [
      row({ id: 'p', title: 'Slack', plannedPayDate: '2026-11-10' }),
      row({ id: 'w', kind: 'withholding_tax', title: '源泉所得税', plannedPayDate: '2026-11-10', contractId: null }),
      row({ id: 'd', title: '支払済み', plannedPayDate: '2026-11-30', status: 'paid', paidOn: '2026-11-05', paidAmount: 5_000 }),
      row({ id: 's', title: '発生なし', plannedPayDate: '2026-11-15', status: 'skipped' }),
      row({ id: 'o', title: '範囲外', plannedPayDate: '2026-12-15' }),
    ],
    [
      { id: 'c1', title: 'Notion', endDate: '2026-11-20', autoRenew: true, status: 'active' },
      { id: 'c2', title: 'Dさん', endDate: '2026-11-25', autoRenew: false, status: 'active' },
      { id: 'c3', title: '終了済み', endDate: '2026-11-25', autoRenew: false, status: 'ended' },
    ],
    '2026-11-01',
    '2026-11-30'
  )
  assert.deepEqual(ev.map((e) => [e.date, e.kind, e.targetId, e.amount]), [
    ['2026-11-05', 'payment', 'd', 5_000],
    ['2026-11-10', 'payment', 'p', 11_000],
    ['2026-11-10', 'withholding_tax', 'w', 11_000],
    ['2026-11-20', 'renewal', 'c1', null],
    ['2026-11-25', 'contract_end', 'c2', null],
  ])
})
