const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const calls = []
const employees = Array.from({ length: 205 }, (_, index) => ({ id: `employee-${index}` }))
const prisma = {
  hrEmployee: {
    findMany: async args => {
      calls.push(args)
      return employees.slice(args.skip, args.skip + args.take)
    },
    count: async () => employees.length,
  },
}
const { GET } = load('src/app/api/hr/employees/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/hr/access': {
    getHrContext: async () => ({ organizationId: 'org-1', role: 'MANAGER' }),
    hasMinRole: () => true,
  },
  '@/lib/hr/types': { HrMemberRole: { MANAGER: 'MANAGER' } },
  '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
  '@/lib/hr/billing': { createWithinEmployeeLimit: async () => {}, employeeLimitMessage: () => '' },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
})

async function request(query) {
  const response = await GET({ nextUrl: new URL(`https://example.com/api/hr/employees?${query}`) })
  return { status: response.status, body: await response.json() }
}

;(async () => {
  let result = await request('page=2&pageSize=20&sort=department')
  assert.equal(result.status, 200)
  assert.equal(result.body.total, 205)
  assert.equal(result.body.totalPages, 11)
  assert.equal(result.body.items.length, 20)
  assert.equal(result.body.items[0].id, 'employee-20')
  assert.equal(calls[0].skip, 20)
  assert.equal(calls[0].take, 20)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].orderBy)), [
    { department: { name: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' },
  ])

  result = await request('page=11&pageSize=20&sort=hireDate')
  assert.equal(result.body.items.length, 5)
  assert.equal(result.body.items[0].id, 'employee-200')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].orderBy)), [
    { hireDate: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' },
  ])

  const previousCalls = calls.length
  result = await request('sort=invalid')
  assert.equal(result.status, 400)
  assert.equal(calls.length, previousCalls)
  console.log('PASS HR employees: server pages all 205 records with global sort and rejects invalid sort')
})().catch(error => { console.error(error); process.exitCode = 1 })
