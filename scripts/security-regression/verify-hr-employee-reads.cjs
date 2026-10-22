const privateApiResponse = require('./load-typescript.cjs').load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const ranks = { MEMBER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 }
const hasMinRole = (role, minimum) => (ranks[role] || 0) >= ranks[minimum]
const next = { '@/lib/hr/org-chart-pagination': { readHrOrgChartPage() { throw Error('Legacy fixture unexpectedly entered paged GET') }, HrOrgChartPageError: class extends Error {} }, '@/lib/private-api-response': privateApiResponse, 'next/server': { NextResponse: Response } }

;(async () => {
  for (const employeeId of ['own', null]) {
    await check(`member list and org chart only expose ${employeeId || 'no linked'} employee`, async () => {
      const employeeQueries = []
      const ctx = { organizationId: 'o', userId: 'u', role: 'MEMBER', memberId: 'm', employeeId }
      const prisma = {
        hrEmployee: {
          findMany: async ({ where }) => { employeeQueries.push(where); return [] },
          count: async ({ where }) => { employeeQueries.push(where); return 0 },
        },
        hrOrganization: { findUnique: async () => ({ name: 'Org' }) },
        hrDepartment: { findMany: async () => [] },
      }
      const mocks = {
        ...next,
        '@/lib/prisma': { prisma },
        '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole },
        '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN', MANAGER: 'MANAGER' } },
        '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
        '@/lib/hr/billing': {},
        '@/lib/service-usage': {},
        'next-auth': {},
        '@/lib/auth': {},
      }
      const list = load('src/app/api/hr/employees/route.ts', mocks)
      const chart = load('src/app/api/hr/org-chart/route.ts', mocks)
      assert.equal((await list.GET({ nextUrl: new URL('https://offline.invalid/api/hr/employees') })).status, 200)
      assert.equal((await chart.GET()).status, 200)
      assert.equal(employeeQueries.length, 3)
      for (const where of employeeQueries) {
        assert.equal(where.organizationId, 'o')
        assert.equal(JSON.stringify(where.id), JSON.stringify(employeeId || { in: [] }))
      }
    })
  }

  await check('member cannot open another employee profile before related DB reads', async () => {
    const ctx = { organizationId: 'o', userId: 'u', role: 'MEMBER', memberId: 'm', employeeId: 'own' }
    const detail = load('src/app/api/hr/employees/[id]/route.ts', {
      ...next,
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN', MANAGER: 'MANAGER' } },
      '@/lib/hr/billing': {},
      '@/lib/hr/evaluation-access': { getEvaluationReadWhere: async () => { throw Error('evaluation read before scope') } },
      '@/lib/hr/one-on-one-access': { getOneOnOneReadWhere: async () => { throw Error('1on1 read before scope') } },
      '@/lib/prisma': { prisma: new Proxy({}, { get: () => { throw Error('DB read before scope') } }) },
      'next-auth': {},
      '@/lib/auth': {},
    })
    assert.equal((await detail.GET({}, { params: Promise.resolve({ id: 'other' }) })).status, 404)
  })

  await check('member settings and membership APIs only query own account', async () => {
    const queries = []
    const ctx = { organizationId: 'o', userId: 'u', role: 'MEMBER', memberId: 'm', employeeId: 'own' }
    const prisma = {
      hrOrganization: { findUnique: async () => ({ id: 'o', name: 'Org' }) },
      hrOrganizationMember: { findMany: async ({ where }) => { queries.push(where); return [] } },
    }
    const mocks = {
      ...next,
      '@/lib/prisma': { prisma },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole },
    }
    const settings = load('src/app/api/hr/settings/route.ts', mocks)
    const members = load('src/app/api/hr/organization/members/route.ts', mocks)
    assert.equal((await settings.GET()).status, 200)
    assert.equal((await members.GET()).status, 200)
    assert.equal(queries.length, 2)
    for (const where of queries) {
      assert.equal(where.organizationId, 'o')
      assert.equal(where.id, 'm')
    }
  })

  for (const scenario of [
    { name: 'anonymous refusal', actor: null, status: 401 },
    { name: 'other employee refusal', role: 'MEMBER', employeeId: 'own', target: 'other', status: 404 },
    { name: 'missing employee refusal', role: 'OWNER', missing: true, status: 404 },
    { name: 'own employee success', role: 'MEMBER', employeeId: 'own', status: 200 },
    { name: 'owner employee success', role: 'OWNER', status: 200 },
    { name: 'unexpected read failure', role: 'OWNER', fail: true, status: 500 },
  ]) {
    await check(`employee detail ${scenario.name} is private and never cached`, async () => {
      const context = scenario.actor === null ? null : { organizationId: 'o', userId: 'u', memberId: 'm', role: scenario.role, employeeId: scenario.employeeId || null }
      const detail = load('src/app/api/hr/employees/[id]/route.ts', {
        'next/server': { NextResponse: Response },
        'next-auth': {}, '@/lib/auth': {}, '@/lib/hr/billing': {},
        '@/lib/organization-billing-owner': { organizationBillingErrorResponse: () => scenario.billing ? { status: 503, body: { code: 'BILLING_AUTHORITY_UNAVAILABLE' } } : null },
        '@/lib/hr/access': { getHrContext: async () => context, hasMinRole: (role) => ['MANAGER', 'ADMIN', 'OWNER'].includes(role) },
        '@/lib/hr/types': { HrMemberRole: { MANAGER: 'MANAGER', ADMIN: 'ADMIN', OWNER: 'OWNER' } },
        '@/lib/hr/evaluation-access': { getEvaluationReadWhere: async () => ({ organizationId: 'o' }) },
        '@/lib/hr/one-on-one-access': { getOneOnOneReadWhere: async () => ({ organizationId: 'o' }), getOneOnOneViewer: async () => ({ employeeId: context?.employeeId || null }), filterOneOnOneFields: record => record },
        '@/lib/prisma': { prisma: { hrEmployee: { findFirst: async () => { if (scenario.fail) throw Error('Synthetic private DB error'); return scenario.missing ? null : { id: scenario.target || 'own', oneOnOnesAsEmployee: [] } } } } },
      })
      const response = await detail.GET({}, { params: Promise.resolve({ id: scenario.target || 'own' }) })
      assert.equal(response.status, scenario.status)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert(response.headers.get('vary').split(',').some(value => value.trim().toLowerCase() === 'cookie'))
      const data = await response.json()
      if (scenario.billing) assert.equal(data.code, 'BILLING_AUTHORITY_UNAVAILABLE')
      if (scenario.status === 200) assert.equal(data.employee.id, scenario.target || 'own')
      assert(!JSON.stringify(data).includes('Synthetic private DB error'))
    })
  }

  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
