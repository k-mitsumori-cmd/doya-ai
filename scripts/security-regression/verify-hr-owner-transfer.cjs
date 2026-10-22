const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const { state } = require('./hr-membership-fixture-bridge.cjs')
const { createHash } = require('node:crypto')
const Prisma = {
  raw: value => value,
  sql(strings, ...values) { return { text: strings.join('?'), values } },
}
const types = load('src/lib/hr/owner-transfer/types.ts', { 'node:crypto': { createHash }, '@/lib/account-lifecycle/state': state })
const receipt = load('src/lib/hr/owner-transfer/receipt.ts', { './types': types, '@/lib/account-lifecycle/state': state })
const selection = load('src/lib/hr/organization-selection.ts')
const operation = '123e4567-e89b-42d3-a456-426614174000'
const secondOperation = '123e4567-e89b-42d3-a456-426614174001'
const input = { expectedOwnerMemberId: 'actor', targetMemberId: 'target', targetUserId: 'user-target', targetRole: 'ADMIN', targetPlan: 'PRO' }
const headers = new Headers({ 'X-HR-Selected-Actor': 'user-actor', 'X-HR-Selected-Organization': 'org', 'X-HR-Organization-Id': 'org' })
const request = (body, h = headers) => ({ url: 'https://example.invalid/api/hr/organization/transfer-owner', headers: h, text: async () => JSON.stringify(body) })
function scenario({ duplicateOwner = false } = {}) {
  const rows = [
    { id: 'actor', userId: 'user-actor', role: 'OWNER', status: 'ACTIVE', name: null },
    { id: 'target', userId: 'user-target', role: 'ADMIN', status: 'ACTIVE', name: null },
    ...(duplicateOwner ? [{ id: 'other-owner', userId: 'third', role: 'OWNER', status: 'ACTIVE', name: null }] : []),
  ]
  const settings = new Map()
  let writes = 0, userLocks = 0, fenceChecks = 0
  const userLockTrace = []
  const query = async sql => {
    const text = sql.text || sql.join('?')
    const values = sql.values || []
    if (text.includes('pg_advisory_xact_lock')) return [{ locked: 1 }]
    if (text.includes('SELECT id, slug, name')) return [{ id: 'org', slug: 'long-slug', name: 'Org' }]
    if (text.includes('NULL::text AS name')) return rows.map(row => ({ ...row }))
    if (text.includes('hr_organizations') || values.includes('hr_organizations')) return [{ id: 'org' }]
    if (text.includes('hr_organization_members') || values.includes('hr_organization_members')) return rows.map(row => ({ id: row.id }))
    throw Error('Unknown SQL ' + text)
  }
  const db = {
    $queryRaw: query,
    $transaction: async (work, options) => {
      assert.ok(['ReadCommitted', 'Serializable'].includes(options.isolationLevel))
      const beforeRows = structuredClone(rows), beforeSettings = new Map(settings), beforeWrites = writes
      try { return await work(db) }
      catch (error) { rows.splice(0, rows.length, ...beforeRows); settings.clear(); for (const [key, value] of beforeSettings) settings.set(key, value); writes = beforeWrites; throw error }
    },
    $executeRaw: async sql => {
      const text = sql.text || sql.join('?')
      const row = rows.find(item => item.id === (text.includes("role = 'ADMIN'") ? 'actor' : 'target'))
      if (text.includes("role = 'ADMIN'")) { if (row.role !== 'OWNER') return 0; row.role = 'ADMIN' }
      else if (text.includes("role = 'OWNER'")) { if (row.role !== 'ADMIN') return 0; row.role = 'OWNER' }
      else throw Error('Unknown write SQL ' + text)
      writes++
      return 1
    },
    systemSetting: { findUnique: async ({ where }) => settings.has(where.key) ? { value: settings.get(where.key) } : null,
      create: async ({ data }) => { assert.equal(settings.has(data.key), false); settings.set(data.key, data.value); return data } },
    user: { findUnique: async ({ where }) => where.id === 'user-target' ? { id: 'user-target', plan: 'PRO' } : { id: 'user-actor' },
      findMany: async () => [{ id: 'user-actor' }, { id: 'user-target' }] },
  }
  const store = load('src/lib/hr/owner-transfer/store.ts', {
    '@prisma/client': { Prisma }, '@/lib/prisma': { prisma: db },
    '@/lib/account-lifecycle/store': {
      lockLifecycleUsers: async (_tx, ids) => {
        userLocks++
        const actual = [...ids]
        assert.deepEqual(actual, [...actual].sort())
        assert.ok([
          'user-actor',
          'user-actor,user-target',
          'third,user-actor,user-target',
        ].includes(actual.join(',')))
        userLockTrace.push(actual)
      },
      assertRetirementMembershipWritable: async () => { fenceChecks++ },
    },
    './types': types, './receipt': receipt,
  })
  const route = load('src/app/api/hr/organization/transfer-owner/route.ts', {
    'next-auth': { getServerSession: async () => ({ user: { id: 'user-actor' } }) },
    '@/lib/auth': { authOptions: {} }, '@/lib/account-lifecycle/state': state,
    '@/lib/hr/organization-selection': selection, '@/lib/hr/owner-transfer/store': store,
    '@/lib/hr/owner-transfer/types': types,
  })
  const transfer = (id = operation) => route.POST(request({ action: 'transfer', expectedActor: 'user-actor', orgId: 'org', operationId: id, input }))
  const status = id => route.GET({ ...request(null), url: request(null).url + `?action=status&expectedActor=user-actor&orgId=org&operationId=${id}` })
  return { rows, transfer, status, count: () => writes, locks: () => userLocks, lockTrace: () => userLockTrace, fences: () => fenceChecks, receipts: () => settings.size }
}
;(async () => {
  await check('transfer changes exactly one owner; same-ID replay is durable and new-ID stale owner is rejected', async () => {
    const transfer = scenario()
    assert.equal((await transfer.transfer()).status, 200)
    assert.equal(transfer.rows.find(row => row.id === 'actor').role, 'ADMIN')
    assert.equal(transfer.rows.find(row => row.id === 'target').role, 'OWNER')
    assert.equal(transfer.count(), 2)
    assert.equal(transfer.receipts(), 1)
    assert.equal((await transfer.transfer()).status, 200)
    assert.equal((await transfer.status(operation)).status, 200)
    assert.equal(transfer.count(), 2)
    assert.equal((await transfer.transfer(secondOperation)).status, 409)
    assert.equal(transfer.count(), 2)
    assert.equal(transfer.receipts(), 1)
    assert.ok(transfer.locks() >= 3)
    assert.deepEqual(transfer.lockTrace(), [
      ['user-actor'], ['user-actor', 'user-target'],
      ['user-actor'], ['user-actor'],
      ['user-actor', 'user-target'],
    ])
    assert.ok(transfer.fences() >= 1)
  })
  await check('transfer refuses an organization with multiple active owners', async () => {
    const transfer = scenario({ duplicateOwner: true })
    assert.equal((await transfer.transfer()).status, 409)
    assert.equal(transfer.count(), 0)
    assert.equal(transfer.receipts(), 0)
  })
  console.log(JSON.stringify({ passed: results.length, results, scope: 'actual HR route/types/receipt/store; synthetic Prisma rows and lifecycle lock/fence leaves' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
