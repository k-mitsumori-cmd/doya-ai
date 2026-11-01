const privateApiResponse = require('./load-typescript.cjs').load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const billing = load('src/lib/hr/billing.ts', { '@/lib/prisma': { prisma: {} } })

;(async () => {
  for (const [name, now, start, end] of [
    ['before JST month change', '2026-09-30T14:59:59.999Z', '2026-08-31T15:00:00.000Z', '2026-09-30T15:00:00.000Z'],
    ['after JST month change', '2026-09-30T15:00:00.000Z', '2026-09-30T15:00:00.000Z', '2026-10-31T15:00:00.000Z'],
    ['after JST year change', '2026-12-31T15:00:00.000Z', '2026-12-31T15:00:00.000Z', '2027-01-31T15:00:00.000Z'],
    ['leap-year February', '2028-02-29T14:59:59.999Z', '2028-01-31T15:00:00.000Z', '2028-02-29T15:00:00.000Z'],
  ]) {
    await check(`HR month range: ${name}`, () => {
      const range = billing.hrJstMonthRange(new Date(now))
      assert.equal(range.start.toISOString(), start)
      assert.equal(range.end.toISOString(), end)
      assert.equal(billing.hrJstMonthStart(new Date(now)).toISOString(), start)
    })
  }

  await check('HR dashboard counts only the current JST month', async () => {
    const start = new Date('2026-09-30T15:00:00.000Z')
    const end = new Date('2026-10-31T15:00:00.000Z')
    let countedWhere
    const api = load('src/app/api/hr/dashboard/route.ts', {
      '@/lib/private-api-response': privateApiResponse, 'next/server': { NextResponse: Response },
      '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org', role: 'ADMIN' }), hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
      '@/lib/hr/billing': { hrJstMonthRange: () => ({ start, end }) },
      '@/lib/hr/evaluation-access': { getEvaluationReadWhere: async () => ({}) },
      '@/lib/hr/one-on-one-access': { getOneOnOneReadWhere: async () => ({ organizationId: 'org' }) },
      '@/lib/prisma': { prisma: {
        hrOrganization: { findUnique: async () => ({ name: 'Org' }) },
        hrEmployee: { count: async () => 0 },
        hrDepartment: { count: async () => 0 },
        hrEvaluationPeriod: { findMany: async () => [] },
        hrOneOnOne: {
          count: async query => { countedWhere = query.where; return 2 },
          findMany: async () => [],
        },
      } },
    })
    const response = await api.GET()
    assert.equal(response.status, 200)
    assert.equal((await response.json()).monthlyOneOnOnes, 2)
    assert.equal(countedWhere.conductedAt.gte.toISOString(), start.toISOString())
    assert.equal(countedWhere.conductedAt.lt.toISOString(), end.toISOString())
    assert.equal(countedWhere.organizationId, 'org')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
