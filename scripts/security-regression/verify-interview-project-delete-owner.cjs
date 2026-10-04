const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const original = { id: 'p1', userId: null, guestId: 'guest1' }
let current = { ...original }
let purges = 0
let deletes = 0
let updates = 0
const tx = {
  $executeRaw: async () => 1,
  interviewProject: {
    findUnique: async () => current,
    delete: async () => { deletes++; return current },
    update: async ({ data }) => { updates++; return { ...current, ...data, status: 'DRAFT', updatedAt: new Date() } },
  },
  interviewMaterial: { count: async () => 0 },
}
const prisma = {
  interviewProject: { findUnique: async () => original },
  $transaction: async fn => fn(tx),
}
const route = load('src/app/api/interview/projects/[id]/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': {
    requireDatabase: () => null,
    getInterviewUser: async () => ({ userId: null }),
    getGuestIdFromRequest: () => 'guest1',
    checkOwnership: (owner, userId, guestId) => owner.userId || owner.guestId !== guestId ? { status: 404 } : null,
  },
  '@/lib/interview/storage-purge-queue': { enqueueInterviewProjectStoragePurge: async () => { purges++ } },
  '@/lib/interview/transcription-budget': { preserveInterviewTranscriptionUsageBeforeDelete: async () => {} },
  '@/lib/interview/thumbnail-storage': { thumbnailUrlForClient: () => null },
})

;(async () => {
  const ctx = { params: Promise.resolve({ id: 'p1' }) }
  current = { ...original, userId: 'account1' }
  assert.equal((await route.PUT({ json: async () => ({ title: 'stale edit' }) }, ctx)).status, 404)
  assert.equal(updates, 0)
  assert.equal((await route.DELETE({}, ctx)).status, 404)
  assert.equal(purges, 0)
  assert.equal(deletes, 0)
  current = original
  assert.equal((await route.PUT({ json: async () => ({ title: 'valid edit' }) }, ctx)).status, 200)
  assert.equal(updates, 1)
  assert.equal((await route.DELETE({}, ctx)).status, 200)
  assert.equal(purges, 1)
  assert.equal(deletes, 1)
  console.log('PASS interview project update and deletion recheck owner after lifecycle lock')
})().catch(error => { console.error(error); process.exitCode = 1 })
