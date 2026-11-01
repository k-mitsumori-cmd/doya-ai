// 実行: npm run test:income
// 金額・日付の計算（設計書 §10.3）。ここがずれると請求額・期日がずれる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addMonths, closingDateFor, dueDateFor, describePaymentTerms, todayJst, isYmd } from './dates'
import { buildSchedule, type ScheduleInput } from './schedule'
import { computeInvoiceTotals } from './tax'
import { normalizePayerName, suggestMatches } from './matching'

const EOM = { closingDay: 31, paymentMonths: 1, paymentDay: 31 }

test('日付: 月の足し算は末日に丸める', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29')
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15')
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28')
})

test('日付: 形式チェック', () => {
  assert.equal(isYmd('2026-02-29'), false)
  assert.equal(isYmd('2028-02-29'), true)
  assert.equal(isYmd('2026-13-01'), false)
})

test('日付: JST の今日（UTC 15:00 以降は翌日）', () => {
  assert.equal(todayJst(new Date('2026-10-17T14:59:00Z')), '2026-10-17')
  assert.equal(todayJst(new Date('2026-10-17T15:00:00Z')), '2026-10-18')
})

test('支払期日: 月末締め翌月末払い', () => {
  assert.equal(dueDateFor('2026-10-31', EOM), '2026-11-30')
  assert.equal(dueDateFor('2026-01-31', EOM), '2026-02-28')
  assert.equal(dueDateFor('2027-12-31', EOM), '2028-01-31')
  assert.equal(dueDateFor('2028-01-15', EOM), '2028-02-29')
})

test('支払期日: 20日締め翌月10日払い', () => {
  const t = { closingDay: 20, paymentMonths: 1, paymentDay: 10 }
  assert.equal(closingDateFor('2026-10-20', 20), '2026-10-20')
  assert.equal(closingDateFor('2026-10-21', 20), '2026-11-20')
  assert.equal(dueDateFor('2026-10-05', t), '2026-11-10')
  assert.equal(dueDateFor('2026-10-25', t), '2026-12-10')
})

test('支払期日: 31日指定は30日の月で末日', () => {
  assert.equal(dueDateFor('2026-08-31', EOM), '2026-09-30')
})

test('支払期日: 当月払いで支払日が締めより前なら翌月', () => {
  assert.equal(dueDateFor('2026-10-25', { closingDay: 20, paymentMonths: 0, paymentDay: 10 }), '2026-12-10')
  assert.equal(dueDateFor('2026-10-15', { closingDay: 31, paymentMonths: 0, paymentDay: 31 }), '2026-10-31')
})

test('支払条件の表示', () => {
  assert.equal(describePaymentTerms(EOM), '月末締め 翌月末払い')
  assert.equal(describePaymentTerms({ closingDay: 20, paymentMonths: 1, paymentDay: 10 }), '20日締め 翌月10日払い')
})

const base: ScheduleInput = {
  type: 'recurring', startDate: '2026-11-01', endDate: '2027-10-31', autoRenew: false,
  billingCycle: 'monthly', issueTiming: 'arrears', prorate: 'none', amountExclTax: 300_000,
}

test('売上予定: 1年契約・月払い・後払いで12行、請求予定日は各月末', () => {
  const rows = buildSchedule(base, '2030-12-31')
  assert.equal(rows.length, 12)
  assert.deepEqual(rows[0], { period: '2026-11-01', plannedIssueDate: '2026-11-30', amountExclTax: 300_000 })
  assert.equal(rows[3].plannedIssueDate, '2027-02-28')
  assert.equal(rows[11].period, '2027-10-01')
})

test('売上予定: 前払いは前月末が請求予定日', () => {
  const rows = buildSchedule({ ...base, issueTiming: 'advance' }, '2030-12-31')
  assert.equal(rows[0].plannedIssueDate, '2026-10-31')
  assert.equal(rows[1].plannedIssueDate, '2026-11-30')
})

test('売上予定: 月途中開始の日割り（初月と最終月）', () => {
  const rows = buildSchedule({ ...base, startDate: '2026-11-16', endDate: '2027-01-10', prorate: 'daily' }, '2030-12-31')
  assert.equal(rows.length, 3)
  assert.equal(rows[0].amountExclTax, Math.floor((300_000 * 15) / 30)) // 11/16-11/30
  assert.equal(rows[1].amountExclTax, 300_000)
  assert.equal(rows[2].amountExclTax, Math.floor((300_000 * 10) / 31)) // 1/1-1/10
})

test('売上予定: 日割りなしなら初月から満額', () => {
  const rows = buildSchedule({ ...base, startDate: '2026-11-16' }, '2030-12-31')
  assert.equal(rows[0].amountExclTax, 300_000)
})

