const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const timeInput = load('src/lib/promane/time-input.ts')

function fixture(operation, conflict = false) {
  let active = true, attempts = 0, writes = 0
  const task = { id: 'task', projectId: 'project', status: 'todo', order: 0 }
  const write = value => {
    if (conflict && attempts === 1) {
      active = false
      throw { code: 'P2034' }
    }
    writes++
    return { ...task, ...value }
  }
  const prisma = {
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      return fn({
        promaneMember: { findFirst: async ({ where }) => where.userId ? active ? { id: 'actor' } : null : { id: 'assignee' } },
        promaneProject: { findFirst: async ({ where }) => {
          assert.equal(where.workspaceId, 'workspace')
          return { id: 'project' }
        } },
        promaneTask: {
          findFirst: async ({ where }) => {
            if (where.project) assert.equal(where.project.workspaceId, 'workspace')
            return task
          },
          aggregate: async () => ({ _max: { order: 0 } }),
          create: async ({ data }) => write(data),
          update: async ({ data }) => write(data),
          delete: async () => write({ deleted: true }),
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
  const call = () => operation === 'create'
    ? actions.createTask('workspace', { projectId: 'project', title: 'Task' })
    : operation === 'move'
      ? actions.moveTask('workspace', 'task', 'done', 0)
      : actions.deleteTask('workspace', 'task')
  return { call, state: () => ({ attempts, writes }) }
}

;(async () => {
  for (const operation of ['create', 'move', 'delete']) {
    const valid = fixture(operation)
    await valid.call()
    assert.deepEqual(valid.state(), { attempts: 1, writes: 1 }, `${operation} valid`)

    const revoked = fixture(operation, true)
    await assert.rejects(revoked.call(), /変更権限/, `${operation} revoked during conflict`)
    assert.deepEqual(revoked.state(), { attempts: 2, writes: 0 }, `${operation} no committed write`)
  }
  console.log('PASS task create, move and delete retry in a serializable transaction and recheck revoked membership')
})().catch(error => { console.error(error); process.exitCode = 1 })
