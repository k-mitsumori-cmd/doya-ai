const {timeCreation,adaptTimePrisma,operationId}=require('./promane-time-creation-fixture.cjs');
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ active = true, foreign = false, projectId = 'p', revokeDuringCommit = false } = {}) {
  let memberActive = active
  let attempts = 0
  let writes = 0
  let committed = false
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const tx = {
        promaneMember: { findFirst: async ({ where }) => {
          assert.equal(where.workspaceId, 'w')
          assert.equal(where.userId, 'u')
          assert.equal(where.isActive, true)
          return memberActive ? { id: 'actor' } : null
        } },
        promaneTimeEntry: { deleteMany: async ({ where }) => {
          assert.equal(where.id, 'entry')
          assert.equal(where.member.workspaceId, 'w')
          writes++
          return { count: foreign ? 0 : 1 }
        } },
        promaneExpense: {
          findFirst: async ({ where }) => {
            assert.equal(where.project.workspaceId, 'w')
            return foreign ? null : { projectId: 'p' }
          },
          deleteMany: async ({ where }) => {
            assert.equal(where.project.workspaceId, 'w')
            assert.equal(where.projectId, 'p')
            writes++
            return { count: 1 }
          },
        },
      }
      const result = await fn(tx)
      if (revokeDuringCommit && attempts === 1) {
        memberActive = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committed = true
      return result
    },
  }
  const actions = load('src/lib/promane/actions-time-entries.ts', {
    './time-entry-creation':timeCreation,'./time-input': load('src/lib/promane/time-input.ts'),
    '@/lib/prisma': { prisma:adaptTimePrisma(prisma) },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'u' }),
      requireWritableWorkspace: async () => ({ id: 'w' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  return {
    deleteTime: () => actions.deleteTimeEntry('ws', 'entry'),
    deleteExpense: () => actions.deleteExpense('ws', 'expense', projectId),
    state: () => ({ attempts, writes, committed }),
  }
}

function apiFixture() {
  let active = true
  let attempts = 0
  let writes = 0
  let committed = false
  const prisma = {
    $transaction: async function (fn, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const result = await fn(this)
      if (attempts === 1) {
        active = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committed = true
      return result
    },
    promaneWorkspace: { findFirst: async () => active ? { id: 'w' } : null },
    promaneProject: { findFirst: async () => ({ id: 'p' }) },
    promaneExpense: {
      create: async ({ data }) => { writes++; return data },
      deleteMany: async () => { writes++; return { count: 1 } },
    },
  }
  const api = load('src/app/api/promane/expenses/route.ts', {
    '@/lib/promane/time-input': load('src/lib/promane/time-input.ts'),
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma:adaptTimePrisma(prisma) },
  })
  return {
    post: () => api.POST({ json: async () => ({ workspaceSlug: 'ws', projectId: 'p', category: 'travel', amount: 100, description: 'Taxi', date: '2026-09-01' }) }),
    delete: () => api.DELETE({ nextUrl: new URL('https://example.test/api/promane/expenses?workspaceSlug=ws&id=expense') }),
    state: () => ({ attempts, writes, committed }),
  }
}

function actionWriteFixture({ revokeDuringCommit = false, foreignTarget = false } = {}) {
  let active = true
  let attempts = 0
  let writes = 0
  let committed = false
  const prisma = {
    $transaction: async function (fn, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const result = await fn(this)
      if (revokeDuringCommit && attempts === 1) {
        active = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committed = true
      return result
    },
    promaneMember: {
      findFirst: async ({ where }) => {
        assert.equal(where.workspaceId, 'w')
        if (where.userId) return active ? { id: 'actor' } : null
        return foreignTarget ? null : { id: 'm', hourlyRate: 2500 }
      },
      updateMany: async ({ where }) => {
        assert.equal(where.workspaceId, 'w')
        writes++
        return { count: foreignTarget ? 0 : 1 }
      },
    },
    promaneProject: { findFirst: async ({ where }) => where.workspaceId === 'w' && !foreignTarget ? { id: 'p' } : null },
    promaneTimeEntry: { create: async ({ data }) => { writes++; return data } },
    promaneExpense: { create: async ({ data }) => { writes++; return data } },
  }
  const actions = load('src/lib/promane/actions-time-entries.ts', {
    './time-entry-creation':timeCreation,'./time-input': load('src/lib/promane/time-input.ts'),
    '@/lib/prisma': { prisma:adaptTimePrisma(prisma) },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'u' }),
      requireWritableWorkspace: async () => ({ id: 'w' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  return {
    time: () => actions.createTimeEntry('ws', { operationId, memberId: 'm', duration: 60, date: '2026-09-01' }),
    expense: () => actions.createExpense('ws', { projectId: 'p', category: 'travel', amount: 100, description: 'Taxi', date: '2026-09-01' }),
    rate: () => actions.updateMemberRate('ws', 'm', 3000),
    state: () => ({ attempts, writes, committed }),
  }
}

function rateApiFixture({ foreignTarget = false } = {}) {
  let active = true
  let attempts = 0
  let writes = 0
  let committed = false
  const prisma = {
    $transaction: async function (fn, options) {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const result = await fn(this)
      if (attempts === 1 && !foreignTarget) {
        active = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      committed = true
      return result
    },
    promaneWorkspace: { findFirst: async () => ({ id: 'w' }) },
    promaneMember: {
      findFirst: async ({ where }) => active && where.role.in.includes('admin') ? { id: 'actor' } : null,
      updateMany: async ({ where }) => {
        assert.equal(where.workspaceId, 'w')
        writes++
        return { count: foreignTarget ? 0 : 1 }
      },
    },
  }
  const api = load('src/app/api/promane/members/[id]/rate/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
    '@/lib/auth': {},
    '@/lib/prisma': { prisma:adaptTimePrisma(prisma) },
  })
  return {
    run: () => api.PATCH({ json: async () => ({ workspaceSlug: 'ws', hourlyRate: 3000 }) }, { params: Promise.resolve({ id: 'm' }) }),
    state: () => ({ attempts, writes, committed }),
  }
}

;(async () => {
  await check('time and expense deletion commits for the current workspace', async () => {
    for (const method of ['deleteTime', 'deleteExpense']) {
      const f = fixture()
      await f[method]()
      assert.deepEqual(f.state(), { attempts: 1, writes: 1, committed: true })
    }
  })
  await check('foreign records and revoked membership cannot delete', async () => {
    for (const method of ['deleteTime', 'deleteExpense']) {
      const foreign = fixture({ foreign: true })
      await assert.rejects(foreign[method](), /見つかりません/)
      assert.equal(foreign.state().committed, false)
      const revoked = fixture({ active: false })
      await assert.rejects(revoked[method](), /変更権限がありません/)
      assert.deepEqual(revoked.state(), { attempts: 1, writes: 0, committed: false })
    }
  })
  await check('expense deletion rejects a mismatched project parameter', async () => {
    const f = fixture({ projectId: 'other' })
    await assert.rejects(f.deleteExpense(), /プロジェクトが一致しません/)
    assert.equal(f.state().writes, 0)
  })
  await check('membership revocation on retry aborts both deletions', async () => {
    for (const method of ['deleteTime', 'deleteExpense']) {
      const f = fixture({ revokeDuringCommit: true })
      await assert.rejects(f[method](), /変更権限がありません/)
      assert.deepEqual(f.state(), { attempts: 2, writes: 1, committed: false })
    }
  })
  await check('expense API rechecks revoked access after serialization conflicts', async () => {
    for (const method of ['post', 'delete']) {
      const f = apiFixture()
      const response = await f[method]()
      assert.equal(response.status, 403)
      assert.deepEqual(f.state(), { attempts: 2, writes: 1, committed: true })
    }
  })
  await check('time, expense and rate writes recheck access after serialization conflicts', async () => {
    for (const method of ['time', 'expense', 'rate']) {
      const f = actionWriteFixture({ revokeDuringCommit: true })
      await assert.rejects(f[method](), /権限がありません/)
      assert.deepEqual(f.state(), { attempts: 2, writes: 1, committed: false })
    }
  })
  await check('time, expense and rate writes reject foreign targets', async () => {
    for (const method of ['time', 'expense', 'rate']) {
      const f = actionWriteFixture({ foreignTarget: true })
      await assert.rejects(f[method](), /見つかりません/)
      assert.equal(f.state().committed, false)
    }
  })
  await check('rate API refuses a revoked actor and foreign member', async () => {
    const revoked = rateApiFixture()
    assert.equal((await revoked.run()).status, 403)
    assert.deepEqual(revoked.state(), { attempts: 2, writes: 1, committed: true })
    const foreign = rateApiFixture({ foreignTarget: true })
    assert.equal((await foreign.run()).status, 404)
    assert.deepEqual(foreign.state(), { attempts: 1, writes: 1, committed: true })
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
