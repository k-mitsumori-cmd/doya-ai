const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')

const lease = load('src/lib/shodan/slide-generation-lease.ts', {
  'node:crypto': { randomUUID },
  '@/lib/prisma': { prisma: {} },
})

function database() {
  const rows = new Map()
  let tail = Promise.resolve()
  const tx = {
    $executeRaw: async () => {},
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
    },
  }
  return { rows, systemSetting: { deleteMany: async ({ where }) => {
    if (rows.get(where.key) !== where.value) return { count: 0 }
    rows.delete(where.key)
    return { count: 1 }
  } }, $transaction: async callback => {
    let release
    const previous = tail
    tail = new Promise(resolve => { release = resolve })
    await previous
    try { return await callback(tx) } finally { release() }
  } }
}

;(async () => {
  await check('Shodan slide lease admits only one same-preparation request and fences old release', async () => {
    const db = database()
    const now = Date.parse('2026-09-25T00:00:00Z')
    const attempts = await Promise.allSettled([
      lease.claimShodanSlideLease('prep', db, now),
      lease.claimShodanSlideLease('prep', db, now),
    ])
    const good = attempts.find(result => result.status === 'fulfilled').value
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof lease.ShodanSlideGenerationInProgressError).length, 1)
    await lease.claimShodanSlideLease('different-prep', db, now)
    const afterExpiry = await lease.claimShodanSlideLease('prep', db, now + 360_001)
    await lease.releaseShodanSlideLease('prep', good, db)
    await assert.rejects(lease.claimShodanSlideLease('prep', db, now + 360_001), lease.ShodanSlideGenerationInProgressError)
    await lease.releaseShodanSlideLease('prep', afterExpiry, db)
    assert.ok(await lease.claimShodanSlideLease('prep', db, now + 360_001))
  })
  await check('both Shodan slide routes reject overlapping work before image provider', async () => {
    for (const file of [
      'src/app/api/shodan/preparations/[id]/slides/generate/route.ts',
      'src/app/api/shodan/preparations/[id]/slides/regenerate/route.ts',
    ]) {
      let providerCalls = 0
      const route = load(file, {
        'next/server': { NextResponse: Response },
        '@/lib/prisma': { prisma: {
          shodanPreparation: { findFirst: async () => ({ id: 'prep', slidesJson: [{ title: 'Slide' }], slideImages: [{ title: 'Slide', imagePath: 'existing' }] }) },
          shodanCompanyProfile: { findUnique: async () => null },
        } },
        '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org', userId: 'member' }), orgSlugFrom: () => 'org' },
        '@/lib/shodan/billing': { getShodanBilling: async () => ({ ownerUserId: 'owner', plan: 'PRO' }) },
        '@/lib/unified-plan': { isPaidPlan: () => true },
        '@/lib/shodan/slide-generation-lease': {
          ShodanSlideGenerationInProgressError: lease.ShodanSlideGenerationInProgressError,
          claimShodanSlideLease: async () => { throw new lease.ShodanSlideGenerationInProgressError() },
          releaseShodanSlideLease: async () => { throw Error('must not release unowned lease') },
        },
        '@/lib/shodan/save-slide-images': { SlideImageConflict: class extends Error {}, saveSlideImages: async () => {} },
        '@/lib/shodan/slide-image': { generateSlideImage: async () => { providerCalls++; return {} } },
        '@/lib/shodan/storage': { signedUrl: async () => '' },
        '@/lib/fetch-timeout': { raceTimeout: async (_, __, promise) => promise },
      })
      const response = await route.POST(new Request('http://offline.invalid/api', { method: 'POST', body: JSON.stringify({ index: 0 }) }), { params: Promise.resolve({ id: 'prep' }) })
      assert.equal(response.status, 409, file)
      assert.equal((await response.json()).code, 'GENERATION_PENDING')
      assert.equal(providerCalls, 0)
    }
  })
  await check('Shodan slide batch re-reads completed images after acquiring the lease', async () => {
    let reads = 0
    let providerCalls = 0
    let releases = 0
    const route = load('src/app/api/shodan/preparations/[id]/slides/generate/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {
        shodanPreparation: { findFirst: async () => ({ id: 'prep', slidesJson: [{ title: 'Slide' }], slideImages: ++reads === 1 ? [] : [{ title: 'Slide', imagePath: 'finished' }] }) },
        shodanCompanyProfile: { findUnique: async () => null },
      } },
      '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org', userId: 'member' }), orgSlugFrom: () => 'org' },
      '@/lib/shodan/billing': { getShodanBilling: async () => ({ ownerUserId: 'owner', plan: 'PRO' }) },
      '@/lib/unified-plan': { isPaidPlan: () => true },
      '@/lib/shodan/slide-generation-lease': {
        ShodanSlideGenerationInProgressError: lease.ShodanSlideGenerationInProgressError,
        claimShodanSlideLease: async () => 'lease',
        releaseShodanSlideLease: async () => { releases++ },
      },
      '@/lib/shodan/save-slide-images': { SlideImageConflict: class extends Error {}, saveSlideImages: async () => {} },
      '@/lib/shodan/slide-image': { generateSlideImage: async () => { providerCalls++; return {} } },
      '@/lib/shodan/storage': { signedUrl: async () => '' },
      '@/lib/fetch-timeout': { raceTimeout: async (_, __, promise) => promise },
    })
    const response = await route.POST({}, { params: Promise.resolve({ id: 'prep' }) })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).remaining, 0)
    assert.equal(reads, 2)
    assert.equal(providerCalls, 0)
    assert.equal(releases, 1)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
