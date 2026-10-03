const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const integrity = load('src/lib/department-integrity.ts')
const manager = load('src/lib/kintai/manager-admission.ts')

function fixture({ actorRole = 'hr_admin', employeeCount = 0 } = {}) {
  const rows = new Map([
    ['root', { id: 'root', organizationId: 'org', name: 'Root', parentId: null }],
    ['child', { id: 'child', organizationId: 'org', name: 'Child', parentId: 'root' }],
  ])
  const order = []
  let writes = 0
  const tx = {
    $queryRaw: async () => { order.push('actor'); return [{ role: actorRole, status: 'ACTIVE', isActive: true }] },
    kintaiDepartment: {
      findFirst: async ({ where }) => rows.get(where.id)?.organizationId === where.organizationId ? rows.get(where.id) : null,
      create: async ({ data }) => { writes++; const row = { id: 'new', ...data }; rows.set('new', row); return row },
      update: async ({ where, data }) => { writes++; const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row },
      delete: async ({ where }) => { writes++; rows.delete(where.id); return { id: where.id } },
    },
    kintaiEmployee: {
      findFirst: async () => null,
      count: async () => employeeCount,
    },
  }
  const prisma = { $transaction: async work => work(tx) }
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/department-integrity': integrity,
    '@/lib/kintai/access': {
      getKintaiContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'actor-member', role: 'hr_admin' }),
      hasMinRole: () => true,
    },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => { order.push('organization') } },
    '@/lib/kintai/manager-admission': manager,
  }
  const list = load('src/app/api/kintai/departments/route.ts', deps)
  const item = load('src/app/api/kintai/departments/[id]/route.ts', deps)
  const request = body => ({ json: async () => body })
  const context = id => ({ params: Promise.resolve({ id }) })
  return { list, item, request, context, rows, order, get writes() { return writes } }
}

;(async () => {
  await check('revoked manager cannot create, edit, or delete a department', async () => {
    const f = fixture({ actorRole: 'employee' })
    assert.equal((await f.list.POST(f.request({ name: 'New' }))).status, 403)
    assert.equal((await f.item.PATCH(f.request({ name: 'Changed' }), f.context('root'))).status, 403)
    assert.equal((await f.item.DELETE({}, f.context('root'))).status, 403)
    assert.equal(f.writes, 0)
    assert.deepEqual(f.order, ['organization', 'actor', 'organization', 'actor', 'organization', 'actor'])
  })

  await check('department parent cycle and foreign target fail before writes', async () => {
    const f = fixture()
    assert.equal((await f.item.PATCH(f.request({ parentId: 'child' }), f.context('root'))).status, 400)
    assert.equal((await f.item.PATCH(f.request({ name: 'Changed' }), f.context('foreign'))).status, 404)
    assert.equal((await f.list.POST(f.request({ name: 'New', parentId: 'foreign' }))).status, 400)
    assert.equal(f.writes, 0)
  })

  await check('in-use department cannot be deleted and valid mutations still work', async () => {
    const blocked = fixture({ employeeCount: 1 })
    assert.equal((await blocked.item.DELETE({}, blocked.context('root'))).status, 400)
    assert.equal(blocked.writes, 0)
    const f = fixture()
    assert.equal((await f.list.POST(f.request({ name: ' New ', parentId: 'root' }))).status, 201)
    assert.equal(f.rows.get('new').name, 'New')
    assert.equal((await f.item.PATCH(f.request({ name: 'Updated' }), f.context('new'))).status, 200)
    assert.equal((await f.item.DELETE({}, f.context('new'))).status, 200)
    assert.equal(f.writes, 3)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
