const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture({ actorRole = 'manager', status = 'draft', conflict = false, foreign = false } = {}) {
  const state = { reads: 0, updates: 0, deletes: 0, transactions: 0 }
  const tx = {
    quoteMember: { findFirst: async ({ where }) => {
      assert.deepEqual(JSON.parse(JSON.stringify(where)), { organizationId: 'org', userId: 'user', status: 'ACTIVE' })
      state.reads++
      return actorRole ? { role: actorRole } : null
    } },
    quoteDocument: {
      findFirst: async () => foreign ? null : { id: 'doc', status },
      findUnique: async () => ({ id: 'doc', status }),
      update: async () => { state.updates++ },
      deleteMany: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        state.deletes++
        return { count: foreign ? 0 : 1 }
      },
    },
  }
  const prisma = { $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    state.transactions++
    if (conflict) throw Object.assign(new Error('serial conflict'), { code: 'P2034' })
    return work(tx)
  } }
  const route = load('src/app/api/quote/documents/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/quote/document-revision': require('./quote-revision-fixture.cjs'),
    '@/lib/quote/access': {
      getQuoteContext: async () => ({ organizationId: 'org', userId: 'user', role: 'manager' }),
      hasMinRole: (role, minimum) => minimum === 'manager' && ['manager', 'admin', 'owner'].includes(role),
      orgSlugFrom: () => 'org',
    },
    '@/lib/quote/document': { recalcDocument: async () => {} },
  })
  const params = { params: Promise.resolve({ id: 'doc' }) }
  return { state, patch: body => route.PATCH({ json: async () => ({...body,expectedRevision:'a'.repeat(64)}) }, params), remove: () => route.DELETE({url:'https://local.test/?expectedRevision='+ 'a'.repeat(64)}, params) }
}

;(async () => {
  await check('revoked quote actor cannot edit or delete after context lookup', async () => {
    const f = fixture({ actorRole: null })
    assert.equal((await f.patch({ notes: 'changed' })).status, 403)
    assert.equal((await f.remove()).status, 403)
    assert.equal(f.state.updates, 0)
    assert.equal(f.state.deletes, 0)
    assert.equal(f.state.reads, 2)
  })
  await check('downgraded quote actor cannot confirm or delete', async () => {
    const f = fixture({ actorRole: 'member' })
    assert.equal((await f.patch({ status: 'confirmed' })).status, 403)
    assert.equal((await f.remove()).status, 403)
    assert.equal(f.state.updates, 0)
    assert.equal(f.state.deletes, 0)
  })
  await check('active manager can delete only the scoped quote', async () => {
    const f = fixture()
    assert.equal((await f.remove()).status, 200)
    assert.equal(f.state.deletes, 1)
    const foreign = fixture({ foreign: true })
    assert.equal((await foreign.remove()).status, 404)
    assert.equal(foreign.state.deletes, 0)
  })
  await check('quote delete serialization conflict asks for reload without write', async () => {
    const f = fixture({ conflict: true })
    assert.equal((await f.remove()).status, 409)
    assert.equal(f.state.deletes, 0)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
