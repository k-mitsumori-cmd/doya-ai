const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const { workspaceApi } = require('./promane-workspace-operation-fixture.cjs')

function fixture({ tier = 'FREE', used = 0, named = 'Team', fail = false, settings = [] } = {}) {
  let writes = 0
  let locks = 0
  const maxWorkspaces = { FREE: 1, LIGHT: 3, PRO: 10, ENTERPRISE: -1 }[tier]
  const tx = {
    $queryRaw: async () => { locks++; return [{ id: 'u' }] },
    user: { findUnique: async () => ({ name: 'Owner' }) },
    promaneWorkspace: { create: async ({ data }) => {
      if (fail) throw Error('PRIVATE_DB_DETAIL')
      writes++
      return { id: 'w', slug: data.slug, name: data.name, userId: 'u', updatedAt: new Date('2026-09-30T00:00:00.000Z') }
    } },
  }
  const prisma = { $transaction: async fn => fn(tx) }
  const fixtureApi = workspaceApi({ prisma, settings, limits: {
    getUserPromaneLimits: async (id, db) => { assert.equal(id, 'u'); assert.equal(db.user, tx.user); assert.ok(locks > 0); return { tier, maxWorkspaces } },
    countUserWorkspaces: async (id, db) => { assert.equal(id, 'u'); assert.equal(db.promaneWorkspace, tx.promaneWorkspace); return used },
  } })
  const api = fixtureApi.create
  return { run: async () => {
    const response = await api.POST({ json: async () => ({ name: named, ...fixtureApi.intent() }) })
    return { status: response.status, body: await response.json() }
  }, state: () => ({ writes, locks }), recover: fixtureApi.recover, receiptSnapshot: fixtureApi.receiptSnapshot }
}

