const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let storageError = true
const storageLogs = []
const storage = load('src/lib/interview/storage.ts', {
  '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({
    remove: async () => ({ error: storageError ? { message: 'private path and provider detail' } : null }),
  }) } }) },
}, { process: { env: { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic' } }, console: { error: message => storageLogs.push(message) } })
const access = load('src/lib/interview/access.ts', {
  'next/server': { NextResponse: { json: () => ({}) } },
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: {} },
})

let countCalls = 0, findCalls = 0, retentionDeletes = 0, retentionQueues = 0
let activeProcessing = false
let candidates = [{ id: 'old-project' }], currentUpdatedAt = new Date(0), concurrentEdit = false
const retentionTx = {
  $queryRaw: async () => [{}],
  interviewMaterial: { count: async () => activeProcessing ? 1 : 0 },
  interviewProject: {
    findUnique: async () => ({ id: 'old-project', userId: 'owner', guestId: null, updatedAt: currentUpdatedAt }),
    deleteMany: async ({ where }) => { assert.equal(where.id, 'old-project'); assert(where.updatedAt.lt instanceof Date); retentionDeletes++; return { count: concurrentEdit ? 0 : 1 } },
  },
  systemSetting: { create: async () => { retentionQueues++ } },
}
const prisma = {
  interviewProject: {
    count: async ({ where }) => { assert(where.updatedAt.lt instanceof Date); countCalls++; return where.materials ? 34 : 123 },
    findMany: async ({ where, orderBy, take, select }) => {
      assert(where.updatedAt.lt instanceof Date)
      assert.equal(orderBy.updatedAt, 'asc')
      assert.equal(take, 10)
      assert.equal(select.id, true)
      findCalls++
      return candidates
    },
  },
  $transaction: async callback => callback(retentionTx),
}
const routeFor = enabled => load('src/app/api/interview/cleanup/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { __esModule: true, default: prisma },
  '@/lib/interview/transcription-budget': { preserveInterviewTranscriptionUsageBeforeDelete: async () => {} },
  '@/lib/interview/storage-purge-queue': { enqueueInterviewProjectStoragePurge: async (tx, project) => { assert.equal(tx, retentionTx); assert.equal(project.id, 'old-project'); await tx.systemSetting.create() } },
}, { process: { env: { CRON_SECRET: 'synthetic-secret', ...(enabled ? { INTERVIEW_RETENTION_DELETE_ENABLED: '1' } : {}) } } })
const disabledRoute = routeFor(false)
const enabledRoute = routeFor(true)
let queueFailure = true, projectDeleteCalls = 0, queuedCalls = 0
const deleteTx = {
  $queryRaw: async () => [{}],
  interviewMaterial: { count: async () => activeProcessing ? 1 : 0 },
  systemSetting: { create: async () => { queuedCalls++; if (queueFailure) throw Error('queue unavailable') } },
  interviewProject: { delete: async () => { projectDeleteCalls++; return {} } },
}
const projectRoute = load('src/app/api/interview/projects/[id]/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { prisma: { interviewProject: {
    findUnique: async () => ({ id: 'old-project', userId: 'owner', guestId: null }),
  }, $transaction: async fn => fn(deleteTx) } },
  '@/lib/interview/access': { requireDatabase: () => null, getInterviewUser: async () => ({ userId: 'owner' }), checkOwnership: () => null },
  '@/lib/interview/transcription-budget': { preserveInterviewTranscriptionUsageBeforeDelete: async () => {} },
  '@/lib/interview/storage-purge-queue': { enqueueInterviewProjectStoragePurge: async (tx, project) => { assert.equal(tx, deleteTx); assert.equal(project.id, 'old-project'); await tx.systemSetting.create() } },
})
const request = (url, authorization) => ({ nextUrl: new URL(url), headers: { get: name => name === 'authorization' ? authorization : null } })

;(async () => {
  const cookie = value => ({ cookies: { get: () => ({ value }) } })
  assert.equal(access.getGuestIdFromRequest(cookie('123e4567-e89b-12d3-a456-426614174000')), '123e4567-e89b-12d3-a456-426614174000')
  assert.equal(access.getGuestIdFromRequest(cookie('1750000000000_abcd')), '1750000000000_abcd')
  assert.equal(access.getGuestIdFromRequest(cookie('../other')), null)
  assert.match(storage.buildStoragePath({ guestId: '123e4567-e89b-12d3-a456-426614174000', projectId: 'project-1', fileName: 'test.png' }), /^guest_123e4567-e89b-12d3-a456-426614174000\/project-1\//)
  assert.throws(() => storage.buildStoragePath({ guestId: '../other', projectId: 'project-1', fileName: 'test.png' }), /不正なストレージ識別子/)
  await assert.rejects(() => storage.deleteFile('private/customer/file.mp3'), /ファイル削除に失敗/)
  assert.deepEqual(storageLogs, ['[interview] File delete failed'])
  storageError = false
  await storage.deleteFile('private/customer/file.mp3')
  const ctx = { params: Promise.resolve({ id: 'old-project' }) }
  assert.equal((await projectRoute.DELETE({}, ctx)).status, 500)
  assert.equal(projectDeleteCalls, 0)
  queueFailure = false
  const deleted = await projectRoute.DELETE({}, ctx)
  assert.equal(deleted.status, 200)
  assert.equal(deleted.body.fileCleanupPending, true)
  assert.equal(queuedCalls, 2)
  assert.equal(projectDeleteCalls, 1)
  activeProcessing = true
  assert.equal((await projectRoute.DELETE({}, ctx)).status, 409)
  assert.equal(queuedCalls, 2)
  activeProcessing = false
  const base = 'https://test.example/api/interview/cleanup'
  assert.equal((await disabledRoute.POST(request(base + '?dryRun=1', 'Bearer wrong'))).status, 401)
  assert.equal(countCalls + findCalls + retentionDeletes, 0)
  const preview = await disabledRoute.POST(request(base + '?dryRun=1', 'Bearer synthetic-secret'))
  assert.equal(preview.status, 200)
  assert.equal(preview.body.eligibleCount, 123)
  assert.equal(preview.body.withStorageCount, 34)
  assert.equal(countCalls, 2)
  assert.equal(findCalls + retentionDeletes, 0)
  const blocked = await disabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.code, 'RETENTION_DELETE_NOT_ENABLED')
  assert.equal((await enabledRoute.POST(request(base, 'Bearer synthetic-secret'))).status, 409)
  assert.equal(findCalls, 0)
  const cleanup = await enabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))
  assert.equal(cleanup.status, 200)
  assert.equal(cleanup.body.deletedCount, 1)
  assert.equal(retentionQueues, 1)
  assert.equal(retentionDeletes, 1)
  activeProcessing = true
  const busy = await enabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))
  assert.equal(busy.body.skippedCount, 1)
  assert.equal(retentionDeletes, 1)
  activeProcessing = false
  currentUpdatedAt = new Date()
  const changed = await enabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))
  assert.equal(changed.body.skippedCount, 1)
  assert.equal(retentionQueues, 1)
  currentUpdatedAt = new Date(0)
  concurrentEdit = true
  const conflicted = await enabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))
  assert.equal(conflicted.status, 503)
  assert.equal(conflicted.body.failedCount, 1)
  candidates = []
  assert.equal((await enabledRoute.POST(request(base + '?execute=1', 'Bearer synthetic-secret'))).body.deletedCount, 0)
  console.log('PASS interview cleanup preview is read-only, deletion is gated, bounded and rechecks inactivity')
})().catch(error => { console.error(error); process.exitCode = 1 })
