const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ tier = 'FREE', used = 0, named = 'Team', fail = false } = {}) {
  let writes = 0
  let locks = 0
  const maxWorkspaces = { FREE: 1, LIGHT: 3, PRO: 10, ENTERPRISE: -1 }[tier]
  const tx = {
    $queryRaw: async () => { locks++; return [{ id: 'u' }] },
    user: { findUnique: async () => ({ name: 'Owner' }) },
    promaneWorkspace: { create: async ({ data }) => {
      if (fail) throw Error('PRIVATE_DB_DETAIL')
      writes++
      return { id: 'w', slug: data.slug, name: data.name }
    } },
  }
  const prisma = { $transaction: async fn => fn(tx) }
  const api = load('src/app/api/promane/workspaces/create/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/promane/limits': {
      getUserPromaneLimits: async (id, db) => { assert.equal(id, 'u'); assert.equal(db, tx); assert.ok(locks > 0); return { tier, maxWorkspaces } },
      countUserWorkspaces: async (id, db) => { assert.equal(id, 'u'); assert.equal(db, tx); return used },
    },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    crypto: require('node:crypto'),
  })
  return { run: async () => {
    const response = await api.POST({ json: async () => ({ name: named }) })
    return { status: response.status, body: await response.json() }
  }, state: () => ({ writes, locks }) }
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
      promaneMember: { findFirst: async () => { assert.ok(locked); return active } },
      promaneWorkspace: {
        findFirst: async () => owned,
        create: async ({ data }) => { created++; active = { workspace: { id: 'w', slug: data.slug } }; return active.workspace },
      },
      user: { findUnique: async () => ({ name: 'Owner' }) },
    }
    const auth = load('src/lib/promane/auth.ts', {
      'next-auth': { getServerSession: async () => null },
      '@/lib/auth': {},
      '@/lib/prisma': { prisma: { $transaction: async fn => fn(tx) } },
      'next/navigation': { redirect() {} },
      crypto: require('node:crypto'),
    })
    assert.equal((await auth.getOrCreateWorkspace('u')).id, 'w')
    assert.equal((await auth.getOrCreateWorkspace('u')).id, 'w')
    assert.equal(created, 1)
    active = null
    owned = { id: 'w', slug: 'ws-w' }
    assert.equal(await auth.getOrCreateWorkspace('u'), null)
    assert.equal(created, 1)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
