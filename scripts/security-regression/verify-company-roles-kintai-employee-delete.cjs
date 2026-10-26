// 勤怠の社員の無効化（DELETE）と、招待中のメール変更（PATCH）の決まりを確かめる。
// 仕様: ROLES-2026-10-26.md §2.1（hr_admin どうしで互いを無効化し合えない）
const { load, check } = require('./load-typescript.cjs')
const assert = require('node:assert/strict')

const types = load('src/lib/kintai/types.ts')
const access = load('src/lib/kintai/access.ts', { './types': types, 'next-auth': {}, '@/lib/auth': {}, '@/lib/prisma': {} })
const manager = load('src/lib/kintai/manager-admission.ts')

function makeApi({ actorRole, actorEmployeeId = 'actor-emp', target }) {
  const state = { employee: { ...target }, memberUpdates: [], employeeUpdates: [] }
  const tx = {
    $queryRaw: async () => [{ role: actorRole, status: 'ACTIVE', isActive: true }],
    kintaiEmployee: {
      findFirst: async ({ where }) => (where.id === state.employee.id ? structuredClone(state.employee) : null),
      update: async ({ data }) => {
        state.employeeUpdates.push(data)
        state.employee = { ...state.employee, ...data }
        return structuredClone(state.employee)
      },
    },
    kintaiMember: {
      count: async () => 1,
      update: async ({ data }) => {
        state.memberUpdates.push(data)
        return {}
      },
    },
    kintaiDepartment: { findFirst: async () => null },
    kintaiWorkRule: { findFirst: async () => null },
  }
  const prisma = { $transaction: async (fn) => fn(tx) }
  const api = load('src/app/api/kintai/employees/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/kintai/access': {
      getKintaiContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'actor-member', employeeId: actorEmployeeId, role: actorRole }),
      hasMinRole: access.hasMinRole,
    },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => {}, reachedKintaiEmployeeLimit: async () => null, kintaiEmployeeLimitPayload: () => ({}) },
    '@/lib/kintai/manager-admission': manager,
  })
  return { api, state }
}

const target = (role, extra = {}) => ({ id: 'target', organizationId: 'org', email: 'old@example.com', isActive: true, member: { id: 'tm', role, status: 'ACTIVE' }, ...extra })
const del = (api) => api.DELETE({}, { params: Promise.resolve({ id: 'target' }) })
const patch = (api, body) => api.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'target' }) })

;(async () => {
  await check('hr_admin は同じ hr_admin を DELETE で無効化できない（403）', async () => {
    const { api, state } = makeApi({ actorRole: 'hr_admin', target: target('hr_admin') })
    assert.equal((await del(api)).status, 403)
    assert.equal(state.employeeUpdates.length, 0)
  })
  await check('hr_admin は自分自身を DELETE できない（403）', async () => {
    const { api, state } = makeApi({ actorRole: 'hr_admin', actorEmployeeId: 'target', target: target('hr_admin') })
    assert.equal((await del(api)).status, 403)
    assert.equal(state.employeeUpdates.length, 0)
  })
  for (const role of ['employee', 'manager']) {
    await check(`hr_admin は ${role} を無効化できる（200）`, async () => {
      const { api, state } = makeApi({ actorRole: 'hr_admin', target: target(role) })
      assert.equal((await del(api)).status, 200)
      assert.equal(JSON.stringify(state.employeeUpdates), JSON.stringify([{ isActive: false }]))
    })
  }
  await check('system_admin は hr_admin を無効化できる（200）', async () => {
    const { api, state } = makeApi({ actorRole: 'system_admin', target: target('hr_admin') })
    assert.equal((await del(api)).status, 200)
    assert.equal(JSON.stringify(state.employeeUpdates), JSON.stringify([{ isActive: false }]))
  })
  await check('system_admin の席は 409 で無効化できない', async () => {
    const { api, state } = makeApi({ actorRole: 'system_admin', target: target('system_admin') })
    assert.equal((await del(api)).status, 409)
    assert.equal(state.employeeUpdates.length, 0)
  })
  await check('招待中の社員のメールを直すと、招待の宛先が新しいメールになり、招待リンクが使えなくなる', async () => {
    const { api, state } = makeApi({ actorRole: 'system_admin', target: target('employee', { member: { id: 'tm', role: 'employee', status: 'INVITED', inviteToken: 'tok' } }) })
    const r = await patch(api, { email: 'new@example.com' })
    assert.equal(r.status, 200)
    assert.equal(JSON.stringify(state.memberUpdates), JSON.stringify([{ inviteEmail: 'new@example.com', inviteToken: null }]))
  })
  await check('参加済み（ACTIVE）の社員のメールを直しても、招待の行は書き換えない', async () => {
    const { api, state } = makeApi({ actorRole: 'system_admin', target: target('employee') })
    assert.equal((await patch(api, { email: 'new@example.com' })).status, 200)
    assert.equal(state.memberUpdates.length, 0)
  })
  console.log('verify-company-roles-kintai-employee-delete: OK')
})().catch((e) => { console.error(e); process.exitCode = 1 })
