const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const shift = load('src/lib/kintai/shift-records.ts')

let reads = 0
let transactions = 0
let writes = 0
let lastNote
const db = {
  $queryRaw: async () => [{ id: 'employee' }],
  kintaiEmployee: { findFirst: async () => ({ id: 'employee' }) },
  kintaiClockRecord: {
    findMany: async () => { reads++; return [] },
    create: async ({ data }) => { writes++; lastNote = data.note; return { id: 'clock', ...data } },
  },
  kintaiAttendance: { findFirst: async () => null },
}
const prisma = { ...db, $transaction: async fn => { transactions++; return fn(db) } }
const route = load('src/app/api/kintai/clock/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/kintai/access': { getKintaiContext: async () => ({ userId: 'user', employeeId: 'employee', organizationId: 'org' }) },
  '@/lib/kintai/shift-records': shift,
  '@/lib/kintai/recalculate': { recalculateDayForEmployee: async () => {} },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
})

async function main() {
  for (const date of ['', 'not-a-date', '2026-02-30', '2026-13-01']) {
    const response = await route.GET(new Request(`http://offline.invalid/api/kintai/clock?date=${date}`))
    assert.equal(response.status, 400, date)
    assert.equal(reads, 0, date)
  }
  const dated = await route.GET(new Request('http://offline.invalid/api/kintai/clock?date=2026-10-04'))
  assert.equal(dated.status, 200)
  assert.equal((await dated.json()).date, '2026-10-04')
  console.log('PASS 打刻履歴の不正日付を拒否し、正常日付を維持')

  for (const body of [null, [], { type: 'clock_in', note: { private: 'object' } }, { type: 'clock_in', note: 'x'.repeat(1001) }]) {
    const response = await route.POST({ json: async () => body, headers: new Headers() })
    assert.equal(response.status, 400)
    assert.equal(transactions, 0)
  }
  assert.equal((await route.POST({ json: async () => { throw new SyntaxError('malformed') }, headers: new Headers() })).status, 400)
  assert.equal(transactions, 0)
  console.log('PASS 不正な打刻本文とメモは保存されない')

  const valid = await route.POST({ json: async () => ({ type: 'clock_in', note: '  現場から  ' }), headers: new Headers() })
  assert.equal(valid.status, 200)
  assert.equal(writes, 1)
  assert.equal(lastNote, '現場から')
  console.log('PASS 正常な打刻とメモは保存される')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
