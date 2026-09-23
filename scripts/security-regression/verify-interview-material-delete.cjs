const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let status = 'PROCESSING', queueFails = false, queueCalls = 0, deleteCalls = 0, lockCalls = 0
let ownerDenied = false
const material = { id: 'm1', projectId: 'p1', status: 'UPLOADED', filePath: 'owner/p1/123_file.mp3',
  project: { userId: 'owner', guestId: null } }
const tx = {
  $queryRaw: async () => { lockCalls++; return [{}] },
  interviewMaterial: {
    findUnique: async () => ({ id: 'm1', projectId: 'p1', status, filePath: material.filePath }),
    delete: async () => { deleteCalls++; return {} },
  },
}
const prisma = { interviewMaterial: { findUnique: async () => material }, $transaction: async fn => fn(tx) }
const route = load('src/app/api/interview/materials/[id]/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': { requireDatabase: () => null, getInterviewUser: async () => ({ userId: 'owner' }),
    getGuestIdFromRequest: () => null, checkOwnership: () => ownerDenied ? { status: 404 } : null },
  '@/lib/interview/storage': { getSignedFileUrl: async () => { throw Error('unexpected storage read') } },
  '@/lib/interview/transcription-budget': { preserveInterviewTranscriptionUsageBeforeDelete: async () => {} },
  '@/lib/interview/storage-purge-queue': { enqueueInterviewMaterialStoragePurge: async (received, item) => {
    assert.equal(received, tx)
    assert.equal(item.filePath, material.filePath)
    queueCalls++
    if (queueFails) throw Error('queue unavailable')
  } },
})
const ctx = { params: Promise.resolve({ id: 'm1' }) }

;(async () => {
  ownerDenied = true
  assert.equal((await route.DELETE({}, ctx)).status, 404)
  assert.equal(lockCalls, 0)
  ownerDenied = false
  assert.equal((await route.DELETE({}, ctx)).status, 409)
  assert.equal(queueCalls, 0)
  assert.equal(deleteCalls, 0)
  status = 'COMPLETED'
  queueFails = true
  assert.equal((await route.DELETE({}, ctx)).status, 500)
  assert.equal(deleteCalls, 0)
  queueFails = false
  const deleted = await route.DELETE({}, ctx)
  assert.equal(deleted.status, 200)
  assert.equal(deleted.body.fileCleanupPending, true)
  assert.equal(queueCalls, 2)
  assert.equal(deleteCalls, 1)
  console.log('PASS interview material delete blocks active work and queues file cleanup before DB deletion')
})().catch(error => { console.error(error); process.exitCode = 1 })
