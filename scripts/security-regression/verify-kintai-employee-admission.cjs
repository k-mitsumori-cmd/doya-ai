const assert = require('node:assert/strict')
const { webcrypto } = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const pricing = { getKintaiEmployeeLimitByUserPlan: () => 1, HIGH_USAGE_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' }
const planUtils = load('src/lib/plan-utils.ts')
const admission = load('src/lib/kintai/employee-admission.ts', { '@/lib/pricing': pricing, '@/lib/plan-utils': planUtils })
const inviteToken = load('src/lib/kintai/invite-token.ts', {}, { crypto: webcrypto })
const access = { getKintaiContext: async () => ({ organizationId: 'org', userId: 'owner', role: 'system_admin' }), hasMinRole: () => true }

;(async () => {
  await check('concurrent employee creation counts and writes under the same organization lock', async () => {
    let activeCount = 0
    let creates = 0
    let sends = 0
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
      kintaiOrganization: { findUnique: async () => { throw Error('temporary lookup failure') } },
    }
    const api = load('src/app/api/kintai/employees/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma },
      '@/lib/html-escape': { escapeHtml: x => x },
      '@/lib/kintai/access': access,
      '@/lib/kintai/employee-admission': admission,
      '@/lib/kintai/invite-token': inviteToken,
      '@/lib/email': { sendEmail: async ({ subject }) => { sends++; assert.ok(subject.includes('組織')); return { success: false } } },
    }, { crypto: webcrypto })
    const request = () => ({ json: async () => ({ name: '山田', email: 'yamada@example.test' }) })
    const responses = await Promise.all([api.POST(request()), api.POST(request())])
    assert.deepEqual(responses.map(r => r.status).sort(), [201, 403])
    assert.equal(lockCalls, 2)
    assert.equal(creates, 1)
    assert.equal(sends, 1)
    const created = await responses.find(r => r.status === 201).json()
    assert.equal(created.emailSent, false)
    assert.ok(created.inviteUrl)
    const denied = await responses.find(r => r.status === 403).json()
    assert.equal(denied.code, 'KINTAI_EMPLOYEE_LIMIT')
    assert.equal(denied.canManageBilling, true)
    assert.equal(denied.upgradeUrl, '/kintai/pricing')
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

  await check('employee cap action follows the organization owner and paid tier', async () => {
    for (const [plan,actor,expectedAction] of [
      ['FREE','owner','upgradeUrl'], ['LIGHT','owner','upgradeUrl'],
      ['PRO','owner','contactUrl'], ['ENTERPRISE','owner','contactUrl'],
      ['FREE','admin','owner'], ['PRO','admin','owner'],
    ]) {
      const tx = {
        kintaiMember: { findFirst: async (args) => {
          assert.equal(args.orderBy.createdAt,'asc')
          return { userId:'owner' }
        } },
        user: { findUnique: async () => ({ plan }) },
        kintaiEmployee: { count: async () => 1 },
      }
      const reached = await admission.reachedKintaiEmployeeLimit(tx,'org')
      const body = admission.kintaiEmployeeLimitPayload(reached,actor)
      assert.equal(body.limitReached,undefined)
      assert.equal(body.canManageBilling,actor==='owner')
      if (expectedAction==='owner') {
        assert.equal(body.upgradeUrl,undefined)
        assert.equal(body.contactUrl,undefined)
        assert.match(body.error,/組織の契約者/)
      } else {
        assert.equal(typeof body[expectedAction],'string')
        assert.equal(body[expectedAction==='upgradeUrl'?'contactUrl':'upgradeUrl'],undefined)
      }
    }
  })

  await check('invalid employee listing pagination is rejected before querying', async () => {
    let queries = 0
    const api = load('src/app/api/kintai/employees/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: { kintaiEmployee: { findMany: async () => { queries++; return [] }, count: async () => 0 } } },
      '@/lib/html-escape': { escapeHtml: x => x },
      '@/lib/kintai/access': access,
      '@/lib/kintai/employee-admission': admission,
      '@/lib/kintai/invite-token': inviteToken,
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
