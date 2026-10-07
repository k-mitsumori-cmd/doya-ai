const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const { adaptTimePrisma, operationId } = require('./promane-time-creation-fixture.cjs')
const clientCreation = load('src/lib/promane/client-creation.ts', { 'node:crypto': require('node:crypto') })
const clientInput = load('src/lib/promane/client-input.ts')

function fixture({ role = 'member', revokeDuringCommit = false, foreign = false } = {}) {
  let currentRole = role
  let attempts = 0
  let writes = 0
  let committed = false
  const prisma = {
    $transaction: async function (fn, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const result = await fn(this)
      if (revokeDuringCommit && attempts === 1) {
        currentRole = 'guest'
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committed = true
      return result
    },
    promaneWorkspace: { findFirst: async ({ where }) =>
      where.members.some.role.in.includes(currentRole) ? { id: 'w' } : null },
    promaneMember: { findFirst: async ({ where }) =>
      where.role.in.includes(currentRole) ? { id: 'actor' } : null },
    promaneClient: {
      create: async ({ data }) => { writes++; return { id: 'client', ...data } },
      updateMany: async ({ where }) => { assert.equal(where.workspaceId, 'w'); writes++; return { count: foreign ? 0 : 1 } },
      deleteMany: async ({ where }) => { assert.equal(where.workspaceId, 'w'); writes++; return { count: foreign ? 0 : 1 } },
      findFirst: async () => ({ id: 'client', name: '更新後' }),
    },
  }
  const actions = load('src/lib/promane/actions-clients.ts', {
    './client-creation': clientCreation, './client-input': clientInput,
    '@/lib/prisma': { prisma: adaptTimePrisma(prisma) },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'u' }),
      requireWritableWorkspace: async () => ({ id: 'w' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  const api = load('src/app/api/promane/clients/route.ts', {
    '@/lib/promane/client-creation': clientCreation, '@/lib/promane/client-input': clientInput,
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma: adaptTimePrisma(prisma) },
  })
  return {
    create: () => actions.createClient('ws', { operationId, name: '会社' }),
    update: () => actions.updateClient('ws', 'client', { name: '更新後' }),
    delete: () => actions.deleteClient('ws', 'client'),
    apiPost: () => api.POST({ json: async () => ({ operationId, workspaceSlug: 'ws', name: '会社' }) }),
    apiDelete: () => api.DELETE({ nextUrl: new URL('https://example.test/api/promane/clients?workspaceSlug=ws&id=client') }),
    state: () => ({ attempts, writes, committed }),
  }
}

;(async () => {
  await check('client actions and API accept current writable members', async () => {
    for (const method of ['create', 'update', 'delete', 'apiPost', 'apiDelete']) {
      const f = fixture()
      const result = await f[method]()
      if (method.startsWith('api')) assert.equal(result.status, 200)
      assert.deepEqual(f.state(), { attempts: 1, writes: 1, committed: true })
    }
  })
  await check('guest access is rejected before client writes', async () => {
    for (const method of ['create', 'update', 'delete', 'apiPost', 'apiDelete']) {
      const f = fixture({ role: 'guest' })
      if (method.startsWith('api')) assert.equal((await f[method]()).status, 403)
      else await assert.rejects(f[method](), /変更権限がありません/)
      assert.deepEqual(f.state(), { attempts: 1, writes: 0, committed: method === 'apiDelete' })
    }
  })
  await check('revocation during a conflicting client write is rechecked', async () => {
    for (const method of ['create', 'update', 'delete', 'apiPost', 'apiDelete']) {
      const f = fixture({ revokeDuringCommit: true })
      if (method.startsWith('api')) assert.equal((await f[method]()).status, 403)
      else await assert.rejects(f[method](), /変更権限がありません/)
      assert.deepEqual(f.state(), { attempts: 2, writes: 1, committed: method === 'apiDelete' })
    }
  })
  await check('foreign client cannot be updated or deleted', async () => {
    for (const method of ['update', 'delete', 'apiDelete']) {
      const f = fixture({ foreign: true })
      if (method.startsWith('api')) assert.equal((await f[method]()).status, 404)
      else await assert.rejects(f[method](), /顧客が見つかりません/)
      assert.equal(f.state().writes, 1)
    }
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
