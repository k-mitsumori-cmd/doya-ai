const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ role = 'admin', revokeOnConflict = false, duplicate = false, uniqueConflict = false } = {}) {
  let currentRole = role
  let attempts = 0
  let writes = 0
  let committedWrites = 0
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const before = writes
      const result = await fn({
        promaneMember: { findFirst: async ({ where }) => where.role.in.includes(currentRole) ? { id: 'actor' } : null },
        promaneWorkspace: {
          findFirst: async ({ where }) => {
            assert.equal(where.NOT.id, 'w')
            return duplicate ? { id: 'other' } : null
          },
          update: async ({ where, data }) => {
            assert.equal(where.id, 'w')
            writes++
            if (uniqueConflict) throw Object.assign(new Error('duplicate'), { code: 'P2002' })
            return { id: 'w', name: data.name || '旧名', slug: data.slug || 'old' }
          },
        },
      })
      if (revokeOnConflict && attempts === 1) {
        currentRole = 'member'
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committedWrites += writes - before
      return result
    },
  }
  const api = load('src/app/api/promane/workspaces/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma },
  })
  return {
    run: body => api.PATCH({ json: async () => body }, { params: Promise.resolve({ id: 'w' }) }),
    state: () => ({ attempts, writes, committedWrites }),
  }
}

;(async () => {
  await check('owner/admin settings update is scoped and commits once', async () => {
    for (const role of ['owner', 'admin']) {
      const f = fixture({ role })
      const response = await f.run({ name: '新しい名称', slug: 'new-slug' })
      assert.equal(response.status, 200)
      assert.equal((await response.json()).workspace.slug, 'new-slug')
      assert.deepEqual(f.state(), { attempts: 1, writes: 1, committedWrites: 1 })
    }
  })
  await check('member and revoked admin cannot update settings', async () => {
    const member = fixture({ role: 'member' })
    assert.equal((await member.run({ name: '新名' })).status, 403)
    assert.equal(member.state().writes, 0)
    const revoked = fixture({ revokeOnConflict: true })
    assert.equal((await revoked.run({ name: '新名' })).status, 403)
    assert.deepEqual(revoked.state(), { attempts: 2, writes: 1, committedWrites: 0 })
  })
  await check('duplicate slug returns conflict before or during update', async () => {
    for (const options of [{ duplicate: true }, { uniqueConflict: true }]) {
      const f = fixture(options)
      const response = await f.run({ slug: 'taken' })
      assert.equal(response.status, 409)
      assert.equal(f.state().committedWrites, 0)
    }
  })
  await check('non-string settings values are rejected without database writes', async () => {
    for (const body of [{ name: { bad: true } }, { slug: ['bad'] }, { name: '' }, { slug: '!' }]) {
      const f = fixture()
      assert.equal((await f.run(body)).status, 400)
      assert.deepEqual(f.state(), { attempts: 0, writes: 0, committedWrites: 0 })
    }
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
