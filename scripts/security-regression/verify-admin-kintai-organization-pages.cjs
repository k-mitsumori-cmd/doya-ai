const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const organizations = Array.from({ length: 45 }, (_, index) => ({
  id: `org-${index}`, name: `組織${index}`, slug: `org-${index}`, createdAt: new Date('2026-01-01'),
  departments: [], workRules: [],
}))
const employees = Array.from({ length: 62 }, (_, index) => ({
  id: `emp-${index}`, organizationId: 'org-20', name: `従業員${index}`,
  email: `e${index}@example.test`, isActive: true, employmentType: 'full_time',
}))
const calls = []
let valid = true
const prisma = {
  kintaiOrganization: {
    findMany: async args => {
      calls.push(['organizations', args])
      return organizations.slice(args.skip, args.skip + args.take)
    },
    count: async () => organizations.length,
    findUnique: async args => organizations.find(org => org.id === args.where.id) || null,
  },
  kintaiEmployee: {
    findMany: async args => {
      calls.push(['employees', args])
      return employees.filter(emp => emp.organizationId === args.where.organizationId).slice(args.skip, args.skip + args.take)
    },
    count: async args => employees.filter(emp => emp.organizationId === args.where.organizationId).length,
    groupBy: async args => args.where.organizationId.in.includes('org-20')
      ? [{ organizationId: 'org-20', _count: { _all: 62 } }] : [],
  },
  kintaiMember: {
    groupBy: async args => args.where.organizationId.in.includes('org-20')
      ? [{ organizationId: 'org-20', _count: { _all: 3 } }] : [],
  },
}
const { GET } = load('src/app/api/admin/kintai/organizations/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'session' }) }) },
  '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid }) },
  '@/lib/prisma': { prisma },
})

async function request(query) {
  const response = await GET({ nextUrl: new URL(`https://example.com/api/admin/kintai/organizations?${query}`) })
  return { status: response.status, body: await response.json() }
}

;(async () => {
  let result = await request('page=2')
  assert.equal(result.status, 200)
  assert.equal(result.body.total, 45)
  assert.equal(result.body.totalPages, 3)
  assert.equal(result.body.organizations.length, 20)
  assert.equal(result.body.organizations[0].id, 'org-20')
  assert.equal(result.body.organizations[0].activeCount, 62)
  assert.equal(result.body.organizations[0].pendingCount, 3)
  assert.equal(calls.filter(([name]) => name === 'employees').length, 0)
  assert.equal(calls[0][1].skip, 20)
  assert.equal(calls[0][1].take, 20)

  result = await request('page=3')
  assert.equal(result.body.organizations.length, 5)
  assert.equal(result.body.organizations[0].id, 'org-40')

  result = await request('organizationId=org-20&employeePage=3')
  assert.equal(result.status, 200)
  assert.equal(result.body.total, 62)
  assert.equal(result.body.totalPages, 3)
  assert.equal(result.body.employees.length, 12)
  assert.equal(result.body.employees[0].id, 'emp-50')
  assert.equal(calls.find(([name]) => name === 'employees')[1].take, 25)

  const previousCalls = calls.length
  assert.equal((await request('page=0')).status, 400)
  assert.equal((await request('organizationId=org-20&employeePage=1.5')).status, 400)
  assert.equal(calls.length, previousCalls)
  valid = false
  assert.equal((await request('organizationId=org-20')).status, 401)
  assert.equal(calls.length, previousCalls)
  console.log('PASS admin kintai organizations: bounded organization and lazy employee pages, counts, invalid input and auth')
})().catch(error => { console.error(error); process.exitCode = 1 })
