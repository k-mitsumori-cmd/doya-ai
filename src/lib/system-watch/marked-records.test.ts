import { test } from 'node:test'
import assert from 'node:assert/strict'
import { excludeIds, jstMonth, markedKey, markSystemWatchRecord, systemWatchRecordIds } from './marked-records'

function fakeDb() {
  const rows = new Map<string, string>()
  return {
    rows,
    systemSetting: {
      async findUnique({ where }: { where: { key: string } }) { const v = rows.get(where.key); return v === undefined ? null : { value: v } },
      async upsert({ where, create, update }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) { rows.set(where.key, rows.has(where.key) ? update.value : create.value) },
    },
  }
}

test('月の区切りは日本時間', () => {
  assert.equal(jstMonth(new Date('2026-10-31T14:59:00Z')), '2026-10')
  assert.equal(jstMonth(new Date('2026-10-31T15:00:00Z')), '2026-11')
})

test('残した ID を、同じ月の数え方から外せる。二重には残さない', async () => {
  const db = fakeDb()
  const at = new Date('2026-10-26T00:00:00Z')
  await markSystemWatchRecord(db, 'shodan-preparation', 'org1', 'p1', at)
  await markSystemWatchRecord(db, 'shodan-preparation', 'org1', 'p1', at)
  await markSystemWatchRecord(db, 'shodan-preparation', 'org1', 'p2', at)
  assert.deepEqual(await systemWatchRecordIds(db, 'shodan-preparation', ['org1'], at), ['p1', 'p2'])
  assert.deepEqual(excludeIds(['p1', 'p2']), { id: { notIn: ['p1', 'p2'] } })
})

test('別の組織・別の種類・別の月の ID は混ざらない', async () => {
  const db = fakeDb()
  const at = new Date('2026-10-26T00:00:00Z')
  await markSystemWatchRecord(db, 'shodan-preparation', 'org1', 'p1', at)
  await markSystemWatchRecord(db, 'quote-document', 'org1', 'q1', at)
  assert.deepEqual(await systemWatchRecordIds(db, 'shodan-preparation', ['org2'], at), [])
  assert.deepEqual(await systemWatchRecordIds(db, 'shodan-preparation', ['org1'], new Date('2026-11-02T00:00:00Z')), [])
  assert.deepEqual(await systemWatchRecordIds(db, 'quote-document', ['org1'], at), ['q1'])
})

test('残した ID が無ければ、数え方の条件を足さない。壊れた値は無視する', async () => {
  assert.deepEqual(excludeIds([]), {})
  const db = fakeDb()
  db.rows.set(markedKey('shodan-preparation', 'org1', '2026-10'), 'not json')
  assert.deepEqual(await systemWatchRecordIds(db, 'shodan-preparation', ['org1'], new Date('2026-10-26T00:00:00Z')), [])
})
