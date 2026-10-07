const {projectDependencies}=require('./promane-project-operation-fixture.cjs');
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ active = true, projectWorkspace = 'w', revokeDuringCommit = false } = {}) {
  let memberActive = active
  let attempts = 0
  let writes = 0
  let deleted = false
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      const tx = {
        promaneMember: { findFirst: async ({ where }) => {
          assert.deepEqual(JSON.parse(JSON.stringify(where)), { workspaceId: 'w', userId: 'u', isActive: true, role: { in: ['owner', 'admin', 'member'] } })
          return memberActive ? { id: 'member' } : null
        } },
        promaneProject: { deleteMany: async ({ where }) => {
          assert.deepEqual(JSON.parse(JSON.stringify(where)), { id: 'p', workspaceId: 'w' })
          writes++
          return { count: projectWorkspace === 'w' ? 1 : 0 }
        } },
      }
      await fn(tx)
      if (revokeDuringCommit && attempts === 1) {
        memberActive = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      deleted = true
    },
  }
  const actions = load('src/lib/promane/actions-projects.ts', {
    ...projectDependencies,
    './time-input': load('src/lib/promane/time-input.ts'),
    '@/lib/prisma': { prisma },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'u' }),
      requireWritableWorkspace: async () => ({ id: 'w' }),
    },
    '@/lib/promane/limits': {},
    'next/cache': { revalidatePath() {} },
  })
  return { run: () => actions.deleteProject('workspace', 'p'), state: () => ({ attempts, writes, deleted }) }
}

;(async () => {
  await check('authorized project deletion is scoped to its workspace', async () => {
    const f = fixture()
    await f.run()
    assert.deepEqual(f.state(), { attempts: 1, writes: 1, deleted: true })
  })
  await check('foreign project and revoked membership cannot delete', async () => {
    const foreign = fixture({ projectWorkspace: 'other' })
    await assert.rejects(foreign.run(), /プロジェクトが見つかりません/)
    assert.equal(foreign.state().deleted, false)
    const revoked = fixture({ active: false })
    await assert.rejects(revoked.run(), /変更権限がありません/)
    assert.deepEqual(revoked.state(), { attempts: 1, writes: 0, deleted: false })
  })
  await check('membership revocation during a serializable delete aborts the retry', async () => {
    const f = fixture({ revokeDuringCommit: true })
    await assert.rejects(f.run(), /変更権限がありません/)
    assert.deepEqual(f.state(), { attempts: 2, writes: 1, deleted: false })
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
