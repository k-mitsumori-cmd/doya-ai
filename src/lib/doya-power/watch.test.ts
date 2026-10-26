// 自動点検（system-watch の B1）が減らした分を、内訳と履歴で「（自動点検）」と分けて出す（2026-10-26 ユーザー決定）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDoyaPowerLedger } from './ledger'
import { createMemoryDb } from './memory-db'
import { historyLabel } from './history-label'
import { usageBreakdown } from './breakdown'

function setup() {
  const clock = () => new Date('2026-10-26T03:00:00.000Z')
  const mem = createMemoryDb({ now: clock })
  mem.rows('accountCompany').push({ id: 'co_s', userId: 'u', name: '株式会社スリスタ' })
  return { mem, ledger: createDoyaPowerLedger(mem.db, { now: clock }) }
}

test('note に watch:1 のある消費とその戻しは、履歴で自動点検の印が付く。ほかは付かない', async () => {
  const { ledger } = setup()
  await ledger.grant('co_s', 'bonus', 100)
  await ledger.consume('co_s', 30, 'slide.generate:co_s:k1:/api/doyaslide/structure:30', { note: 'target:p1 watch:1' })
  await ledger.consume('co_s', 1, 'text.generate:co_s:k2:/api/quote/documents/suggest:1', { note: 'watch:1' })
  await ledger.consume('co_s', 30, 'slide.generate:co_s:k3:/api/doyaslide/structure:30', { note: 'target:p2' })
  await ledger.refund('slide.generate:co_s:k1:/api/doyaslide/structure:30')
  const h = await ledger.history('co_s', { limit: 50 })
  const byOp = (amount: number, type: string) => h.filter((e) => e.amount === amount && e.type === type)
  assert.equal(byOp(-1, 'consume')[0].watch, true)
  assert.equal(byOp(30, 'refund')[0].watch, true, '自動点検の消費の戻しにも印が付く')
  assert.deepEqual(byOp(-30, 'consume').map((e) => e.watch === true).sort(), [false, true])
  assert.equal(h.find((e) => e.type === 'grant')?.watch, undefined)
})

test('履歴の名前と内訳で、自動点検の分を別の行にする', () => {
  assert.equal(historyLabel({ type: 'consume', action: 'slide.generate', kind: null, watch: true }).endsWith('（自動点検）'), true)
  assert.equal(historyLabel({ type: 'consume', action: 'slide.generate', kind: null }).includes('自動点検'), false)
  assert.match(historyLabel({ type: 'refund', action: 'slide.generate', kind: null, watch: true }), /（自動点検）（失敗したので戻した分）$/)
  const at = '2026-10-26T03:00:00.000Z'
  const rows = [
    { at, label: historyLabel({ type: 'consume', action: 'slide.generate', kind: null, watch: true }), amount: -30, type: 'consume', action: 'slide.generate', watch: true },
    { at, label: historyLabel({ type: 'consume', action: 'slide.generate', kind: null }), amount: -30, type: 'consume', action: 'slide.generate' },
    { at, label: historyLabel({ type: 'consume', action: 'slide.generate', kind: null }), amount: -30, type: 'consume', action: 'slide.generate' },
  ]
  const b = usageBreakdown(rows, new Date(at))
  assert.equal(b.length, 2)
  assert.equal(b.find((e) => e.label.includes('自動点検'))?.total, 30)
  assert.equal(b.find((e) => !e.label.includes('自動点検'))?.total, 60)
})
