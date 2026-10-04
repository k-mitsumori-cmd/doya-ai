const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let infoResult = { data: { size: 123, contentType: 'audio/wav' }, error: null }
let inspectedPath = ''
const storage = load('src/lib/interview/storage.ts', {
  'node:crypto': { randomUUID: () => 'test-uuid' },
  '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({
    info: async (path) => { inspectedPath = path; return infoResult },
  }) } }) },
}, { process: { env: { SUPABASE_URL: 'https://storage.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key' } } })

let guestId = null
const access = load('src/lib/interview/access.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
}, { process: { env: { DATABASE_URL: 'postgres://test' } } })

let currentSize = 80
let currentStatus = 'UPLOADED'
let currentFileUrl = null
let metadataReads = 0
let signedReads = 0
let queued = []
let currentOwner = { userId: null, guestId: 'guest-1' }
let claimAfterMetadata = false
const material = () => ({
  id: 'material-1', projectId: 'project-1', filePath: 'guest_guest-1/project-1/audio.wav',
  fileName: 'audio.wav', mimeType: 'audio/wav', type: 'audio', status: currentStatus,
  fileUrl: currentFileUrl, project: currentOwner,
})
const tx = {
  $executeRaw: async () => 1,
  interviewMaterial: {
    findUnique: async () => material(),
    updateMany: async ({ where, data }) => {
      const statusMatches = typeof where.status === 'string' ? where.status === currentStatus : where.status.in.includes(currentStatus)
      if (!statusMatches || (where.fileUrl === null && currentFileUrl !== null) || where.filePath !== material().filePath) return { count: 0 }
      currentStatus = data.status
      if (data.fileUrl) currentFileUrl = data.fileUrl
      if (data.fileSize) currentSize = Number(data.fileSize)
      return { count: 1 }
    },
  },
  systemSetting: { create: async ({ data }) => { queued.push(data); return data } },
}
const prisma = {
  interviewMaterial: {
    findUnique: async () => material(),
  },
  $transaction: async (fn) => fn(tx),
}
const purge = load('src/lib/interview/storage-purge-queue.ts', {
  './storage': { deleteFile: async () => {}, purgeInterviewProjectStorageBatch: async () => true },
})
const confirm = load('src/app/api/interview/materials/confirm/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': access,
  '@/lib/interview/storage': {
    ensureBucket: async () => {}, getDetectedMaxFileSize: () => 500,
    getFileMetadata: async () => { metadataReads++; if (claimAfterMetadata) currentOwner = { userId: 'account-1', guestId: 'guest-1' }; return { size: currentSize, mimeType: 'audio/wav' } },
    getSignedFileUrl: async () => { signedReads++; return 'https://storage.example.test/signed' },
  },
  '@/lib/interview/types': { getMaxFileSize: () => 500 },
  '@/lib/pricing': { getInterviewGuestLimits: () => ({ uploadSizeLimit: 100 }), getInterviewLimitsByPlan: () => ({ uploadSizeLimit: 200 }) },
  '@/lib/interview/storage-purge-queue': purge,
}, { process: { env: { DATABASE_URL: 'postgres://test' } } })

const request = () => ({ cookies: { get: () => guestId ? { value: guestId } : undefined }, json: async () => ({ materialId: 'material-1' }) })

;(async () => {
  await check('storage lookup uses exact object path and distinguishes missing from outage', async () => {
    assert.deepEqual(JSON.parse(JSON.stringify(await storage.getFileMetadata('guest_guest-1/project-1/audio.wav'))), { size: 123, mimeType: 'audio/wav' })
    assert.equal(inspectedPath, 'guest_guest-1/project-1/audio.wav')
    infoResult = { data: null, error: { status: 404 } }
    assert.equal(await storage.getFileMetadata('missing'), null)
    infoResult = { data: null, error: { status: 503 } }
    await assert.rejects(() => storage.getFileMetadata('outage'))
  })

  await check('missing or foreign guest cookie cannot confirm or inspect an object', async () => {
    assert.equal((await confirm.POST(request())).status, 401)
    guestId = 'other-guest'
    assert.equal((await confirm.POST(request())).status, 404)
    assert.equal(metadataReads, 0)
    assert.equal(signedReads, 0)
  })

  await check('actual oversized file is rejected and queued for durable cleanup', async () => {
    guestId = 'guest-1'
    currentSize = 101
    const res = await confirm.POST(request())
    assert.equal(res.status, 413)
    const body = await res.json()
    assert.equal(body.code, 'UPLOAD_LIMIT_REACHED')
    assert.equal(body.limitSource, 'plan')
    assert.equal(body.actionUrl, '/auth/signin?callbackUrl=/interview')
    assert.equal(currentStatus, 'ERROR')
    assert.equal(currentFileUrl, null)
    assert.equal(signedReads, 0)
    assert.equal(queued.length, 1)
    assert.match(queued[0].key, /^interview-file-purge:v1:material-1$/)
  })

  await check('storage ceiling does not claim that an upgrade will help', async () => {
    currentStatus = 'UPLOADED'; currentSize = 501; queued = []
    const res = await confirm.POST(request())
    assert.equal(res.status, 413)
    const body = await res.json()
    assert.equal(body.limitSource, 'storage')
    assert.equal(body.actionUrl, undefined)
    assert.match(body.error, /分割または圧縮/)
    assert.equal(queued.length, 1)
  })

  await check('valid file stores storage-reported size after ownership check', async () => {
    currentStatus = 'UPLOADED'; currentSize = 81; queued = []
    const res = await confirm.POST(request())
    assert.equal(res.status, 200)
    assert.equal(currentSize, 81)
    assert.equal(currentStatus, 'COMPLETED')
    assert.equal(currentFileUrl, 'https://storage.example.test/signed')
    assert.equal(queued.length, 0)
  })
  await check('claim during storage lookup blocks both confirmation and over-limit purge', async () => {
    currentStatus = 'UPLOADED'; currentFileUrl = null; currentSize = 81; queued = []
    claimAfterMetadata = true
    assert.equal((await confirm.POST(request())).status, 404)
    assert.equal(currentStatus, 'UPLOADED')
    currentOwner = { userId: null, guestId: 'guest-1' }
    currentSize = 101
    assert.equal((await confirm.POST(request())).status, 404)
    assert.equal(currentStatus, 'UPLOADED')
    assert.equal(queued.length, 0)
    claimAfterMetadata = false
    currentOwner = { userId: null, guestId: 'guest-1' }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
