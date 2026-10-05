const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))
const answer = (label) => ({ scores: [], verdict: 'hold', overallComment: label, candidateFeedback: label, recruiterReport: label })
const watchdog = setTimeout(() => { console.error('Transcript finalization tests did not finish'); process.exit(1) }, 20000)

function fixture({ live = false, empty = false } = {}) {
  const clock = { now: Date.now() }
  class FakeDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])) }
    static now() { return clock.now }
  }
  const row = {
    id: 'session', status: live ? 'live' : 'completed', updatedAt: new Date(clock.now - 1000),
    startedAt: new Date(clock.now), endedAt: live ? null : new Date(clock.now), consentedAt: new Date(clock.now),
    purgeAfter: new Date(clock.now + 86400000), evaluatedAt: null, overallComment: null,
    organization: { id: 'org', name: 'Synthetic' }, template: { level: 'mid', jobTitle: 'Synthetic', criteria: [], questions: [] },
  }
  let turns = empty ? [] : [{ id: 'first', sessionId: row.id, speaker: 'candidate', text: 'First answer', ord: 0, startMs: 1 }]
  let queue = Promise.resolve()
  const stats = { inputs: [], scoreWrites: 0, locks: 0, errors: 0, warnings: [] }
  const hooks = {}
  const pending = [], background = []
  async function acquire() {
    const previous = queue
    const gate = deferred()
    queue = gate.promise
    await previous
    return gate.resolve
  }
  function transactionApi(context) {
    const mutate = async (fn) => {
      if (context) { await context.lock(); return fn() }
      const release = await acquire()
      try { return fn() } finally { release() }
    }
    return {
      $queryRaw: async (strings, ...values) => {
        assert.match(strings.join('?'), /SELECT id FROM mensetsu_sessions WHERE id = \? FOR NO KEY UPDATE/)
        assert.deepEqual(values, ['session'])
        assert.ok(context, 'row locks require a transaction')
        await context.lock()
        return [{ id: row.id }]
      },
      mensetsuSession: {
        findUnique: async () => ({ ...row, turns: turns.map((t) => ({ ...t })) }),
        updateMany: async ({ where, data }) => mutate(() => {
          const statusMatches = !where.status || (typeof where.status === 'string' ? row.status === where.status : where.status.in.includes(row.status))
          if (!statusMatches || (where.updatedAt && where.updatedAt.getTime() !== row.updatedAt.getTime()) ||
              ('endedAt' in where && where.endedAt !== row.endedAt) || (where.OR && row.purgeAfter <= new Date(clock.now))) return { count: 0 }
          Object.assign(row, data, { updatedAt: data.updatedAt || new Date(clock.now) })
          return { count: 1 }
        }),
        update: async ({ data }) => mutate(() => {
          if (hooks.failSessionUpdate) throw new Error('synthetic session write failure')
          Object.assign(row, data)
          return { ...row }
        }),
      },
      mensetsuTurn: {
        findFirst: async () => turns.length ? { ord: Math.max(...turns.map((t) => t.ord)) } : null,
        count: async () => turns.length,
        findMany: async ({ orderBy, select, where }) => {
          if (where?.id?.in) return turns.filter(t => where.id.in.includes(t.id)).map(t=>({...t}))
          if (select) return turns.map((t) => ({ id: t.id }))
          assert.ok(orderBy, 'evaluation snapshot must retain chronological ordering')
          return turns.map((t) => ({ ...t })).sort((a, b) => (a.startMs ?? Infinity) - (b.startMs ?? Infinity) || a.ord - b.ord)
        },
        createMany: async ({ data }) => {
          await hooks.beforeCreate?.()
          turns.push(...data.map((t, i) => ({ ...t, id: t.id || `turn-${turns.length + i}` })))
          return { count: data.length }
        },
      },
      mensetsuAnswerSample: { findMany: async () => { await hooks.samples?.(); return [] } },
      mensetsuScore: { deleteMany: async () => { stats.scoreWrites++ }, createMany: async () => { stats.scoreWrites++ } },
    }
  }
  const db = transactionApi(null)
  db.$transaction = async (callback) => {
    let release, snapshot
    const context = { lock: async () => {
      if (release) return
      release = await acquire()
      stats.locks++
      snapshot = { row: { ...row }, turns: turns.map((t) => ({ ...t })), scoreWrites: stats.scoreWrites }
    } }
    try { return await callback(transactionApi(context)) }
    catch (error) {
      if (snapshot) { Object.assign(row, snapshot.row); turns = snapshot.turns; stats.scoreWrites = snapshot.scoreWrites }
      throw error
    } finally { release?.(); hooks.afterCommit?.() }
  }
  const evaluation = load('src/lib/mensetsu/run-evaluation.ts', {
    '@/lib/prisma': { prisma: db }, './types': { LEVEL_LABELS: { mid: 'Synthetic' }, EVALUATION_STALE_MS: 360000 },
    './evaluate': { evaluateSession: (input) => { stats.inputs.push(input.turns.map((t) => t.text)); const p = deferred(); pending.push(p); return p.promise } },
  }, { Date: FakeDate })
  const common = {
    'node:crypto': require('node:crypto'), 'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/prisma': { prisma: db }, '@/lib/mensetsu/public': { loadSessionByToken: async () => ({ ...row }) },
    '@/lib/mensetsu/run-evaluation': evaluation, '@vercel/functions': { waitUntil: (promise) => background.push(promise) },
  }
  const globals = { Date: FakeDate, console: { log() {}, warn: (...args) => stats.warnings.push(args[0]), error: () => { stats.errors++ } } }
  const turn = load('src/app/api/mensetsu/live/[token]/turn/route.ts', common, globals)
  const end = load('src/app/api/mensetsu/live/[token]/end/route.ts', { ...common, '../turn/route': { POST: async (req,ctx) => { const response = await turn.POST(req,ctx); return { ...response, ok: response.status < 400, json: async () => response.body } } } }, globals)
  const ctx = { params: Promise.resolve({ token: 'synthetic' }) }
  return {
    row, stats, pending, hooks, background, get turns() { return turns },
    evaluate: () => evaluation.runEvaluation(row.id),
    send: (text = 'Late answer', jsonGate) => turn.POST({ json: async () => { if (jsonGate) await jsonGate.promise; return { turns: [{ speaker: 'candidate', text, startMs: 10 }] } } }, ctx),
    end: (body) => end.POST(body ? { json: async () => body } : {}, ctx), advance: (ms) => { clock.now += ms },
  }
}

