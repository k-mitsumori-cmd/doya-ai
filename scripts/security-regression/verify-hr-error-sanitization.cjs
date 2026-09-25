const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../../src/app/api/hr')
const secret = 'postgres://private-password@example.invalid/hr'
const failure = () => { throw Error(secret) }
const ctx = { organizationId: 'org', role: 'ADMIN', memberId: 'member', employeeId: 'employee' }
const server = { NextResponse: Response }

async function expectSafe(promise, expected) {
  const response = await promise
  assert.equal(response.status, 500)
  const body = await response.json()
  assert.equal(body.error, expected)
  assert(!JSON.stringify(body).includes(secret))
}
;(async () => {
  await check('HR employee list retains 401 but never returns private database error', async () => {
    const mocks = {
      'next/server': server,
      'next-auth': {}, '@/lib/auth': {},
      '@/lib/prisma': { prisma: { hrEmployee: { findMany: failure, count: async () => 0 } } },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole: () => true },
      '@/lib/hr/types': { HrMemberRole: { MANAGER: 'MANAGER' } },
      '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
      '@/lib/hr/billing': {}, '@/lib/service-usage': {},
    }
    const api = load('src/app/api/hr/employees/route.ts', mocks)
    await expectSafe(api.GET({ nextUrl: new URL('http://offline.invalid/') }), 'Failed to fetch employees')
    mocks['@/lib/hr/access'].getHrContext = async () => null
    assert.equal((await api.GET({ nextUrl: new URL('http://offline.invalid/') })).status, 401)
  })
  await check('HR organization member list does not return private database error', async () => {
    const api = load('src/app/api/hr/organization/members/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { hrOrganizationMember: { findMany: failure } } },
      '@/lib/hr/access': { getHrContext: async () => ctx, hasMinRole: () => true },
    })
    await expectSafe(api.GET(), 'Failed to fetch members')
  })
  await check('HR dashboard does not return private database error', async () => {
    const api = load('src/app/api/hr/dashboard/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: {
        hrOrganization: { findUnique: failure }, hrEmployee: { count: async () => 0 },
        hrDepartment: { count: async () => 0 }, hrEvaluationPeriod: { findMany: async () => [] },
        hrOneOnOne: { count: async () => 0, findMany: async () => [] },
      } },
      '@/lib/hr/access': { getHrContext: async () => ctx },
      '@/lib/hr/evaluation-access': { getEvaluationReadWhere: async () => ({}) },
      '@/lib/hr/one-on-one-access': { getOneOnOneReadWhere: async () => ({}) },
    })
    await expectSafe(api.GET(), 'Failed')
  })
  await check('HR API 500 handlers never interpolate exception messages', async () => {
    let checked = 0
    function visit(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) visit(file)
      else if (file.endsWith('.ts')) {
        const source = fs.readFileSync(file, 'utf8')
        checked += (source.match(/status:\s*500/g) || []).length
        assert(!/error:\s*(?:e|err|error)\??\.(?:message|stack)/.test(source), `${file} exposes an internal error`)
      }
    } }
    visit(root)
    assert(checked >= 33)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
