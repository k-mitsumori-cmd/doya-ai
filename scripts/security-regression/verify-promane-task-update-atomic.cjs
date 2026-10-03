const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const timeInput = load('src/lib/promane/time-input.ts')

function fixture({ conflict = false, member = true } = {}) {
  let attempts = 0, writes = 0
  const row = { projectId: 'project', startDate: new Date('2026-09-01T00:00:00Z'), dueDate: new Date('2026-09-30T00:00:00Z') }
  const prisma = { $transaction: async (fn, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    attempts++
    return fn({
      promaneMember: { findFirst: async ({ where }) => where.userId ? member ? { id: 'actor' } : null : { id: 'assignee' } },
      promaneTask: {
        findFirst: async ({ where }) => {
          assert.equal(where.project.workspaceId, 'workspace')
          return { ...row }
        },
        update: async ({ data }) => {
          writes++
          if (conflict && attempts === 1) {
            row.dueDate = new Date('2026-09-10T00:00:00Z')
            throw { code: 'P2034' }
          }
          Object.assign(row, data)
          return { ...row }
        },
      },
    })
  } }
  const actions = load('src/lib/promane/actions-tasks.ts', {
    './time-input': timeInput,
    '@/lib/prisma': { prisma },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'user' }),
      requireWritableWorkspace: async () => ({ id: 'workspace' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  return { update: patch => actions.updateTask('workspace', 'task', patch), state: () => ({ attempts, writes, row }) }
}

;(async () => {
  const race = fixture({ conflict: true })
  await assert.rejects(race.update({ startDate: '2026-09-20' }), /終了日は開始日以降/)
  assert.deepEqual({ attempts: race.state().attempts, writes: race.state().writes }, { attempts: 2, writes: 1 })
  assert.equal(race.state().row.startDate.toISOString(), '2026-09-01T00:00:00.000Z')
  console.log('PASS retry re-reads the opposite date after a concurrent update')

  for (const value of ['2026-02-30', '2026-09-01T00:00:00Z', 'yesterday']) {
    const invalid = fixture()
    await assert.rejects(invalid.update({ startDate: value }))
    assert.equal(invalid.state().writes, 0)
  }
  const cleared = fixture()
  assert.equal((await cleared.update({ dueDate: null })).dueDate, null)
  assert.equal(cleared.state().row.startDate.toISOString(), '2026-09-01T00:00:00.000Z')
  const revoked = fixture({ member: false })
  await assert.rejects(revoked.update({ title: 'New title' }), /変更権限/)
  assert.equal(revoked.state().writes, 0)
  console.log('PASS strict dates, optional clearing and membership recheck remain intact')
})().catch(error => { console.error(error); process.exitCode = 1 })
