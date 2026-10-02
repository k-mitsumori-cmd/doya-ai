const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const mb = 1024 * 1024
let plan = 'FREE'
let storageMax = 3000 * mb
let signedCalls = 0
let materialWrites = 0
let projectLookups = 0
const route = load('src/app/api/interview/materials/upload-url/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: {
    interviewProject: { findUnique: async () => { projectLookups++; return { id: 'p1', userId: 'u1', guestId: 'guest1' } } },
    interviewMaterial: { create: async () => { materialWrites++; return { id: 'material1' } } },
  } },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: plan === 'GUEST' ? null : 'u1', plan }),
    getGuestIdFromRequest: () => 'guest1', ensureGuestId: () => 'guest1', setGuestCookie: () => {}, requireDatabase: () => null,
  },
  '@/lib/interview/storage': {
    createSignedUploadUrl: async () => { signedCalls++; return { signedUrl: 'signed', path: 'path', token: 'token' } },
    buildStoragePath: () => 'path', ensureBucket: async () => {}, getDetectedMaxFileSize: () => storageMax,
  },
  '@/lib/interview/types': {
    ALLOWED_MIME_TYPES: { 'audio/wav': 'audio' }, ALLOWED_EXTENSIONS: new Set(['wav']), getMaxFileSize: () => 5000 * mb,
  },
  '@/lib/pricing': {
    getInterviewLimitsByPlan: (tier) => ({ uploadSizeLimit: ({ FREE: 500, LIGHT: 1000, PRO: 2000, ENTERPRISE: 5000 })[tier] * mb }),
    getInterviewGuestLimits: () => ({ uploadSizeLimit: 100 * mb }),
    SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact',
  },
})
const post = (fileSize) => route.POST({ json: async () => ({ projectId: 'p1', fileName: 'audio.wav', mimeType: 'audio/wav', fileSize }) })
const preflight = (fileSize) => route.POST({ json: async () => ({ preflight: true, fileName: 'audio.wav', mimeType: 'audio/wav', fileSize }) })
let guestProjectWrites = 0
const projects = load('src/app/api/interview/projects/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { interviewProject: {
    count: async () => 3,
    create: async () => { guestProjectWrites++; return { id: 'unexpected' } },
  } } },
  '@/lib/interview/thumbnail-storage': { thumbnailUrlForClient: () => null },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: null, plan: 'GUEST' }),
    getGuestIdFromRequest: () => 'guest1', ensureGuestId: () => 'guest1', setGuestCookie: () => {},
    interviewGuestTotalLimit: () => 3, requireDatabase: () => null,
  },
})

;(async () => {
  let response = await projects.POST({ json: async () => ({ title: 'new interview' }) })
  assert.equal(response.status, 429)
  let body = await response.json()
  assert.equal(body.code, 'GUEST_LIMIT')
  assert.equal(body.actionUrl, '/auth/signin?callbackUrl=/interview')
  assert.equal(guestProjectWrites, 0)

  plan = 'GUEST'
  response = await preflight(150 * mb)
  assert.equal(response.status, 400)
  body = await response.json()
  assert.equal(body.code, 'GUEST_UPLOAD_LIMIT')
  assert.equal(body.actionUrl, '/auth/signin?callbackUrl=/interview')
  assert.equal(projectLookups, 0)

  response = await preflight(80 * mb)
  body = await response.json()
  assert.equal(body.success, true)
  assert.equal(projectLookups, 0)
  assert.equal(signedCalls, 0)
  assert.equal(materialWrites, 0)

  response = await post(150 * mb)
  body = await response.json()
  assert.equal(body.code, 'GUEST_UPLOAD_LIMIT')

  plan = 'FREE'
  response = await preflight(600 * mb)
  body = await response.json()
  assert.equal(body.code, 'PLAN_UPLOAD_LIMIT')
  assert.equal(body.actionUrl, '/interview/pricing')

  plan = 'PRO'
  response = await preflight(2500 * mb)
  body = await response.json()
  assert.equal(body.code, 'PLAN_UPLOAD_LIMIT')
  assert.equal(body.actionUrl, 'https://doyamarke.surisuta.jp/contact')

  storageMax = 1500 * mb
  response = await preflight(1800 * mb)
  body = await response.json()
  assert.equal(body.code, 'STORAGE_UPLOAD_LIMIT')
  assert.equal(body.actionUrl, undefined)
  assert.match(body.error, /分割または圧縮/)
  assert.equal(signedCalls, 0)
  assert.equal(materialWrites, 0)
  console.log('PASS Interview upload preflight rejects limits before creating a project or upload records')
})().catch((error) => { console.error(error); process.exitCode = 1 })
