const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const timeInput = load('src/lib/promane/time-input.ts')

function fixture({ conflict = false, member = true } = {}) {
  let attempts = 0, writes = 0
  const row = { projectId: 'project', startDate: new Date('2026-09-01T00:00:00Z'), dueDate: new Date('2026-09-30T00:00:00Z') }
  const prisma = {
    promaneTask: {
      findFirst: async () => ({ id: 'task' }),
      update: async ({ data }) => { writes++; Object.assign(row, data); return { ...row } },
    },
    $transaction: async (fn, options) => {
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
    },
  }
  const actions = load('src/lib/promane/actions-tasks.ts', {
    './time-input': timeInput,
    '@/lib/prisma': { prisma },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'user' }),
      requireWritableWorkspace: async () => ({ id: 'workspace' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  return {
    create: data => actions.createTask('workspace', { projectId: 'project', title: 'Task', ...data }),
    update: patch => actions.updateTask('workspace', 'task', patch),
    move: (status, order) => actions.moveTask('workspace', 'task', status, order),
    state: () => ({ attempts, writes, row }),
  }
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

  const fields = fixture()
  for (const status of ['', 'archived', 'DONE']) {
    await assert.rejects(fields.create({ status }), /状態が不正/)
    await assert.rejects(fields.update({ status }), /状態が不正/)
    await assert.rejects(fields.move(status, 0), /状態が不正/)
  }
  for (const priority of ['', 'critical']) {
    await assert.rejects(fields.create({ priority }), /優先度が不正/)
    await assert.rejects(fields.update({ priority }), /優先度が不正/)
  }
  for (const order of [-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(fields.update({ order }), /並び順が不正/)
    await assert.rejects(fields.move('done', order), /並び順が不正/)
  }
  assert.equal(fields.state().writes, 0)
  const moved = await fields.move('done', 0)
  assert.equal(moved.status, 'done')
  assert.equal(fields.state().writes, 1)
  console.log('PASS invalid task states, priorities and ordering cannot hide a task')
})().catch(error => { console.error(error); process.exitCode = 1 })
