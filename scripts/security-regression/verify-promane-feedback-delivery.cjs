const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function fixture({ webhook = 'https://hooks.example.invalid/feedback', delivery = 'ok', authenticated = true, storage = 'ok', message = 'Please fix my report' } = {}) {
  let calls = 0, saves = 0
  const logs = []
  const route = load('src/app/api/promane/feedback/route.ts', {
    '../../../../lib/slack-context-comment': { applyContextComment: value => value },
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => authenticated ? { user: { id: 'user', email: 'private@example.invalid', name: 'Private User' } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      serviceFeedback: { create: async ({ data }) => { saves++; assert.equal(data.serviceId, 'promane'); assert(data.text.includes(message)); if (storage !== 'ok') throw Error('storage unavailable'); return { id: 'saved' } } },
      systemSetting: { findUnique: async () => webhook ? { value: webhook } : null },
    } },
  }, {
    fetch: async (_, init) => { calls++; assert.equal(init.signal.aborted, false); if (delivery === 'throw') throw Error('provider unavailable'); return { ok: delivery === 'ok', status: delivery === 'ok' ? 200 : 503 } },
    AbortSignal,
    console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args), log: (...args) => logs.push(args) },
    process: { env: {} },
  })
  return { run: () => route.POST({ json: async () => ({ type: 'bug', message, page: '/promane' }) }), state: () => ({ calls, saves, logs }) }
}
;(async () => {
  await check('authenticated feedback is saved even with no webhook', async () => {
    const f = fixture({ webhook: null })
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(JSON.stringify(await response.json())), { success: true, stored: true, notified: false })
    assert.equal(f.state().saves, 1)
    assert.equal(f.state().calls, 0)
    assert(!JSON.stringify(f.state().logs).includes('Please fix my report'))
    assert(!JSON.stringify(f.state().logs).includes('private@example.invalid'))
  })
  for (const delivery of ['http-error', 'throw']) await check(`failed feedback notification ${delivery} preserves saved report`, async () => {
    const f = fixture({ delivery })
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(JSON.stringify(await response.json())), { success: true, stored: true, notified: false })
    assert.equal(f.state().saves, 1)
    assert.equal(f.state().calls, 1)
  })
  await check('anonymous feedback needs confirmed webhook delivery', async () => {
    for (const args of [{ webhook: null }, { delivery: 'http-error' }, { delivery: 'throw' }]) {
      const f = fixture({ authenticated: false, ...args })
      const response = await f.run()
      assert.equal(response.status, 503)
      assert.equal(f.state().saves, 0)
    }
  })
  await check('storage failure can fall back to confirmed webhook delivery', async () => {
    const f = fixture({ storage: 'failed' })
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(JSON.stringify(await response.json())), { success: true, stored: false, notified: true })
    assert.equal(f.state().calls, 1)
  })
  await check('feedback rejects when both storage and webhook fail', async () => {
    const f = fixture({ storage: 'failed', delivery: 'http-error' })
    const response = await f.run()
    assert.equal(response.status, 503)
    assert.equal(f.state().calls, 1)
  })
  await check('feedback reports notification success only after webhook succeeds', async () => {
    const f = fixture()
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.deepEqual(JSON.parse(JSON.stringify(await response.json())), { success: true, stored: true, notified: true })
    assert.equal(f.state().calls, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
