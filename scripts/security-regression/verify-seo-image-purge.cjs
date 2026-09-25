const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  const settings = new Map()
  let failStorage = false
  const removed = []
  const db = {
    seoImage: {
      findMany: async () => [
        { filePath: 'supabase:images/one.png' },
        { filePath: 'supabase:images/one.png' },
        { filePath: 'images/legacy.png' },
        { filePath: 'supabase:images/two.png' },
      ],
    },
    systemSetting: {
      upsert: async ({ where, create, update }) => settings.set(where.key, settings.has(where.key) ? update.value : create.value),
      findMany: async ({ where, take }) => [...settings].filter(([key]) => typeof where.key === 'string' ? key === where.key : key.startsWith(where.key.startsWith)).slice(0, take).map(([key, value]) => ({ key, value })),
      deleteMany: async ({ where }) => {
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
  await check('cleanup cron requires its secret before database work', async () => {
    let calls = 0
    const api = load('src/app/api/cron/seo-image-purge/route.ts', {
      '@/lib/prisma': { prisma: db },
      '@/lib/seo-image-purge': { purgeQueuedSeoImages: async () => { calls++; return { processed: 0, completed: 0, failed: 0 } } },
    }, { process: { env: { CRON_SECRET: 'test-secret' } } })
    assert.equal((await api.GET(new Request('https://example.test/api/cron/seo-image-purge'))).status, 401)
    assert.equal(calls, 0)
    assert.equal((await api.GET(new Request('https://example.test/api/cron/seo-image-purge', { headers: { authorization: 'Bearer test-secret' } }))).status, 200)
    assert.equal(calls, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
