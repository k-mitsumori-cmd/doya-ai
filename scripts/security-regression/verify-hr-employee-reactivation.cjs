const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ quotaReached = false, existingStatus = 'RESIGNED' } = {}) {
  const writes = []
  const events = []
  const tx = {
    hrEmployee: { update: async ({ data }) => { writes.push(data); events.push('employee'); return { id: 'e', ...data } } },
    hrEmployeeHistory: { create: async () => { events.push('history'); return { id: 'h' } } },
    hrDepartment: { findFirst: async () => ({ id: 'd2', name: 'New' }) },
  }
  const prisma = {
    hrEmployee: { findFirst: async ({ where }) => {
      assert.equal(where.organizationId, 'o')
      return { id: 'e', status: existingStatus, departmentId: 'd1', department: { name: 'Old' } }
    } },
    $transaction: async callback => { events.push('transaction'); return callback(tx) },
  }
  const billing = {
    createWithinEmployeeLimit: async (organizationId, callback) => {
      assert.equal(organizationId, 'o')
      events.push('quota')
      return quotaReached
        ? { allowed: false, plan: 'FREE', limit: 5 }
        : { allowed: true, value: await callback(tx) }
    },
    employeeLimitMessage: (_, limit) => `上限${limit}`,
  }
  const api = load('src/app/api/hr/employees/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'o', role: 'ADMIN', memberId: 'm' }), hasMinRole: () => true },
    '@/lib/hr/types': { HrMemberRole: { OWNER: 'OWNER', ADMIN: 'ADMIN' }, EmployeeStatus: { ACTIVE: 'ACTIVE', RESIGNED: 'RESIGNED', ON_LEAVE: 'ON_LEAVE', RETIRED: 'RETIRED' } },
    '@/lib/hr/evaluation-access': {},
    '@/lib/hr/one-on-one-access': {},
    '@/lib/hr/billing': billing,
  })
  const ctx = { params: Promise.resolve({ id: 'e' }) }
  return {
    writes,
    events,
    patch: body => api.PATCH({ json: async () => body }, ctx),
    remove: () => api.DELETE({}, ctx),
  }
}

;(async () => {
  await check('reactivation at employee limit returns upgrade response without writes', async () => {
    const f = fixture({ quotaReached: true })
    const response = await f.patch({ status: 'ACTIVE' })
    assert.equal(response.status, 403)
    assert.equal((await response.json()).code, 'HR_ORG_EMPLOYEE_LIMIT')
    assert.deepEqual(f.events, ['quota'])
    assert.equal(f.writes.length, 0)
  })
  await check('reactivation reserves quota before update', async () => {
    const f = fixture()
    assert.equal((await f.patch({ status: 'ACTIVE' })).status, 200)
    assert.deepEqual(f.events, ['quota', 'employee'])
    assert.equal(f.writes[0].status, 'ACTIVE')
  })
  await check('ordinary updates and history share one transaction; invalid status is rejected', async () => {
    const f = fixture({ existingStatus: 'ACTIVE' })
    assert.equal((await f.patch({ status: 'UNKNOWN' })).status, 400)
    assert.equal(f.events.length, 0)
    assert.equal((await f.patch({ departmentId: 'd2' })).status, 200)
    assert.deepEqual(f.events, ['transaction', 'history', 'employee'])
  })
  await check('logical delete and resignation history share one transaction', async () => {
    const f = fixture({ existingStatus: 'ACTIVE' })
    assert.equal((await f.remove()).status, 200)
    assert.deepEqual(f.events, ['transaction', 'employee', 'history'])
  })
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
