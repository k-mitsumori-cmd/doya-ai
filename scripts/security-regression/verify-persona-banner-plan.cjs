const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

;(async () => {
  let plan = 'FREE'
  let used = 0
  let quotaReads = 0
  let created = 0
  const tx = {
    $queryRaw: async () => [{ id: 'owner' }],
    user: { findUnique: async () => ({ plan }) },
    personaProject: { findFirst: async () => ({ id: 'project', includedImages: [] }) },
    personaImageJob: {
      findMany: async () => { quotaReads++; return [] },
      findUnique: async () => null,
      create: async ({ data }) => { created++; return { id: 'job', ...data } },
    },
    personaImageUsageDay: {
      upsert: async () => { quotaReads++; return { used, reserved: 0 } },
      update: async () => { quotaReads++ },
    },
  }
  const ledger = load('src/lib/persona/image-ledger.ts', {
    crypto: require('node:crypto'),
    '@/lib/unified-plan': { isPaidPlan: value => value !== 'FREE' && value !== 'GUEST' },
    './usage-day': { personaUsageDay: () => new Date('2026-10-02T00:00:00Z') },
    './project-ledger': { releasePersonaProjectReservation: async () => {} },
  })
  const db = { $transaction: async work => work(tx) }
  const input = { userId: 'owner', projectId: 'project', requestKey: 'banner-1',
    inputHash: 'a'.repeat(64), slotKey: 'banner-default', kind: 'banner', intent: 'extra' }
  assert.equal((await ledger.reservePersonaImage(db, input)).state, 'plan_required')
  assert.equal(quotaReads, 0)
  assert.equal(created, 0)
  console.log('PASS free banner rejected before quota and provider reservation')

  plan = 'PRO'
  assert.equal((await ledger.reservePersonaImage(db, input)).state, 'reserved')
  assert.equal(created, 1)
  console.log('PASS paid banner reservation uses extra image quota')

  used = 30
  const paidLimit = await ledger.reservePersonaImage(db, { ...input, requestKey: 'banner-2' })
  assert.equal(paidLimit.state, 'limit')
  assert.equal(paidLimit.upgradeAvailable, false)
  plan = 'FREE'
  used = 5
  const freeLimit = await ledger.reservePersonaImage(db, { ...input, kind: 'portrait', slotKey: 'portrait', requestKey: 'portrait-1' })
  assert.equal(freeLimit.state, 'limit')
  assert.equal(freeLimit.upgradeAvailable, true)
  console.log('PASS free extra image cap offers upgrade and paid cap offers contact')

  let providerCalls = 0
  const service = load('src/lib/persona/image-generation.ts', {
    crypto: require('node:crypto'),
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {} },
    '@/lib/resolve-image-model': { callGeminiImageAPI: async () => { providerCalls++ } },
    './image-ledger': { reservePersonaImage: async () => ({ state: 'plan_required' }), settlePersonaImage: async () => {} },
    './image-storage': {},
    '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
  })
  const response = await service.generateAndSavePersonaImage(input, { contents: [] })
  const body = await response.json()
  assert.equal(response.status, 403)
  assert.equal(body.code, 'PRO_REQUIRED')
  assert.equal(body.upgradeUrl, '/persona/pricing')
  assert.equal(providerCalls, 0)
  console.log('PASS free banner API returns upgrade path without provider call')

  const history = load('src/lib/persona/project-history.ts', {
    './display-data': { isPersonaDisplayData: () => true },
  })
  const saved = await history.readPersonaProject({ personaProject: { findFirst: async () => ({
    id: 'project', data: { persona: { name: 'Synthetic' } }, sourceUrl: null,
    createdAt: new Date('2026-10-02T00:00:00Z'), includedImages: [],
    images: [
      { id: 'latest', kind: 'banner', slotKey: 'banner-default' },
      { id: 'older', kind: 'banner', slotKey: 'banner-default' },
    ],
  }) } }, 'owner', 'project')
  assert.equal(saved.bannerImage, '/api/persona/images/latest')
  assert.equal(saved.images.length, 1)
  console.log('PASS saved project restores latest successful banner')
})().catch(error => { console.error(error); process.exitCode = 1 })
