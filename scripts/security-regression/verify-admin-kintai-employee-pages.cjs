const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const employees = Array.from({ length: 235 }, (_, index) => ({
  id: `emp-${index}`, name: `Person ${index}`, email: `person${index}@example.test`,
  organizationId: index < 200 ? 'org-1' : 'org-2',
  member: { role: 'employee', status: index % 2 ? 'PENDING' : 'ACTIVE' },
  department: { name: '営業' }, createdAt: new Date('2026-01-01'),
}))
const organizations = [{ id: 'org-1', name: 'General' }, { id: 'org-2', name: 'Special Team' }]
const calls = []
let valid = true

function filtered(where) {
  return employees.filter(employee => {
    if (where.member?.status && employee.member.status !== where.member.status) return false
    if (!where.OR) return true
    return where.OR.some(condition => {
      if (condition.name) return employee.name.toLowerCase().includes(condition.name.contains.toLowerCase())
      if (condition.email) return employee.email.toLowerCase().includes(condition.email.contains.toLowerCase())
      return condition.organizationId.in.includes(employee.organizationId)
    })
  })
}

const prisma = {
  kintaiEmployee: {
    findMany: async args => {
      calls.push(args)
      return filtered(args.where).slice(args.skip, args.skip + args.take)
    },
    count: async args => filtered(args.where).length,
  },
  kintaiOrganization: {
    findMany: async args => args.where.name
      ? organizations.filter(org => org.name.toLowerCase().includes(args.where.name.contains.toLowerCase())).map(org => ({ id: org.id }))
      : organizations.filter(org => args.where.id.in.includes(org.id)),
  },
}
const { GET } = load('src/app/api/admin/kintai/employees/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  'next/headers': { cookies: async () => ({ get: () => ({ value: 'session' }) }) },
  '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid }) },
  '@/lib/prisma': { prisma },
})

async function request(query) {
  const response = await GET({ nextUrl: new URL(`https://example.com/api/admin/kintai/employees?${query}`) })
  return { status: response.status, body: await response.json() }
}

;(async () => {
  let result = await request('page=5')
  assert.equal(result.status, 200)
  assert.equal(result.body.total, 235)
  assert.equal(result.body.totalPages, 5)
  assert.equal(result.body.employees.length, 35)
  assert.equal(result.body.employees[0].id, 'emp-200')
  assert.equal(result.body.employees[0].organizationName, 'Special Team')
  assert.equal(calls[0].skip, 200)
  assert.equal(calls[0].take, 50)

  result = await request('search=special&status=PENDING')
  assert.equal(result.status, 200)
  assert.equal(result.body.total, 17)
  assert.equal(result.body.employees.length, 17)
  assert.equal(result.body.employees.every(employee => employee.organizationName === 'Special Team' && employee.memberStatus === 'PENDING'), true)

  const previousCalls = calls.length
  assert.equal((await request('page=0')).status, 400)
  assert.equal((await request('status=INVALID')).status, 400)
  assert.equal(calls.length, previousCalls)
  valid = false
  assert.equal((await request('page=5')).status, 401)
  assert.equal(calls.length, previousCalls)
  console.log('PASS admin kintai employees: 235 records reachable; global organization/status search, invalid input and auth')
})().catch(error => { console.error(error); process.exitCode = 1 })
