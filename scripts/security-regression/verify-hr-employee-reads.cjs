const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const ranks = { MEMBER: 1, MANAGER: 2, ADMIN: 3, OWNER: 4 }
const hasMinRole = (role, minimum) => (ranks[role] || 0) >= ranks[minimum]
const next = { 'next/server': { NextResponse: Response } }

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
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
