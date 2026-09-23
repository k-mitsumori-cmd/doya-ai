const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const now = new Date('2026-09-24T00:00:00.000Z')
const rows = new Map()
let batchMode = 'files', batchCalls = 0
let fileDeleteCalls = 0, fileDeleteFails = false
const queue = load('src/lib/interview/storage-purge-queue.ts', {
  './storage': { purgeInterviewProjectStorageBatch: async prefix => {
    assert.equal(prefix, 'owner/project-1')
    batchCalls++
    if (batchMode === 'failure') throw Error('private provider detail')
    return batchMode === 'empty'
  }, deleteFile: async path => {
    assert.equal(path, 'owner/project-1/123_file.mp3')
    fileDeleteCalls++
    if (fileDeleteFails) throw Error('private provider detail')
  } },
})
const db = { systemSetting: {
  create: async ({ data }) => { if (rows.has(data.key)) throw Error('duplicate'); rows.set(data.key, data.value); return data },
  findMany: async ({ where, take }) => [...rows].filter(([key, value]) => key.startsWith(where.key.startsWith) && value <= where.value.lte).sort((a, b) => a[1].localeCompare(b[1])).slice(0, take).map(([key, value]) => ({ key, value })),
  updateMany: async ({ where, data }) => { if (rows.get(where.key) !== where.value) return { count: 0 }; rows.set(where.key, data.value); return { count: 1 } },
  deleteMany: async ({ where }) => { if (rows.get(where.key) !== where.value) return { count: 0 }; rows.delete(where.key); return { count: 1 } },
} }

let publicBucket = false, removalFailure = false
const objects = new Set(Array.from({ length: 101 }, (_, i) => `owner/project-1/file-${i}`))
objects.add('other/project-1/keep')
const fileOps = {
  list: async prefix => ({ data: [...objects].filter(path => path.startsWith(`${prefix}/`)).slice(0, 100).map(path => ({ id: 'object', name: path.slice(prefix.length + 1) })) }),
  remove: async paths => { if (removalFailure) return { error: {} }; paths.forEach(path => objects.delete(path)); return { error: null } },
}
const storage = load('src/lib/interview/storage.ts', {
  '@supabase/supabase-js': { createClient: () => ({ storage: {
    getBucket: async () => ({ data: { public: publicBucket } }),
    from: () => fileOps,
  } }) },
}, { process: { env: { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' } } })
let cronFailed = false, cronCalls = 0
const cron = load('src/app/api/cron/interview-storage-purge/route.ts', {
  '@/lib/prisma': { prisma: db },
  '@/lib/interview/storage-purge-queue': { purgeQueuedInterviewStorage: async received => {
    assert.equal(received, db)
    cronCalls++
    return { processed: 1, finalized: 0, pending: cronFailed ? 0 : 1, failed: cronFailed ? 1 : 0 }
  } },
}, { process: { env: { CRON_SECRET: 'synthetic-secret' } } })

;(async () => {
  for (const token of ['', 'Bearer wrong']) {
    assert.equal((await cron.GET(new Request('https://test.example', { headers: { authorization: token } }))).status, 401)
  }
  assert.equal(cronCalls, 0)
  assert.equal((await cron.GET(new Request('https://test.example', { headers: { authorization: 'Bearer synthetic-secret' } }))).status, 200)
  cronFailed = true
  assert.equal((await cron.GET(new Request('https://test.example', { headers: { authorization: 'Bearer synthetic-secret' } }))).status, 503)
  await assert.rejects(() => queue.enqueueInterviewProjectStoragePurge(db, { id: 'project-1', userId: '../owner', guestId: null }, now))
  assert.equal(rows.size, 0)
  await queue.enqueueInterviewProjectStoragePurge(db, { id: 'project-1', userId: 'owner', guestId: null }, now)
  assert.equal(rows.size, 1)
  let result = await queue.purgeQueuedInterviewStorage(db, now)
  assert.equal(result.processed, 1)
  assert.equal(result.pending, 1)
  assert.equal(rows.size, 1)
  batchMode = 'empty'
  result = await queue.purgeQueuedInterviewStorage(db, new Date(now.getTime() + 60_001))
  assert.equal(result.pending, 1)
  assert.equal(rows.size, 1) // Keep task until signed upload URLs have expired.
  result = await queue.purgeQueuedInterviewStorage(db, new Date(now.getTime() + 3 * 60 * 60 * 1000 + 1))
  assert.equal(result.finalized, 1)
  assert.equal(rows.size, 0)
  assert.equal(batchCalls, 3)
  await queue.enqueueInterviewProjectStoragePurge(db, { id: 'project-1', userId: 'owner', guestId: null }, now)
  batchMode = 'failure'
  result = await queue.purgeQueuedInterviewStorage(db, now)
  assert.equal(result.failed, 1)
  assert.equal(rows.size, 1)
  assert.equal((await queue.purgeQueuedInterviewStorage(db, new Date(now.getTime() + 60_000))).processed, 0)

  rows.clear()
  await assert.rejects(() => queue.enqueueInterviewMaterialStoragePurge(db,
    { id: 'm1', projectId: 'project-1', filePath: 'other/project-1/123_file.mp3', userId: 'owner', guestId: null }, now))
  await queue.enqueueInterviewMaterialStoragePurge(db,
    { id: 'm1', projectId: 'project-1', filePath: 'owner/project-1/123_file.mp3', userId: 'owner', guestId: null }, now)
  fileDeleteFails = true
  result = await queue.purgeQueuedInterviewStorage(db, now)
  assert.equal(result.failed, 1)
  assert.equal(rows.size, 1)
  fileDeleteFails = false
  result = await queue.purgeQueuedInterviewStorage(db, new Date(now.getTime() + 5 * 60 * 1000 + 1))
  assert.equal(result.pending, 1)
  assert.equal(rows.size, 1)
  result = await queue.purgeQueuedInterviewStorage(db, new Date(now.getTime() + 3 * 60 * 60 * 1000 + 1))
  assert.equal(result.finalized, 1)
  assert.equal(rows.size, 0)
  assert.equal(fileDeleteCalls, 3)

  await assert.rejects(() => storage.purgeInterviewProjectStorageBatch('../other'))
  publicBucket = true
  await assert.rejects(() => storage.purgeInterviewProjectStorageBatch('owner/project-1'))
  publicBucket = false
  removalFailure = true
  await assert.rejects(() => storage.purgeInterviewProjectStorageBatch('owner/project-1'))
  assert.equal(objects.size, 102)
  removalFailure = false
  assert.equal(await storage.purgeInterviewProjectStorageBatch('owner/project-1'), false)
  assert.equal(await storage.purgeInterviewProjectStorageBatch('owner/project-1'), false)
  assert.equal(await storage.purgeInterviewProjectStorageBatch('owner/project-1'), true)
  assert.deepEqual([...objects], ['other/project-1/keep'])
  console.log('PASS interview storage purge is durable, leased, delayed for uploads and namespace-bound')
})().catch(error => { console.error(error); process.exitCode = 1 })
