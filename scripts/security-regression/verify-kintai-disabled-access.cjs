const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

async function main() {
  let active = false
  let ownerId = 'owner'
  let writes = 0
  const prisma = {
    kintaiMember: {
      findFirst: async ({ where } = {}) => where?.role === 'system_admin'
        ? { userId: ownerId }
        : { id: 'member', organizationId: 'org', role: 'hr_admin', status: 'ACTIVE', employee: { id: 'emp', name: 'Former', isActive: active } },
      findUnique: async () => ({ role: 'system_admin' }),
    },
    kintaiEmployee: {
      findFirst: async () => ({ id: 'emp', memberId: 'member', organizationId: 'org', isActive: active, member: { id: 'member', role: 'system_admin' } }),
      update: async () => { writes++; throw Error('Unexpected employee write') },
    },
    user: { findUnique: async () => ({ plan: 'FREE' }) },
    $transaction: async fn => fn(prisma),
    $queryRaw: async () => [{ role: 'system_admin', status: 'ACTIVE', isActive: true }],
  }
  const access = load('src/lib/kintai/access.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
    './types': load('src/lib/kintai/types.ts', {}),
  })
  const inactive = await access.getKintaiContext()
  assert.equal(inactive.role, 'employee')
  assert.equal(inactive.isActive, false)
  active = true
  const current = await access.getKintaiContext()
  assert.equal(current.role, 'hr_admin')
  assert.equal(current.isActive, true)
  active = false

  const usage = load('src/app/api/kintai/usage/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  })
  const usageResponse = await usage.GET()
  const memberUsage = await usageResponse.json()
  assert.equal(memberUsage.role, 'employee')
  assert.equal(memberUsage.canManageBilling, false)
  assert.equal(usageResponse.headers.get('cache-control'), 'private, no-store')
  assert.equal(usageResponse.headers.get('vary'), 'Cookie')
  ownerId = 'user'
  const ownerUsage = await usage.GET()
  assert.equal((await ownerUsage.json()).canManageBilling, true)

  const common = { 'next/server': { NextResponse: Response }, '@/lib/prisma': { prisma }, '@/lib/kintai/access': { getKintaiContext: async () => ({ ...inactive, role: 'system_admin' }), hasMinRole: access.hasMinRole } }
  const employeeRoute = load('src/app/api/kintai/employees/[id]/route.ts', { ...common,
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => {}, reachedKintaiEmployeeLimit: async () => null, kintaiEmployeeLimitPayload: () => ({}) },
    '@/lib/kintai/manager-admission': load('src/lib/kintai/manager-admission.ts'),
  })
  const params = { params: Promise.resolve({ id: 'emp' }) }
  assert.equal((await employeeRoute.PATCH({ json: async () => ({ isActive: false }) }, params)).status, 409)
  assert.equal((await employeeRoute.DELETE({}, params)).status, 409)

  const requests = load('src/app/api/kintai/requests/route.ts', { ...common,
    '@/lib/kintai/access': { getKintaiContext: async () => inactive, hasMinRole: access.hasMinRole },
  })
  assert.equal((await requests.POST({ json: async () => ({ type: 'leave' }) })).status, 403)
  const requestById = load('src/app/api/kintai/requests/[id]/route.ts', { ...common,
    '@/lib/kintai/access': { getKintaiContext: async () => inactive, hasMinRole: access.hasMinRole },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => {} },
    '@/lib/kintai/manager-admission': load('src/lib/kintai/manager-admission.ts'),
    '@/lib/kintai/recalculate': { recalculateDayForEmployee: async () => {} },
    '@/lib/kintai/shift-records': { openShiftStart: () => {} },
  })
  assert.equal((await requestById.PATCH({ json: async () => ({ status: 'approved' }) }, { params: Promise.resolve({ id: 'request' }) })).status, 403)
  assert.equal(writes, 0)
  console.log('Kintai disabled access: PASS')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