;(async () => {
  await check('pagehide saves last answer before completing and evaluating empty interview', async () => {
    const f=fixture({live:true,empty:true})
    const body={aborted:true,turns:[{id:'final-answer',text:'Final answer',speaker:'candidate',startMs:50}]}
    const response=await f.end(body)
    assert.equal(response.status,200);assert.equal(response.body.status,'completed')
    await tick();assert.deepEqual(f.stats.inputs,[['Final answer']]);assert.equal(f.turns.length,1)
    assert.equal((await f.end(body)).body.alreadyEnded,true);assert.equal(f.turns.length,1)
    f.pending[0].resolve(answer('Final report'));await Promise.all(f.background)
  })
  await check('pagehide transcript refusal does not end or evaluate interview', async () => {
    const f=fixture({live:true,empty:true})
    const response=await f.end({turns:[{id:'bad/id',text:'Answer'}]})
    assert.equal(response.status,400);assert.equal(f.row.status,'live');assert.equal(f.stats.inputs.length,0)
  })
  await check('pagehide partial or malformed transcript does not end interview', async () => {
    for (const turns of [[{id:'empty',text:''}],{bad:true},Array.from({length:51},(_,i)=>({id:`id-${i}`,text:'Answer'}))]) {
      const f=fixture({live:true,empty:true});const response=await f.end({turns})
      assert.ok(response.status>=400);assert.equal(f.row.status,'live');assert.equal(f.turns.length,0)
    }
  })
  await check('evaluated session refuses new pagehide speech without changing report', async () => {
    const f=fixture({live:true,empty:true});f.row.status='evaluated';f.row.evaluatedAt=new Date();f.row.overallComment='Preserved'
    const response=await f.end({turns:[{id:'new',text:'New answer'}]})
    assert.equal(response.status,409);assert.equal(f.turns.length,0);assert.equal(f.row.overallComment,'Preserved')
  })
  await check('accepted late answer is included in a serial reevaluation before saving', async () => {
    const f = fixture(), run = f.evaluate()
    await tick()
    const lease = f.row.updatedAt.getTime()
    assert.equal((await f.send()).body.saved, 1)
    assert.equal(f.row.updatedAt.getTime(), lease)
    f.pending[0].resolve(answer('stale'))
    await tick()
    assert.deepEqual(f.stats.inputs, [['First answer'], ['First answer', 'Late answer']])
    assert.equal(f.stats.scoreWrites, 0)
    assert.equal(f.row.overallComment, null)
    assert.equal((await f.evaluate()).status, 409)
    f.pending[1].resolve(answer('fresh'))
    assert.equal((await run).ok, true)
    assert.equal(f.row.overallComment, 'fresh')
    assert.equal(f.stats.scoreWrites, 2)
  })
  await check('answer arriving before AI input is loaded is included on the first attempt', async () => {
    const f = fixture()
    f.hooks.samples = async () => { await f.send('Before snapshot') }
    const run = f.evaluate()
    await tick()
    assert.deepEqual(f.stats.inputs, [['First answer', 'Before snapshot']])
    f.pending[0].resolve(answer('fresh'))
    assert.equal((await run).ok, true)
  })
  await check('continuous late answers never save a stale result and leave a retryable state', async () => {
    const f = fixture(), run = f.evaluate()
    for (let i = 0; i < 3; i++) {
      await tick()
      assert.equal((await f.send(`Late ${i}`)).status, 200)
      f.pending[i].resolve(answer('stale'))
    }
    assert.equal((await run).status, 409)
    assert.equal(f.row.status, 'completed')
    assert.equal(f.row.overallComment, null)
    assert.equal(f.stats.inputs.length, 3)
    assert.equal(f.stats.scoreWrites, 0)
  })
  await check('retry budget preserves all accepted speech without saving old scores', async () => {
    const f = fixture(), run = f.evaluate()
    await tick(); await f.send(); f.advance(190000); f.pending[0].resolve(answer('stale'))
    assert.equal((await run).status, 409)
    assert.equal(f.stats.inputs.length, 1)
    assert.equal(f.turns.length, 2)
    assert.equal(f.stats.scoreWrites, 0)
    assert.equal(f.row.status, 'completed')
  })
  await check('provider failure on the fresh attempt restores a retryable state', async () => {
    const f = fixture(), run = f.evaluate()
    await tick(); await f.send(); f.pending[0].resolve(answer('stale')); await tick()
    f.pending[1].reject(new Error('synthetic provider failure'))
    await assert.rejects(run)
    assert.equal(f.row.status, 'completed')
    assert.equal(f.stats.scoreWrites, 0)
  })
  await check('a preloaded turn request cannot append after evaluation finalizes', async () => {
    const f = fixture(), run = f.evaluate()
    await tick()
    const gate = deferred(), send = f.send('Too late', gate)
    await tick(); f.pending[0].resolve(answer('final')); await run; gate.resolve()
    assert.equal((await send).status, 409)
    assert.equal(f.turns.length, 1)
    assert.equal(f.row.status, 'evaluated')
  })
  await check('concurrent turn batches receive distinct consecutive ordinals', async () => {
    const f = fixture({ live: true })
    const responses = await Promise.all([f.send('A'), f.send('B')])
    assert.deepEqual(responses.map((r) => r.status), [200, 200])
    assert.deepEqual(f.turns.map((t) => t.ord), [0, 1, 2])
    assert.equal(f.stats.inputs.length, 0)
  })
  await check('ending waits for an already saving first answer and chooses completed', async () => {
    const f = fixture({ live: true, empty: true }), gate = deferred()
    f.hooks.beforeCreate = () => gate.promise
    const send = f.send('First final answer')
    await tick()
    const ending = f.end()
    await tick(); gate.resolve(); await send
    assert.equal((await ending).body.status, 'completed')
    await tick()
    assert.deepEqual(f.stats.inputs, [['First final answer']])
    f.pending[0].resolve(answer('fresh')); await Promise.all(f.background)
    assert.equal(f.row.status, 'evaluated')
  })
  await check('first late answer after empty termination starts automatic evaluation', async () => {
    const f = fixture({ empty: true }); f.row.status = 'aborted'
    assert.equal((await f.send('Recovered final answer')).status, 200)
    await tick()
    assert.equal(f.background.length, 1)
    assert.deepEqual(f.stats.inputs, [['Recovered final answer']])
    f.pending[0].resolve(answer('recovered')); await Promise.all(f.background)
    assert.equal(f.row.status, 'evaluated')
  })
  await check('turn insertion rolls back when session metadata cannot be saved', async () => {
    const f = fixture({ live: true }); f.hooks.failSessionUpdate = true
    await assert.rejects(f.send())
    assert.equal(f.turns.length, 1)
    assert.equal(f.row.status, 'live')
  })
  await check('retention expiry while request body arrives prevents speech resurrection', async () => {
    const f = fixture({ live: true }), gate = deferred(), send = f.send('Expired', gate)
    await tick(); f.advance(2 * 86400000); gate.resolve()
    assert.equal((await send).status, 410)
    assert.equal(f.turns.length, 1)
  })
  await check('unstarted sessions cannot accept fabricated speech', async () => {
    const f = fixture({ live: true, empty: true }); f.row.status = 'consented'; f.row.startedAt = null
    assert.equal((await f.send()).status, 409)
    assert.equal(f.turns.length, 0)
  })
  await check('retention expiry during sample lookup blocks the AI request', async () => {
    const f = fixture()
    f.hooks.samples = () => { f.advance(2 * 86400000) }
    const run = f.evaluate()
    await tick()
    assert.equal(f.stats.inputs.length, 0)
    assert.equal((await run).status, 410)
    assert.equal(f.row.status, 'completed')
    assert.equal(f.stats.scoreWrites, 0)
  })
  for (const operation of ['turn', 'end']) {
    await check(`${operation} automatic evaluation conflict does not emit a server error alert`, async () => {
      const f = fixture({ live: operation === 'end' })
      f.hooks.afterCommit = () => { f.row.status = 'evaluating'; f.row.updatedAt = new Date() }
      assert.equal((await (operation === 'end' ? f.end() : f.send())).status, 200)
      await Promise.all(f.background)
      assert.equal(f.stats.inputs.length, 0)
      assert.equal(f.stats.errors, 0)
      assert.equal(f.stats.warnings.length, 1)
    })
    await check(`${operation} genuine evaluation failure remains an error`, async () => {
      const f = fixture({ live: operation === 'end' })
      assert.equal((await (operation === 'end' ? f.end() : f.send())).status, 200)
      await tick()
      f.pending[0].reject(new Error('synthetic provider failure'))
      await Promise.all(f.background)
      assert.equal(f.row.status, 'completed')
      assert.equal(f.stats.errors, 1)
      assert.equal(f.stats.warnings.length, 0)
    })
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => clearTimeout(watchdog))
