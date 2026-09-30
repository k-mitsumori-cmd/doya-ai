const assert = require('node:assert/strict')
const { webcrypto } = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const pricing = { getKintaiEmployeeLimitByUserPlan: () => 1 }
const admission = load('src/lib/kintai/employee-admission.ts', { '@/lib/pricing': pricing })
const access = { getKintaiContext: async () => ({ organizationId: 'org', role: 'system_admin' }), hasMinRole: () => true }

;(async () => {
  await check('concurrent employee creation counts and writes under the same organization lock', async () => {
    let activeCount = 0
    let creates = 0
    let lockCalls = 0
    let previous = Promise.resolve()
    const prisma = {
      $transaction: async (work) => {
        let release = () => {}
        const tx = {
          $queryRaw: async () => {
            lockCalls++
            const before = previous
            previous = new Promise(resolve => { release = resolve })
            await before
            return [{ id: 'org' }]
          },
          kintaiMember: { findFirst: async () => ({ userId: 'owner' }) },
          user: { findUnique: async () => ({ plan: 'FREE' }) },
          kintaiEmployee: {
            count: async () => activeCount,
            create: async () => { creates++; activeCount++; return { id: 'e' } },
          },
        }
        try { return await work(tx) } finally { release() }
      },
      kintaiDepartment: { findFirst: async () => null },
      kintaiWorkRule: { findFirst: async () => null },
      kintaiOrganization: { findUnique: async () => ({ name: '会社' }) },
    }
    const api = load('src/app/api/kintai/employees/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma },
      '@/lib/html-escape': { escapeHtml: x => x },
      '@/lib/kintai/access': access,
      '@/lib/kintai/employee-admission': admission,
      '@/lib/email': { sendEmail: async () => {} },
    }, { crypto: webcrypto })
    const request = () => ({ json: async () => ({ name: '山田', email: 'yamada@example.test' }) })
    const responses = await Promise.all([api.POST(request()), api.POST(request())])
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 403])
    assert.equal(lockCalls, 2)
    assert.equal(creates, 1)
    assert.equal((await responses.find(r => r.status === 403).json()).code, 'KINTAI_EMPLOYEE_LIMIT')
  })

  await check('reactivation enforces the quota and foreign references never reach update', async () => {
    let updates = 0
    let count = 1
    const tx = {
      $queryRaw: async () => [{ id: 'org' }],
      kintaiMember: { findFirst: async () => ({ userId: 'owner' }) },
      user: { findUnique: async () => ({ plan: 'FREE' }) },
      kintaiEmployee: {
        findFirst: async () => ({ id: 'e', organizationId: 'org', isActive: false, member: { id: 'm', role: 'employee' } }),
        count: async () => count,
        update: async ({ data }) => { updates++; return { id: 'e', isActive: data.isActive, member: { id: 'm', role: 'employee' } } },
      },
      kintaiDepartment: { findFirst: async () => null },
      kintaiWorkRule: { findFirst: async () => null },
    }
    const api = load('src/app/api/kintai/employees/[id]/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { $transaction: async work => work(tx) } },
      '@/lib/kintai/access': access,
      '@/lib/kintai/employee-admission': admission,
    })
    const patch = body => api.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'e' }) })
    assert.equal((await patch({ isActive: true })).status, 403)
    assert.equal(updates, 0)
    count = 0
    assert.equal((await patch({ departmentId: 'foreign' })).status, 400)
    assert.equal((await patch({ workRuleId: 'foreign' })).status, 400)
    assert.equal(updates, 0)
    assert.equal((await patch({ isActive: true })).status, 200)
    assert.equal(updates, 1)
  })

  await check('invalid employee listing pagination is rejected before querying', async () => {
    let queries = 0
    const api = load('src/app/api/kintai/employees/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async () => { queries++; return [] }, count: async () => 0 } } },
      '@/lib/html-escape': { escapeHtml: x => x },
      '@/lib/kintai/access': access,
      '@/lib/kintai/employee-admission': admission,
      '@/lib/email': { sendEmail: async () => {} },
    })
    for (const query of ['page=abc', 'page=1abc', 'page=0', 'page=10000001', 'pageSize=NaN', 'pageSize=201', 'isActive=maybe']) {
      const response = await api.GET({ url: `https://example.test/api/kintai/employees?${query}` })
      assert.equal(response.status, 400, query)
    }
    assert.equal(queries, 0)
    assert.equal((await api.GET({ url: 'https://example.test/api/kintai/employees?page=2&pageSize=20&isActive=false' })).status, 200)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
