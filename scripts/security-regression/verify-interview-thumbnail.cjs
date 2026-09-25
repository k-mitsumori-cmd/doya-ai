const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

;(async () => {
  await check('interview thumbnail lease blocks duplicate work and only its owner releases it', async () => {
    const lease = load('src/lib/interview/thumbnail-lease.ts', {
      'node:crypto': { randomUUID: () => Math.random().toString(36).slice(2) },
      '@/lib/prisma': { prisma: {} },
    })
    const rows = new Map()
    let tail = Promise.resolve()
    const tx = {
      $executeRaw: async () => {},
      systemSetting: {
        findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
        upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
      },
    }
    const db = {
      $transaction: async fn => {
        let release
        const before = tail
        tail = new Promise(resolve => { release = resolve })
        await before
        try { return await fn(tx) } finally { release() }
      },
      systemSetting: { deleteMany: async ({ where }) => { if (rows.get(where.key) === where.value) rows.delete(where.key) } },
    }
    const first = await lease.claimThumbnailLease('project-1', db, 1000)
    const contenders = await Promise.allSettled([
      lease.claimThumbnailLease('project-1', db, 1000),
      lease.claimThumbnailLease('project-1', db, 1000),
    ])
    assert.equal(contenders.filter(result => result.reason instanceof lease.ThumbnailGenerationInProgressError).length, 2)
    await lease.releaseThumbnailLease('project-1', 'wrong-token', db)
    await assert.rejects(lease.claimThumbnailLease('project-1', db, 1000), lease.ThumbnailGenerationInProgressError)
    await lease.releaseThumbnailLease('project-1', first, db)
    assert.notEqual(await lease.claimThumbnailLease('project-1', db, 1000), first)
    assert.ok(await lease.claimThumbnailLease('project-1', db, 361001))
  })

  await check('thumbnail storage uses a private project path and rejects oversized output', async () => {
    const uploads = []
    const storage = load('src/lib/interview/thumbnail-storage.ts', {
      './storage': {
        BUCKET_NAME: 'private-interview', ensureBucket: async () => {},
        getSupabaseAdmin: () => ({ storage: {
          getBucket: async () => ({ data: { public: false }, error: null }),
          from: bucket => {
            assert.equal(bucket, 'private-interview')
            return {
              upload: async (path, bytes, options) => { uploads.push({ path, bytes, options }); return { error: null } },
              download: async () => ({ data: new Blob(['image'], { type: 'image/png' }), error: null }),
            }
          },
        } }),
      },
    }, { Buffer, Blob })
    assert.equal(storage.thumbnailUrlForClient('p1', storage.THUMBNAIL_STORAGE_MARKER, new Date(1000)), '/api/interview/projects/p1/thumbnail?v=1000')
    assert.equal(storage.thumbnailUrlForClient('p1', 'data:image/png;base64,AAAA', new Date(1000)), 'data:image/png;base64,AAAA')
    await storage.uploadInterviewThumbnail('u1', 'p1', 'image/png', Buffer.from('image').toString('base64'))
    assert.equal(uploads[0].path, 'u1/p1/thumbnail')
    assert.equal(uploads[0].options.upsert, true)
    await assert.rejects(storage.uploadInterviewThumbnail('u1', 'p1', 'text/html', 'AAAA'), /画像形式/)
    await assert.rejects(storage.uploadInterviewThumbnail('u1', 'p1', 'image/png', Buffer.alloc(8 * 1024 * 1024 + 1).toString('base64')), /画像サイズ/)
    assert.equal((await storage.downloadInterviewThumbnail('u1', 'p1')).type, 'image/png')
  })

  await check('cached thumbnail skips provider; manual regeneration persists private image and remains owner-only', async () => {
    let providerCalls = 0
    let uploads = 0
    let leases = 0
    let releases = 0
    let owner = 'u1'
    let blocked = false
    let failUpload = false
    let writes = 0
    const project = { id: 'p1', userId: 'u1', guestId: null, thumbnailUrl: 'data:image/png;base64,AAAA', updatedAt: new Date(1000), title: 'Article', genre: 'OTHER' }
    class InProgress extends Error {}
    const api = load('src/app/api/interview/projects/[id]/thumbnail/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {
        interviewProject: { findUnique: async () => project },
        interviewDraft: { findFirst: async () => null },
        interviewTranscription: { findMany: async () => [] },
        $transaction: async fn => fn({
          $executeRaw: async () => {},
          interviewProject: {
            findUnique: async () => project,
            update: async ({ data }) => { writes++; project.thumbnailUrl = data.thumbnailUrl; project.updatedAt = new Date(2000); return { updatedAt: project.updatedAt } },
          },
        }),
      } },
      '@/lib/interview/access': {
        getInterviewUser: async () => ({ userId: owner }),
        getGuestIdFromRequest: () => null,
        checkOwnership: resource => resource.userId === owner ? null : Response.json({ error: 'not found' }, { status: 404 }),
        requireDatabase: () => null,
      },
      '@/lib/resolve-image-model': { callGeminiImageAPI: async () => {
        providerCalls++
        return { response: { json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }] } }] }) }, model: 'test' }
      } },
      '@/lib/interview/thumbnail-storage': {
        THUMBNAIL_STORAGE_MARKER: 'marker',
        thumbnailOwner: () => 'u1',
        thumbnailUrlForClient: (_id, stored, date) => stored === 'marker' ? `/image?v=${date.getTime()}` : stored,
        uploadInterviewThumbnail: async () => { uploads++; if (failUpload) throw new Error('storage unavailable') },
        downloadInterviewThumbnail: async () => new Blob(['image'], { type: 'image/png' }),
      },
      '@/lib/interview/thumbnail-lease': {
        ThumbnailGenerationInProgressError: InProgress,
        claimThumbnailLease: async () => { leases++; if (blocked) throw new InProgress(); return 'token' },
        releaseThumbnailLease: async () => { releases++ },
      },
    }, { process: { env: { GOOGLE_GENAI_API_KEY: 'test' } } })
    const ctx = { params: Promise.resolve({ id: 'p1' }) }
    const request = body => ({ json: async () => body, cookies: {} })
    assert.equal((await api.POST(request({}), ctx)).status, 200)
    assert.equal(providerCalls, 0)
    assert.equal(leases, 0)
    const generated = await api.POST(request({ force: true }), ctx)
    assert.equal(generated.status, 200)
    assert.equal((await generated.json()).thumbnailUrl, '/image?v=2000')
    assert.equal(providerCalls, 1)
    assert.equal(uploads, 1)
    assert.equal(releases, 1)
    assert.equal(project.thumbnailUrl, 'marker')
    assert.equal((await api.GET(request({}), ctx)).status, 200)
    blocked = true
    assert.equal((await api.POST(request({ force: true }), ctx)).status, 409)
    assert.equal(providerCalls, 1)
    blocked = false
    failUpload = true
    assert.equal((await api.POST(request({ force: true }), ctx)).status, 500)
    assert.equal(writes, 1, 'A failed upload must not change the project record')
    assert.equal(releases, 2)
    owner = 'other'
    assert.equal((await api.GET(request({}), ctx)).status, 404)
    assert.equal(uploads, 2)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
