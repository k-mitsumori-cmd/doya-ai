const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const ranks = { employee: 0, manager: 1, hr_admin: 2, system_admin: 3 }

function fixture(options = {}) {
  const request = {
    id: 'request', employeeId: 'subject', employee: { organizationId: 'org' },
    status: 'pending', type: 'leave', details: {},
  }
  const context = {
    memberId: 'member', userId: 'user', employeeId: 'actor',
    organizationId: 'org', role: options.cachedRole || 'hr_admin',
  }
  let writes = 0
  let admissionLocks = 0
  let actorQuery
  const db = {
    $queryRaw: async (strings, ...values) => {
      actorQuery = { sql: strings.join('?'), values }
      return [{
        role: options.currentRole || context.role,
        status: options.memberStatus || 'ACTIVE',
        isActive: options.employeeActive !== false,
      }]
    },
    kintaiRequest: {
      findUnique: async () => request,
      updateMany: async ({ data }) => {
        writes++
        Object.assign(request, data)
        return { count: 1 }
      },
    },
    kintaiEmployee: {
      findUnique: async ({ where }) => ({
        organizationId: 'org',
        departmentId: where.id === 'actor' ? (options.actorDepartment || 'sales') : 'sales',
      }),
    },
  }
  const prisma = { ...db, $transaction: async fn => fn(db) }
  const managerAdmission = load('src/lib/kintai/manager-admission.ts')
  const route = load('src/app/api/kintai/requests/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/kintai/access': {
      getKintaiContext: async () => context,
      hasMinRole: (role, minimum) => ranks[role] >= ranks[minimum],
    },
    '@/lib/kintai/employee-admission': {
      lockKintaiEmployeeAdmission: async () => { admissionLocks++ },
    },
    '@/lib/kintai/manager-admission': managerAdmission,
    '@/lib/kintai/recalculate': { recalculateDayForEmployee: async () => {} },
    '@/lib/kintai/shift-records': { openShiftStart: () => null },
  })
  return {
    act: () => route.PATCH({ json: async () => ({ status: 'rejected' }) }, { params: Promise.resolve({ id: 'request' }) }),
    writes: () => writes,
    admissionLocks: () => admissionLocks,
    actorQuery: () => actorQuery,
  }
}

async function main() {
  for (const [name, options] of [
    ['管理権限剥奪', { cachedRole: 'hr_admin', currentRole: 'employee' }],
    ['所属停止', { memberStatus: 'INACTIVE' }],
    ['従業員無効化', { employeeActive: false }],
    ['部署移動', { cachedRole: 'manager', actorDepartment: 'other' }],
  ]) {
    const caseFixture = fixture(options)
    assert.equal((await caseFixture.act()).status, 403, name)
    assert.equal(caseFixture.writes(), 0, name)
    assert.equal(caseFixture.admissionLocks(), 1, name)
    console.log('PASS', name)
  }
  const valid = fixture({ cachedRole: 'manager' })
  assert.equal((await valid.act()).status, 200)
  assert.equal(valid.writes(), 1)
  assert.match(valid.actorQuery().sql, /e\.id = \?/)
  assert.match(valid.actorQuery().sql, /e\."organizationId" = \?/)
  assert.deepEqual(valid.actorQuery().values, ['member', 'org', 'user', 'actor', 'org'])
  console.log('PASS 現在も同部署の管理者')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