test('売上予定: 期間の定めなし・自動更新は horizon まで', () => {
  assert.equal(buildSchedule({ ...base, endDate: null }, '2027-04-30').length, 6)
  assert.equal(buildSchedule({ ...base, autoRenew: true }, '2028-04-30').length, 18)
})

test('売上予定: 四半期・年払い', () => {
  const q = buildSchedule({ ...base, billingCycle: 'quarterly' }, '2030-12-31')
  assert.deepEqual(q.map((r) => r.period), ['2026-11-01', '2027-02-01', '2027-05-01', '2027-08-01'])
  assert.equal(q[0].plannedIssueDate, '2027-01-31')
  const y = buildSchedule({ ...base, billingCycle: 'yearly', endDate: '2028-10-31' }, '2030-12-31')
  assert.deepEqual(y.map((r) => r.period), ['2026-11-01', '2027-11-01'])
})

test('売上予定: 単発', () => {
  const rows = buildSchedule({ ...base, type: 'one_time', startDate: '2026-12-10' }, '2030-12-31')
  assert.deepEqual(rows, [{ period: '2026-12-01', plannedIssueDate: '2026-12-31', amountExclTax: 300_000 }])
})

test('売上予定: 不正な入力は拒否', () => {
  assert.throws(() => buildSchedule({ ...base, amountExclTax: 1.5 }, '2030-12-31'))
  assert.throws(() => buildSchedule({ ...base, endDate: '2026-10-01' }, '2030-12-31'))
})

test('税: 10% と 8% の混在は税率ごとに1回だけ切り捨て', () => {
  // 明細ごとに丸めると 33+33+33=99 になるが、税率ごとにまとめると 333*3=999 → 99.9 → 99。
  const t = computeInvoiceTotals([
    { quantity: 1, unitPrice: 333, taxRate: 10 },
    { quantity: 1, unitPrice: 333, taxRate: 10 },
    { quantity: 1, unitPrice: 335, taxRate: 10 },
    { quantity: 3, unitPrice: 105, taxRate: 8 },
  ])
  assert.equal(t.subtotalExclTax, 1001 + 315)
  assert.deepEqual(t.taxBreakdown, [{ rate: 10, base: 1001, tax: 100 }, { rate: 8, base: 315, tax: 25 }])
  assert.equal(t.taxAmount, 125)
  assert.equal(t.totalInclTax, 1441)
})

test('税: 値引き行（負の単価）は許すが合計マイナスは拒否', () => {
  const t = computeInvoiceTotals([{ quantity: 1, unitPrice: 100_000, taxRate: 10 }, { quantity: 1, unitPrice: -10_000, taxRate: 10 }])
  assert.equal(t.totalInclTax, 99_000)
  assert.throws(() => computeInvoiceTotals([{ quantity: 1, unitPrice: -1, taxRate: 10 }]))
  assert.throws(() => computeInvoiceTotals([{ quantity: 1, unitPrice: 100, taxRate: 5 }]))
})

test('照合: 振込名義の正規化', () => {
  assert.equal(normalizePayerName('ｶ)ｻﾝﾌﾟﾙｼｮｳｼﾞ'), 'サンプルショウジ')
  assert.equal(normalizePayerName('ｻﾝﾌﾟﾙｼｮｳｼﾞ(ｶ'), 'サンプルショウジ')
  assert.equal(normalizePayerName('株式会社 サンプル'), 'サンプル')
  assert.equal(normalizePayerName('さんぷる しょうじ'), 'サンプルショウジ')
})

test('照合: 金額と名義の一致が最上位、手数料差引も候補', () => {
  const invoices = [
    { id: 'a', invoiceNo: 'INV-2026-0001', clientName: '株式会社サンプル商事', payerNameKana: 'サンプルショウジ', remaining: 330_000, dueDate: '2026-11-30' },
    { id: 'b', invoiceNo: 'INV-2026-0002', clientName: '別会社', payerNameKana: 'ベツガイシャ', remaining: 330_000, dueDate: '2026-11-30' },
  ]
  const exact = suggestMatches({ amount: 330_000, payerName: 'ｶ)ｻﾝﾌﾟﾙｼｮｳｼﾞ' }, invoices)
  assert.equal(exact[0].invoiceId, 'a')
  assert.equal(exact[0].score, 100)
  assert.equal(exact[1].invoiceId, 'b')
  const fee = suggestMatches({ amount: 329_340, payerName: 'ｻﾝﾌﾟﾙｼｮｳｼﾞ' }, invoices)
  assert.equal(fee[0].invoiceId, 'a')
  assert.equal(fee[0].score, 80)
})
