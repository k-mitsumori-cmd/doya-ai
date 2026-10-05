const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ operation = 'close', beforeSave, foreign = false, manager = true } = {}) {
  const row = {
    id: 'session', organizationId: 'org', status: operation === 'reset' ? 'aborted' : operation === 'edit' ? 'consented' : 'live',
    startedAt: operation === 'edit' ? null : new Date(Date.now() - 600000), endedAt: operation === 'reset' ? new Date() : null,
    updatedAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 60000),
    consentedAt: new Date(Date.now() - 600000), candidateEmail: 'original@example.test', candidateName: 'Original',
    turns: operation === 'close' ? [{ createdAt: new Date(Date.now() - 240000) }] : [],
  }
  let writes = 0
  const db = { mensetsuSession: {
    findFirst: async ({ where }) => foreign || where.id !== row.id || where.organizationId !== row.organizationId ? null : {
      ...row, turns: row.turns.map((t) => ({ ...t })), _count: { turns: row.turns.length },
    },
    update: async ({ data }) => {
      beforeSave?.(row)
      Object.assign(row, data); writes++
      return { ...row }
    },
    updateMany: async ({ where, data }) => {
      beforeSave?.(row)
      assert.equal(where.organizationId, 'org')
      assert.equal(where.id, 'session')
      if (where.status !== row.status || where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 }
      if ('startedAt' in where && where.startedAt !== row.startedAt) return { count: 0 }
      if ('endedAt' in where && where.endedAt !== row.endedAt) return { count: 0 }
      if (where.expiresAt && row.expiresAt <= where.expiresAt.gt) return { count: 0 }
      if (where.turns?.some && row.turns.length === 0) return { count: 0 }
      if (where.turns?.none && row.turns.some((t) => !where.turns.none.createdAt || t.createdAt >= where.turns.none.createdAt.gte)) return { count: 0 }
      Object.assign(row, data); writes++
      return { count: 1 }
    },
  } }
  const api = load(operation === 'edit' ? 'src/app/api/mensetsu/sessions/[id]/route.ts' : 'src/app/api/mensetsu/sessions/[id]/close/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'org', role: manager ? 'manager' : 'member' }), hasMinRole: () => manager, orgSlugFrom: () => 'org' },
    '@/lib/mensetsu/evaluate': { weightedAverage: () => 0 },
  })
  const method = operation === 'edit' ? 'PATCH' : operation === 'reset' ? 'DELETE' : 'POST'
  return { row, get writes() { return writes }, run: () => api[method]({ json: async () => ({ candidateEmail: 'new@example.test' }) }, { params: Promise.resolve({ id: 'session' }) }) }
}

;(async () => {
  for (const operation of ['close', 'reset', 'edit']) {
    await check(`manager ${operation} saves matching current state`, async () => {
      const f = fixture({ operation })
      assert.equal((await f.run()).status, 200)
      assert.equal(f.writes, 1)
      assert.equal(f.row.status, operation === 'close' ? 'completed' : 'pending')
    })
    await check(`concurrent manager ${operation} saves once`, async () => {
      const f = fixture({ operation })
      const responses = await Promise.all([f.run(), f.run()])
      assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409])
      assert.equal(f.writes, 1)
    })
    await check(`manager ${operation} preserves a newer session state`, async () => {
      const f = fixture({ operation, beforeSave: (row) => { row.status = 'evaluating'; row.updatedAt = new Date(row.updatedAt.getTime() + 1) } })
      assert.equal((await f.run()).status, 409)
      assert.equal(f.row.status, 'evaluating')
      assert.equal(f.writes, 0)
    })
    for (const gate of ['foreign', 'role']) {
      await check(`manager ${operation} rejects ${gate} without writes`, async () => {
        const f = fixture({ operation, foreign: gate === 'foreign', manager: gate !== 'role' })
        assert.equal((await f.run()).status, gate === 'foreign' ? 404 : 403)
        assert.equal(f.writes, 0)
      })
    }
  }
  await check('close rechecks new activity before ending the interview', async () => {
    const f = fixture({ beforeSave: (row) => { row.turns.push({ createdAt: new Date() }) } })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.row.status, 'live')
    assert.equal(f.writes, 0)
  })
  await check('empty close does not abort an interview after an answer arrives', async () => {
    const f = fixture({ beforeSave: (row) => { row.turns.push({ createdAt: new Date() }) } })
    f.row.turns = []
    assert.equal((await f.run()).status, 409)
    assert.equal(f.row.status, 'live')
    assert.equal(f.writes, 0)
  })
  await check('reset cannot discard an answer arriving after the initial read', async () => {
    const f = fixture({ operation: 'reset', beforeSave: (row) => { row.turns.push({ createdAt: new Date() }) } })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.row.status, 'aborted')
    assert.equal(f.writes, 0)
  })
  for (const operation of ['reset', 'edit']) {
    await check(`${operation} rejects expiry during the request`, async () => {
      const f = fixture({ operation, beforeSave: (row) => { row.expiresAt = new Date(Date.now() - 1000) } })
      assert.equal((await f.run()).status, 409)
      assert.equal(f.writes, 0)
    })
  }
  await check('candidate edit cannot revoke consent after interview start', async () => {
    const f = fixture({ operation: 'edit', beforeSave: (row) => { row.startedAt = new Date(); row.status = 'live' } })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.row.candidateEmail, 'original@example.test')
    assert.ok(f.row.consentedAt)
    assert.equal(f.writes, 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
