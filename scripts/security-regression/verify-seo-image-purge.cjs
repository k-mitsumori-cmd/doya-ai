const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  const settings = new Map()
  let failStorage = false
  const removed = []
  const linked = new Set(['supabase:images/linked.png'])
  const db = {
    seoImage: {
      findMany: async ({ where }) => where.filePath ? where.filePath.in.filter(path => linked.has(path)).map(filePath => ({ filePath })) : [
        { filePath: 'supabase:images/one.png' },
        { filePath: 'supabase:images/one.png' },
        { filePath: 'images/legacy.png' },
        { filePath: 'supabase:images/two.png' },
      ],
      findFirst: async ({ where }) => linked.has(where.filePath) ? { id: 'linked' } : null,
    },
    systemSetting: {
      upsert: async ({ where, create, update }) => settings.set(where.key, settings.has(where.key) ? update.value : create.value),
      findMany: async ({ where, take }) => [...settings].filter(([key]) => typeof where.key === 'string' ? key === where.key : key.startsWith(where.key.startsWith)).slice(0, take).map(([key, value]) => ({ key, value })),
      deleteMany: async ({ where }) => {
        if (typeof where.key === 'object') { for (const key of where.key.in) settings.delete(key); return }
        if (settings.get(where.key) === where.value) settings.delete(where.key)
      },
    },
  }
  const purge = load('src/lib/seo-image-purge.ts', {
    '@/lib/prisma': { prisma: db },
    '@seo/lib/storage': { removeSeoStoredImages: async paths => { if (failStorage) throw Error('unavailable'); removed.push(paths) } },
  })
  await check('article deletion queues only distinct durable images', async () => {
    await purge.queueSeoArticleImagePurge(db, 'article')
    assert.deepEqual(JSON.parse(settings.get('seo-image-purge:v1:article')), ['supabase:images/one.png', 'supabase:images/two.png'])
  })
  await check('storage failure retains a retryable queue', async () => {
    settings.set('seo-image-purge:v1:other', JSON.stringify(['supabase:images/other.png']))
    failStorage = true
    assert.equal(JSON.stringify(await purge.purgeQueuedSeoImages(db, 1, 'article')), JSON.stringify({ processed: 1, completed: 0, failed: 1 }))
    assert.equal(settings.size, 2)
  })
  await check('successful retry removes objects and clears only the matching queue entry', async () => {
    failStorage = false
    assert.equal(JSON.stringify(await purge.purgeQueuedSeoImages(db, 1, 'article')), JSON.stringify({ processed: 1, completed: 1, failed: 0 }))
    assert.equal(JSON.stringify(removed[0]), JSON.stringify(['supabase:images/one.png', 'supabase:images/two.png']))
    assert.equal(settings.size, 1)
    assert.ok(settings.has('seo-image-purge:v1:other'))
    assert.equal(JSON.stringify(await purge.purgeQueuedSeoImages(db)), JSON.stringify({ processed: 1, completed: 1, failed: 0 }))
    assert.equal(settings.size, 0)
  })
  await check('invalid queue data fails closed', async () => {
    settings.set('seo-image-purge:v1:bad', '["../../other.png"]')
    assert.equal(JSON.stringify(await purge.purgeQueuedSeoImages(db)), JSON.stringify({ processed: 1, completed: 0, failed: 1 }))
    assert.equal(settings.size, 1)
  })
  await check('pending uploads reconcile only after the grace period and preserve linked images', async () => {
    const old = '2026-09-24T00:00:00.000Z'
    const fresh = '2026-09-25T11:30:00.000Z'
    settings.set('seo-image-pending:v1:orphan', JSON.stringify({ path: 'supabase:images/orphan.png', createdAt: old }))
    settings.set('seo-image-pending:v1:linked', JSON.stringify({ path: 'supabase:images/linked.png', createdAt: old }))
    settings.set('seo-image-pending:v1:fresh', JSON.stringify({ path: 'supabase:images/fresh.png', createdAt: fresh }))
    const result = await purge.reconcilePendingSeoImages(db, new Date('2026-09-25T12:00:00.000Z'))
    assert.equal(JSON.stringify(result), JSON.stringify({ processed: 3, completed: 2, deferred: 1, failed: 0 }))
    assert.equal(settings.has('seo-image-pending:v1:orphan'), false)
    assert.equal(settings.has('seo-image-pending:v1:linked'), false)
    assert.equal(settings.has('seo-image-pending:v1:fresh'), true)
    assert.equal(JSON.stringify(removed.at(-1)), JSON.stringify(['supabase:images/orphan.png']))
  })
  await check('storage outage retains orphan intent for retry', async () => {
    settings.set('seo-image-pending:v1:retry', JSON.stringify({ path: 'supabase:images/retry.png', createdAt: '2026-09-24T00:00:00.000Z' }))
    failStorage = true
    const result = await purge.reconcilePendingSeoImages(db, new Date('2026-09-25T12:00:00.000Z'))
    assert.equal(result.failed, 1)
    assert.ok(settings.has('seo-image-pending:v1:retry'))
    failStorage = false
  })
  await check('cleanup cron requires its secret before database work', async () => {
    let calls = 0
    const api = load('src/app/api/cron/seo-image-purge/route.ts', {
      '@/lib/prisma': { prisma: db },
      '@/lib/seo-image-purge': { purgeQueuedSeoImages: async () => { calls++; return { processed: 0, completed: 0, failed: 0 } }, reconcilePendingSeoImages: async () => ({ processed: 0, completed: 0, deferred: 0, failed: 0 }) },
    }, { process: { env: { CRON_SECRET: 'test-secret' } } })
    assert.equal((await api.GET(new Request('https://example.test/api/cron/seo-image-purge'))).status, 401)
    assert.equal(calls, 0)
    assert.equal((await api.GET(new Request('https://example.test/api/cron/seo-image-purge', { headers: { authorization: 'Bearer test-secret' } }))).status, 200)
    assert.equal(calls, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
