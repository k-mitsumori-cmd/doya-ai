const {adaptTimePrisma,operationId}=require('./promane-time-creation-fixture.cjs');
const taskCreation=require('./load-typescript.cjs').load('src/lib/promane/task-creation.ts',{'node:crypto':require('node:crypto')});
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
    './task-creation': taskCreation,
    './task-input': load('src/lib/promane/task-input.ts',{'./time-input':timeInput}),
    '@/lib/prisma': { prisma:adaptTimePrisma(prisma) },
    '@/lib/promane/auth': {
      requirePromaneAuthAction: async () => ({ userId: 'user' }),
      requireWritableWorkspace: async () => ({ id: 'workspace' }),
    },
    'next/cache': { revalidatePath() {} },
  })
  const call = () => operation === 'create'
    ? actions.createTask('workspace', { operationId, expectedUserId:'user', projectId: 'project', title: 'Task' })
    : operation === 'move'
      ? actions.moveTask('workspace', 'task', 'done', 0)
      : actions.deleteTask('workspace', 'task')
  return { call, actions, state: () => ({ attempts, writes }) }
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

  for (const patch of [
    { title: 'x'.repeat(201) }, { title: ' ' }, { title: 12 },
    { description: 'x'.repeat(5001) }, { description: {} },
  ]) {
    const invalid = fixture('create')
    await assert.rejects(invalid.actions.createTask('workspace', { operationId, expectedUserId:'user', projectId: 'project', title: 'Task', ...patch }))
    await assert.rejects(invalid.actions.updateTask('workspace', 'task', patch))
    assert.equal(invalid.state().writes, 0)
  }
  const exact = fixture('create')
  const text = { title: '題'.repeat(200), description: '説'.repeat(5000) }
  const created = await exact.actions.createTask('workspace', { operationId, expectedUserId:'user', projectId: 'project', ...text })
  const updated = await exact.actions.updateTask('workspace', 'task', text)
  assert.equal(created.title, text.title)
  assert.equal(created.description, text.description)
  assert.equal(updated.title, text.title)
  assert.equal(updated.description, text.description)
  console.log('PASS task text rejects overflow without truncation and preserves exact boundaries')
})().catch(error => { console.error(error); process.exitCode = 1 })
