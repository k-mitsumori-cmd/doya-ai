const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

;(async () => {
  await check('employee admission locks organization and blocks at its active quota', async () => {
    let writes = 0
    const tx = {
      $queryRaw: async () => [{ id: 'o' }],
      hrOrganizationMember: { findFirst: async () => ({ userId: 'owner' }) },
      user: { findUnique: async () => ({ plan: 'FREE' }) },
      hrEmployee: { count: async ({ where }) => { assert.equal(where.status, 'ACTIVE'); return 5 } },
    }
    const billing = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma: { $transaction: fn => fn(tx) } } })
    const result = await billing.createWithinEmployeeLimit('o', async () => { writes++; return 'created' })
    assert.equal(result.allowed, false)
    assert.equal(result.limit, 5)
    assert.equal(writes, 0)
    assert.match(billing.employeeLimitMessage('PRO', 100), /お問い合わせ/)
    assert.doesNotMatch(billing.employeeLimitMessage('PRO', 100), /アップグレード/)
  })

  await check('single employee writes history in the admitted transaction', async () => {
    let employeeWrites = 0
    let historyWrites = 0
    const tx = {
      hrEmployee: { create: async ({ data }) => { employeeWrites++; return { id: 'e', lastName: data.lastName, firstName: data.firstName, department: null } } },
      hrEmployeeHistory: { create: async ({ data }) => { historyWrites++; assert.equal(data.employeeId, 'e') } },
    }
    const api = load('src/app/api/hr/employees/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: {} },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'o', userId: 'u', role: 'OWNER' }) },
      '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
      '@/lib/hr/billing': {
        createWithinEmployeeLimit: async (id, create) => { assert.equal(id, 'o'); return { allowed: true, value: await create(tx) } },
        employeeLimitMessage: () => '',
      },
      '@/lib/service-usage': { recordServiceUsage: async () => {} },
    })
    const response = await api.POST({ json: async () => ({ lastName: '山田', firstName: '太郎' }) })
    assert.equal(response.status, 200)
    assert.deepEqual([employeeWrites, historyWrites], [1, 1])
  })

  await check('CSV import reports partial success and a persistent PRO contact route', async () => {
    let calls = 0
    const api = load('src/app/api/hr/employees/import/route.ts', {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: {} },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'o', role: 'ADMIN' }), hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
      '@/lib/hr/billing': {
        createWithinEmployeeLimit: async (id, create) => {
          calls++
          if (calls > 1) return { allowed: false, plan: 'PRO', limit: 100 }
          const tx = {
            hrEmployee: { create: async () => ({ id: 'e' }) },
            hrEmployeeHistory: { create: async () => ({}) },
          }
          return { allowed: true, value: await create(tx) }
        },
        employeeLimitMessage: () => '上限です。お問い合わせください。',
      },
    })
    const response = await api.POST({ json: async () => ({ csvText: 'lastName,firstName\n山田,太郎\n佐藤,花子' }) })
    const data = await response.json()
    assert.equal(response.status, 200)
    assert.equal(data.imported, 1)
    assert.equal(data.failed, 1)
    assert.equal(data.code, 'HR_ORG_EMPLOYEE_LIMIT')
    assert.equal(data.limitNotice.upgradeUrl, undefined)
    assert.match(data.limitNotice.contactUrl, /contact/)
  })

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
