const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const revision = load('src/lib/kintai/work-rule-revision.ts', {'node:crypto': require('node:crypto')})
const manager = load('src/lib/kintai/manager-admission.ts')

function fixture({ actorRole = 'hr_admin', employeeCount = 0 } = {}) {
  const rows = new Map([['rule', { id: 'rule', organizationId: 'org', name: 'Standard' }]])
  const order = []
  const receipts = new Map()
  let writes = 0
  const tx = {
    $executeRaw: async () => 1,
    systemSetting: { upsert: async ({where,create,update}) => { const data=receipts.has(where.key)?{...receipts.get(where.key),...update}:create;receipts.set(where.key,data);return data }, findUnique: async ({where}) => receipts.get(where.key) || null, create: async ({data}) => { receipts.set(data.key,data); return data } },
    $queryRaw: async () => { order.push('actor'); return [{ role: actorRole, status: 'ACTIVE', isActive: true }] },
    kintaiWorkRule: {
      findFirst: async ({ where }) => rows.get(where.id)?.organizationId === where.organizationId ? rows.get(where.id) : null,
      create: async ({ data }) => { writes++; const row = { id: 'new', ...data }; rows.set('new', row); return row },
      update: async ({ where, data }) => { writes++; const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row },
      delete: async ({ where }) => { writes++; rows.delete(where.id); return { id: where.id } },
    },
    kintaiEmployee: { count: async () => employeeCount },
  }
  const prisma = { $transaction: async work => work(tx) }
  const deps = {
    '@/lib/kintai/work-rule-revision': revision,
    '@/lib/kintai/work-rule-operation': load('src/lib/kintai/work-rule-operation.ts', {'node:crypto': require('node:crypto')}),
    '@/lib/kintai/work-rule-input': load('src/lib/kintai/work-rule-input.ts'),
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/kintai/access': {
      getKintaiContext: async () => ({ organizationId: 'org', userId: 'actor', memberId: 'actor-member', role: 'hr_admin' }),
      hasMinRole: () => true,
    },
    '@/lib/kintai/employee-admission': { lockKintaiEmployeeAdmission: async () => { order.push('organization') } },
    '@/lib/kintai/manager-admission': manager,
  }
  const list = load('src/app/api/kintai/work-rules/route.ts', deps)
  const item = load('src/app/api/kintai/work-rules/[id]/route.ts', deps)
  const request = (body,id='rule') => ({ url: 'https://example.invalid/api/kintai/work-rules', json: async () => ({ operationId:'10000000-0000-4000-8000-000000000001', organizationId:'org', expectedRevision:(await revision.withKintaiWorkRuleRevision(tx,rows.get(id)||rows.get('rule'))).revision, ...body }) })
  const context = id => ({ params: Promise.resolve({ id }) })
  const deleteRequest = async (id='rule') => ({url:'https://example.invalid/api/kintai/work-rules/'+id+'?organizationId=org&expectedRevision='+(await revision.withKintaiWorkRuleRevision(tx,rows.get(id)||rows.get('rule'))).revision})
  return { deleteRequest, list, item, request, context, rows, order, get writes() { return writes } }
}

;(async () => {
  await check('revoked manager cannot create, edit, or delete a work rule', async () => {
    const f = fixture({ actorRole: 'employee' })
    assert.equal((await f.list.POST(f.request({ name: 'New' }))).status, 403)
    assert.equal((await f.item.PATCH(f.request({ name: 'Changed' }), f.context('rule'))).status, 403)
    assert.equal((await f.item.DELETE(await f.deleteRequest(), f.context('rule'))).status, 403)
    assert.equal(f.writes, 0)
    assert.deepEqual(f.order, ['organization', 'actor', 'organization', 'actor', 'organization', 'actor'])
  })

  await check('foreign work rule and occupied work rule cannot be changed', async () => {
    const f = fixture({ employeeCount: 1 })
    assert.equal((await f.item.PATCH(f.request({ name: 'Changed' }), f.context('foreign'))).status, 404)
    assert.equal((await f.item.DELETE(await f.deleteRequest(), f.context('foreign'))).status, 404)
    assert.equal((await f.item.DELETE(await f.deleteRequest(), f.context('rule'))).status, 400)
    assert.equal(f.writes, 0)
  })

  await check('valid work rule mutations still work', async () => {
    const f = fixture()
    assert.equal((await f.list.POST(f.request({ name: 'New' }))).status, 201)
    assert.equal((await f.item.PATCH(f.request({ name: 'Updated' },'new'), f.context('new'))).status, 200)
    assert.equal((await f.item.DELETE(await f.deleteRequest('new'), f.context('new'))).status, 200)
    assert.equal(f.writes, 3)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
