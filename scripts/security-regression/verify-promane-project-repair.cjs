const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture(kind, { changed = false, revoke = false, failSecond = false, conflict = false } = {}) {
  let active = !revoke
  let attempts = 0
  let committed = 0
  let attempted = 0
  const dates = { startDate: new Date('2026-09-20'), endDate: new Date('2026-09-10') }
  const records = kind === 'task'
    ? [{ id: 'first', startDate: dates.startDate, dueDate: dates.endDate }, { id: 'second', startDate: dates.startDate, dueDate: dates.endDate }]
    : [{ id: 'first', contractAmount: -1, monthlyAmount: -2, hourlyRate: -3, estimatedHours: -4, ...dates },
      { id: 'second', contractAmount: -1, monthlyAmount: -2, hourlyRate: -3, estimatedHours: -4, ...dates }]
  const prisma = {
    $transaction: async (callback, options) => {
      attempts++
      assert.equal(options.isolationLevel, 'Serializable')
      assert.equal(options.timeout, 20_000)
      if (conflict && attempts === 1) {
        active = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      let pending = 0
      const table = {
        findMany: async ({ where }) => {
          assert.equal(kind === 'task' ? where.project.workspaceId : where.workspaceId, 'w')
          return records
        },
        updateMany: async ({ where, data }) => {
          attempted++
          const source = records.find(item => item.id === where.id)
          assert.equal(kind === 'task' ? where.project.workspaceId : where.workspaceId, 'w')
          for (const [key, value] of Object.entries(source)) assert.equal(where[key], value)
          if (kind === 'task') assert.equal(data.dueDate, null)
          else {
            for (const key of ['contractAmount', 'monthlyAmount', 'hourlyRate', 'estimatedHours']) assert.equal(data[key], 0)
            assert.equal(data.endDate, null)
          }
          if (failSecond && attempted === 2) throw new Error('second update failed')
          if (!changed) pending++
          return { count: changed ? 0 : 1 }
        },
      }
      const value = await callback({
        promaneMember: { findFirst: async ({ where }) => {
          assert.deepEqual(Array.from(where.role.in), ['owner', 'admin'])
          assert.equal(where.workspaceId, 'w')
          return active ? { id: 'actor' } : null
        } },
        promaneTask: table,
        promaneProject: table,
      })
      committed += pending
      return value
    },
  }
  const actions = load(`src/lib/promane/actions-${kind === 'task' ? 'tasks' : 'projects'}.ts`, {
    './time-input': load('src/lib/promane/time-input.ts'),
    './task-creation': load('src/lib/promane/task-creation.ts', {'node:crypto':require('node:crypto')}),
    './task-input': load('src/lib/promane/task-input.ts', {'./time-input':load('src/lib/promane/time-input.ts')}),
    '@/lib/prisma': { prisma },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'u' }),
      requireWritableWorkspace: async (_slug, _user, adminOnly) => {
        assert.equal(adminOnly, true)
        return { id: 'w' }
      },
    },
    '@/lib/promane/limits': {},
    'next/cache': { revalidatePath() {} },
  })
  return {
    run: () => kind === 'task' ? actions.repairInvalidTaskDates('w') : actions.repairInvalidProjects('w'),
    state: () => ({ attempts, committed, attempted }),
  }
}

;(async () => {
  for (const kind of ['task', 'project']) {
    await check(`${kind} repair scopes and compares source values`, async () => {
      const f = fixture(kind)
      assert.equal((await f.run()).repaired, 2)
      assert.deepEqual(f.state(), { attempts: 1, committed: 2, attempted: 2 })
    })
    await check(`${kind} repair skips concurrent corrections`, async () => {
      const f = fixture(kind, { changed: true })
      assert.equal((await f.run()).repaired, 0)
      assert.equal(f.state().committed, 0)
    })
    await check(`${kind} repair checks current admin permission`, async () => {
      const f = fixture(kind, { revoke: true })
      await assert.rejects(f.run(), /オーナー・管理者/)
      assert.equal(f.state().attempted, 0)
    })
    await check(`${kind} repair rolls back a later failure`, async () => {
      const f = fixture(kind, { failSecond: true })
      await assert.rejects(f.run(), /second update failed/)
      assert.equal(f.state().committed, 0)
    })
    await check(`${kind} repair rechecks permission after serialization conflict`, async () => {
      const f = fixture(kind, { conflict: true })
      await assert.rejects(f.run(), /オーナー・管理者/)
      assert.deepEqual(f.state(), { attempts: 2, committed: 0, attempted: 0 })
    })
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