;(async () => {
  await check('workspace quota is checked under the user lock before writing', async () => {
    const f = fixture({ used: 1 })
    const result = await f.run()
    assert.equal(result.status, 403)
    assert.equal(result.body.code, 'LIMIT_REACHED')
    assert.equal(result.body.upgradeUrl, '/promane/pricing')
    assert.deepEqual(f.state(), { writes: 0, locks: 1 })
  })
  await check('paid PRO limit offers contact rather than another paid upgrade', async () => {
    const result = await fixture({ tier: 'PRO', used: 10 }).run()
    assert.equal(result.status, 403)
    assert.equal(result.body.upgradeUrl, undefined)
    assert.match(result.body.contactUrl, /contact/)
  })
  await check('available and unlimited plans create once inside the transaction', async () => {
    for (const options of [{ used: 0 }, { tier: 'ENTERPRISE', used: 99 }]) {
      const f = fixture(options)
      const result = await f.run()
      assert.equal(result.status, 200)
      assert.equal(result.body.workspace.name, 'Team')
      assert.deepEqual(f.state(), { writes: 1, locks: 1 })
    }
  })
  await check('non-string workspace names never consume a slot', async () => {
    for (const named of [123, { label: 'Team' }, ['Team'], true, null]) {
      const f = fixture({ named })
      const result = await f.run()
      assert.equal(result.status, 400)
      assert.deepEqual(f.state(), { writes: 0, locks: 0 })
    }
  })
  await check('database errors do not expose internal details', async () => {
    const result = await fixture({ fail: true }).run()
    assert.equal(result.status, 500)
    assert.ok(!result.body.error.includes('PRIVATE_DB_DETAIL'))
  })
  await check('invited memberships do not consume owned workspace quota', async () => {
    const limits = load('src/lib/promane/limits.ts', {
      '@/lib/prisma': { prisma: {
        promaneWorkspace: { count: async ({ where }) => { assert.equal(where.userId, 'u'); return 1 } },
        promaneMember: { count: async () => { throw Error('invited membership was counted') } },
      } },
      '@/lib/plan-utils': { tierFrom: () => 'FREE' },
    })
    assert.equal(await limits.countUserWorkspaces('u'), 1)
  })
  await check('first-visit workspace creation is idempotent and never reactivates disabled access', async () => {
    let created = 0
    let locked = false
    let active = null
    let owned = null
    const tx = {
      $queryRaw: async () => { locked = true; return [{ id: 'u' }] },
      systemSetting: { findUnique: async () => null },
      promaneMember: { findFirst: async () => { assert.ok(locked); return active } },
      promaneWorkspace: {
        findFirst: async () => owned,
        create: async ({ data }) => { created++; active = { workspace: { id: 'w', slug: data.slug } }; return active.workspace },
      },
      user: { findUnique: async () => ({ name: 'Owner' }) },
    }
    const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
    const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': require('node:crypto'), '@prisma/client': { Prisma: require('@prisma/client').Prisma }, './state': state })
    const operation = load('src/lib/promane/workspace-operation.ts', { 'node:crypto': require('node:crypto') })
    const auth = load('src/lib/promane/auth.ts', {
      'next-auth': { getServerSession: async () => null },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } },
      'next/navigation': { redirect() {} },
      crypto: require('node:crypto'),
      '@/lib/account-lifecycle/store': store,
      './workspace-operation': operation,
    })
    assert.equal((await auth.getOrCreateWorkspace('u')).id, 'w')
    assert.equal((await auth.getOrCreateWorkspace('u')).id, 'w')
    assert.equal(created, 1)
    active = null
    owned = { id: 'w', slug: 'ws-w' }
    assert.equal(await auth.getOrCreateWorkspace('u'), null)
    assert.equal(created, 1)
  })
  await check('first setup retries only whole Serializable transactions with a fresh User lock', async () => {
    const crypto = require('node:crypto')
    const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
    const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma: require('@prisma/client').Prisma }, './state': state })
    const operation = load('src/lib/promane/workspace-operation.ts', { 'node:crypto': crypto })
    const serial = code => Object.assign(new Error('synthetic transaction conflict'), { code })
    const raw = code => Object.assign(serial('P2010'), { meta: { code } })
    const allowed = [[serial('P2034')], [raw('40001')], [raw('40P01')]]
    const rejected = [[raw('23505')], [serial('P2010')], [serial('P2003')]]
    for (const faults of [...allowed, ...rejected]) {
      let transactions = 0, locks = 0, created = 0
      const tx = {
        $queryRaw: async () => { locks++; return [{ id: 'u' }] },
        systemSetting: { findUnique: async () => null },
        promaneMember: { findFirst: async () => null },
        promaneWorkspace: {
          findFirst: async () => null,
          create: async () => { created++; return { id: 'workspace' } },
        },
        user: { findUnique: async () => ({ name: 'Owner' }) },
      }
      const auth = load('src/lib/promane/auth.ts', {
        'next-auth': { getServerSession: async () => null }, '@/lib/auth': {},
        '@/lib/prisma': { prisma: { $transaction: async (work, options) => {
          transactions++
          assert.equal(options.isolationLevel, 'Serializable')
          const fault = faults[transactions - 1]
          if (fault) throw fault
          return work(tx)
        } } },
        'next/navigation': { redirect() {} }, crypto,
        '@/lib/account-lifecycle/store': store, './workspace-operation': operation,
      })
      if (allowed.includes(faults)) {
        assert.equal((await auth.getOrCreateWorkspace('u')).id, 'workspace')
        assert.equal(transactions, 2)
        assert.equal(locks, 1)
        assert.equal(created, 1)
      } else {
        await assert.rejects(auth.getOrCreateWorkspace('u'), error => error === faults[0])
        assert.equal(transactions, 1)
        assert.equal(locks, 0)
        assert.equal(created, 0)
      }
    }
  })
  await check('actual create/recover HTTP reports typed retirement conflict without workspace or cancel receipt', async () => {
    const crypto = require('node:crypto')
    const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
    const operationId = crypto.randomUUID(), generation = crypto.randomUUID()
    const identity = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: 'u', operationId, kind: 'retirement' }
    const receipt = { version: 2, targetHash: state.lifecycleSubject('u'), operationId, operator: identity.operator,
      kind: 'retirement', inputDigest: 'a'.repeat(64), generation, token: crypto.randomUUID(), revision: 0,
      phase: 'reserved', reason: null, createdAt: '2026-10-22T00:00:00.000Z', updatedAt: '2026-10-22T00:00:00.000Z' }
    const settings = [
      [state.lifecycleFenceKey('u'), JSON.stringify({ version: 2, operationId, generation, kind: 'retirement', state: 'active' })],
      [state.lifecycleReceiptKey(identity), JSON.stringify(receipt)],
    ]
    const f = fixture({ settings })
    const before = f.receiptSnapshot()
    const create = await f.run()
    assert.equal(create.status, 409)
    assert.equal(create.body.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    assert.equal(f.state().writes, 0)
    const missingOperation = crypto.randomUUID()
    const request = { json: async () => ({ mode: 'create', workspaceId: null, operationId: missingOperation, expectedUserId: 'u', cancelIfMissing: true }) }
    const cancel = await f.recover.POST(request)
    assert.equal(cancel.status, 409)
    assert.equal((await cancel.json()).code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
    const status = await f.recover.POST({ json: async () => ({ ...await request.json(), cancelIfMissing: false }) })
    assert.equal(status.status, 200)
    assert.equal((await status.json()).state, 'missing')
    assert.equal(f.state().writes, 0)
    assert.deepEqual(f.receiptSnapshot(), before)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
