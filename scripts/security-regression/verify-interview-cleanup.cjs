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

let countCalls = 0, findCalls = 0, deleteCalls = 0
let candidates = [{ id: 'old-project', materials: [] }]
const prisma = { interviewProject: {
  count: async ({ where }) => { assert(where.updatedAt.lt instanceof Date); countCalls++; return where.materials ? 34 : 123 },
  findMany: async ({ where, orderBy, take, select }) => {
    assert(where.updatedAt.lt instanceof Date)
    assert.equal(orderBy.updatedAt, 'asc')
    assert.equal(take, 100)
    assert.equal(select.id, true)
    assert.equal(select.title, undefined)
    assert.equal(select.materials.take, 1)
    assert.equal(select.materials.where.filePath.not, null)
    findCalls++
    return candidates
  },
  deleteMany: async ({ where }) => {
    assert.deepEqual(Array.from(where.id.in), ['old-project'])
    assert(where.updatedAt.lt instanceof Date)
    deleteCalls++
    return { count: 0 } // A concurrent edit can make the recheck exclude the project.
  },
} }
const route = load('src/app/api/interview/cleanup/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { __esModule: true, default: prisma },
}, { process: { env: { CRON_SECRET: 'synthetic-secret' } } })
let queueFailure = true, projectDeleteCalls = 0, queuedCalls = 0
const deleteTx = {
  systemSetting: { create: async () => { queuedCalls++; if (queueFailure) throw Error('queue unavailable') } },
  interviewProject: { delete: async () => { projectDeleteCalls++; return {} } },
}
const projectRoute = load('src/app/api/interview/projects/[id]/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { prisma: { interviewProject: {
    findUnique: async () => ({ id: 'old-project', userId: 'owner', guestId: null }),
  }, $transaction: async fn => fn(deleteTx) } },
  '@/lib/interview/access': { requireDatabase: () => null, getInterviewUser: async () => ({ userId: 'owner' }), checkOwnership: () => null },
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
  const base = 'https://test.example/api/interview/cleanup'
  assert.equal((await route.POST(request(base + '?dryRun=1', 'Bearer wrong'))).status, 401)
  assert.equal(countCalls + findCalls + deleteCalls, 0)
  const preview = await route.POST(request(base + '?dryRun=1', 'Bearer synthetic-secret'))
  assert.equal(preview.status, 200)
  assert.equal(preview.body.eligibleCount, 123)
  assert.equal(preview.body.withStorageCount, 34)
  assert.equal(countCalls, 2)
  assert.equal(findCalls + deleteCalls, 0)
  const cleanup = await route.POST(request(base, 'Bearer synthetic-secret'))
  assert.equal(cleanup.status, 200)
  assert.equal(cleanup.body.deletedCount, 0)
  assert.equal(findCalls, 1)
  assert.equal(deleteCalls, 1)
  candidates = [{ id: 'old-project', materials: [{ id: 'material-1' }] }]
  const blocked = await route.POST(request(base, 'Bearer synthetic-secret'))
  assert.equal(blocked.status, 409)
  assert.equal(blocked.body.code, 'STORAGE_PURGE_REQUIRED')
  assert.equal(deleteCalls, 1)
  candidates = []
  assert.equal((await route.POST(request(base, 'Bearer synthetic-secret'))).body.deletedCount, 0)
  assert.equal(deleteCalls, 1)
  console.log('PASS interview cleanup preview is read-only, deletion is bounded and rechecks inactivity')
})().catch(error => { console.error(error); process.exitCode = 1 })
