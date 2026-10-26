import { test } from 'node:test'
import assert from 'node:assert/strict'
import { markSystemWatchRecord } from './marked-records'
import { monthsBetween, systemWatchRecordIdsAll, systemWatchRecordIdsBetween } from './marked-records-range'

function fakeDb() {
  const rows = new Map<string, string>()
  return {
    systemSetting: {
      async findUnique({ where }: { where: { key: string } }) { const v = rows.get(where.key); return v === undefined ? null : { value: v } },
      async upsert({ where, create, update }: { where: { key: string }; create: { key: string; value: string }; update: { value: string } }) { rows.set(where.key, rows.has(where.key) ? update.value : create.value) },
      async findMany({ where }: { where: { key: { in: string[] } } }) { return where.key.in.filter(k => rows.has(k)).map(k => ({ value: rows.get(k)! })) },
    },
  }
}

test('月の一覧は始めた月（2026-10）より前を含めず、年をまたげる', () => {
  assert.deepEqual(monthsBetween('2026-01', '2026-11'), ['2026-10', '2026-11'])
  assert.deepEqual(monthsBetween('2026-11', '2027-02'), ['2026-11', '2026-12', '2027-01', '2027-02'])
  assert.deepEqual(monthsBetween('2026-10', '2026-09'), [])
})

test('複数の月と複数の範囲の ID をまとめて読む', async () => {
  const db = fakeDb()
  await markSystemWatchRecord(db, 'quote-document', 'org1', 'q-oct', new Date('2026-10-26T00:00:00Z'))
  await markSystemWatchRecord(db, 'quote-document', 'org1', 'q-nov', new Date('2026-11-05T00:00:00Z'))
  await markSystemWatchRecord(db, 'quote-document', 'org2', 'q-other', new Date('2026-11-05T00:00:00Z'))
  await markSystemWatchRecord(db, 'shodan-preparation', 'org1', 's1', new Date('2026-11-05T00:00:00Z'))
  const all = await systemWatchRecordIdsAll(db, 'quote-document', ['org1'], new Date('2026-12-01T00:00:00Z'))
  assert.deepEqual(all.sort(), ['q-nov', 'q-oct'])
  const nov = await systemWatchRecordIdsBetween(db, 'quote-document', ['org1', 'org2'], new Date('2026-11-01T00:00:00+09:00'), new Date('2026-11-30T00:00:00Z'))
  assert.deepEqual(nov.sort(), ['q-nov', 'q-other'])
  assert.deepEqual(await systemWatchRecordIdsAll(db, 'quote-document', [], new Date()), [])
})
