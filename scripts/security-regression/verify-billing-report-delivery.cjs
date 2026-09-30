const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture() {
  const rows = new Map()
  const posts = []
  let receiptFails = false
  const systemSetting = {
    create: async ({ data }) => {
      if (rows.has(data.key)) throw Object.assign(Error('duplicate'), { code: 'P2002' })
      rows.set(data.key, data.value)
      return { key: data.key, value: data.value }
    },
    findUnique: async ({ where }) => rows.has(where.key) ? { key: where.key, value: rows.get(where.key) } : null,
    updateMany: async ({ where, data }) => {
      if (rows.get(where.key) !== where.value) return { count: 0 }
      if (receiptFails && JSON.parse(data.value).status === 'sent') return { count: 0 }
      rows.set(where.key, data.value)
      return { count: 1 }
    },
  }
  const module = load('src/lib/billing-report-delivery.ts', {
    'node:crypto': { randomUUID: () => 'claim-token' },
    '@/lib/prisma': { prisma: { systemSetting } },
    '@/lib/notifications': { postPlainToSlack: async (text) => { posts.push(text) } },
  })
  return { module, rows, posts, setReceiptFailure: (value) => { receiptFails = value } }
}

;(async () => {
  await check('same scheduled report is sent once across retries', async () => {
    const f = fixture()
    assert.equal(await f.module.deliverBillingReport('2026-10-01:daily', 'first'), 'sent')
    assert.equal(await f.module.deliverBillingReport('2026-10-01:daily', 'second'), 'already_sent')
    assert.deepEqual(f.posts, ['first'])
  })
  await check('failed Slack send releases the claim for a retry', async () => {
    const f = fixture()
    await assert.rejects(f.module.deliverBillingReport('2026-10-01:monthly', 'first', undefined,
      async () => { throw Error('Slack unavailable') }), /Slack unavailable/)
    assert.equal(await f.module.deliverBillingReport('2026-10-01:monthly', 'retry'), 'sent')
    assert.deepEqual(f.posts, ['retry'])
  })
  await check('concurrent claim does not send a second copy', async () => {
    const f = fixture()
    let release
    const held = new Promise((resolve) => { release = resolve })
    const first = f.module.deliverBillingReport('2026-10-01:daily', 'first', undefined,
      async (text) => { await held; f.posts.push(text) })
    while (!Array.from(f.rows.values()).some((value) => JSON.parse(value).status === 'sending')) await new Promise(setImmediate)
    await assert.rejects(f.module.deliverBillingReport('2026-10-01:daily', 'duplicate'), /already in progress/)
    release()
    assert.equal(await first, 'sent')
    assert.deepEqual(f.posts, ['first'])
  })
  await check('unrecorded successful send stays leased rather than immediately duplicating', async () => {
    const f = fixture()
    f.setReceiptFailure(true)
    await assert.rejects(f.module.deliverBillingReport('2026-10-01:monthly', 'sent'), /receipt could not be recorded/)
    assert.deepEqual(f.posts, ['sent'])
    await assert.rejects(f.module.deliverBillingReport('2026-10-01:monthly', 'duplicate'), /already in progress/)
    assert.deepEqual(f.posts, ['sent'])
  })
  await check('corrupt receipt and invalid key fail closed before sending', async () => {
    const f = fixture()
    f.rows.set('billing-report-delivery:v1:2026-10-01:daily', '{bad json')
    await assert.rejects(f.module.deliverBillingReport('2026-10-01:daily', 'message'))
    await assert.rejects(f.module.deliverBillingReport('other:key', 'message'), /key is invalid/)
    assert.deepEqual(f.posts, [])
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
