const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(options = {}) {
  const context = { userId: 'user', memberId: 'member', employeeId: 'employee', organizationId: 'org', role: 'employee' }
  let writes = 0
  let transactions = 0
  const db = {
    $queryRaw: async () => [{
      role: 'employee', status: options.memberStatus || 'ACTIVE', isActive: options.active !== false,
    }],
    kintaiRequest: { create: async ({ data }) => { writes++; return { id: 'request', ...data } } },
  }
  const prisma = { ...db, $transaction: async fn => { transactions++; return fn(db) } }
  const route = load('src/app/api/kintai/requests/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/kintai/access': { getKintaiContext: async () => context, hasMinRole: () => false },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => {} },
    '@/lib/kintai/manager-admission': load('src/lib/kintai/manager-admission.ts'),
  })
  return {
    submit: body => route.POST({ json: async () => body }),
    writes: () => writes,
    transactions: () => transactions,
  }
}

async function main() {
  const validBody = { type: 'holiday_work', details: { date: '2026-10-04' }, reason: 'Testing request' }
  for (const [name, options] of [
    ['所属停止', { memberStatus: 'INACTIVE' }],
    ['従業員無効化', { active: false }],
  ]) {
    const f = fixture(options)
    assert.equal((await f.submit(validBody)).status, 403, name)
    assert.equal(f.writes(), 0, name)
    console.log('PASS', name)
  }
  for (const body of [null, []]) {
    const f = fixture()
    assert.equal((await f.submit(body)).status, 400)
    assert.equal(f.transactions(), 0)
    console.log('PASS 不正な本文', JSON.stringify(body))
  }
  const valid = fixture()
  assert.equal((await valid.submit(validBody)).status, 201)
  assert.equal(valid.writes(), 1)
  console.log('PASS 有効な従業員の申請')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
