const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_PROVIDER_OR_DATABASE_ERROR'
const routePath = 'src/app/api/admin/templates/generate-batch/route.ts'
const prompt = { id: 'new-branding-001', fullPrompt: 'test prompt', genre: 'it', category: 'test' }

function templateRoute({ databaseError = false, generatorError = false } = {}) {
  let generatorCalls = 0
  const route = load(routePath, {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: { bannerTemplate: {
      findMany: async () => {
        if (databaseError) throw new Error(secret)
        return []
      },
      create: async () => ({ id: 'created' }),
    } } },
    '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [prompt] },
    '@/lib/nanobanner': { generateBanners: async () => {
      generatorCalls++
      if (generatorError) throw new Error(secret)
      return { banners: ['data:image/png;base64,test'] }
    } },
    '@/lib/admin-guard': { requireAdmin: async () => null },
  }, { setTimeout: (resolve) => { resolve(); return 0 } })
  return { route, getGeneratorCalls: () => generatorCalls }
}

async function post(route, body) {
  return route.POST({ json: async () => body })
}

;(async () => {
  for (const body of [
    { limit: -1 }, { limit: 0 }, { limit: 6 }, { limit: 1.5 },
    { limit: '5' }, { templateIds: 'new-branding-001' },
  ]) {
    const subject = templateRoute()
    const response = await post(subject.route, body)
    assert.equal(response.status, 400)
    assert.equal(subject.getGeneratorCalls(), 0)
  }

  const database = templateRoute({ databaseError: true })
  for (const response of [await database.route.GET(), await post(database.route, { limit: 1 })]) {
    assert.equal(response.status, 500)
    assert.equal(JSON.stringify(await response.json()).includes(secret), false)
  }
  assert.equal(database.getGeneratorCalls(), 0)

  const generator = templateRoute({ generatorError: true })
  const generated = await post(generator.route, { templateIds: [prompt.id], limit: 1 })
  assert.equal(generated.status, 200)
  const body = await generated.json()
  assert.equal(body.summary.error, 1)
  assert.equal(body.results[0].id, prompt.id)
  assert.equal(JSON.stringify(body).includes(secret), false)
  assert.equal(generator.getGeneratorCalls(), 1)

  const drip = load('src/app/api/admin/drip/seed/route.ts', {
    'next/server': { NextResponse: Response },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'token' }) }) },
    '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid: true }) },
    '@/lib/prisma': { prisma: {
      dripSequence: { findFirst: async () => null },
      dripSegment: { create: async () => { throw new Error(secret) } },
    } },
  })
  const seeded = await drip.POST()
  assert.equal(seeded.status, 500)
  assert.equal(JSON.stringify(await seeded.json()).includes(secret), false)

  console.log('PASS admin template errors are private, batch size is bounded, and drip seed hides database details')
})().catch((error) => { console.error(error); process.exitCode = 1 })
