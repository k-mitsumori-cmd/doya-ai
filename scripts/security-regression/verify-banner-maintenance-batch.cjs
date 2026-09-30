const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_TEMPLATE_PROVIDER_ERROR'
const prompt = { id: 'fashion-001', name: 'test', displayTitle: 'test', genre: 'test', category: 'it', fullPrompt: 'test' }
const template = { id: 'brand-001', industry: 'test', category: 'it', prompt: 'test', size: '1200x628' }

function request(body) {
  return { json: async () => body }
}

function setup(path, options = {}) {
  let calls = 0
  const prisma = { bannerTemplate: {
    findMany: async () => {
      if (options.databaseError) throw new Error(secret)
      return []
    },
    findUnique: async () => null,
    upsert: async () => ({ imageUrl: 'data:image/png;base64,test', isFeatured: false }),
  } }
  const generator = async () => {
    calls++
    throw new Error(secret)
  }
  const common = {
    'next/server': { NextResponse: Response },
    '@/lib/banner-admin-guard': { requireBannerAdmin: () => null },
    '@/lib/prisma': { prisma },
    '@/lib/nanobanner': { generateBanners: generator },
    '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [prompt] },
    '@/lib/banner-template-storage': { hasPreparedVariants: () => false },
    '../route': { BANNER_TEMPLATE_PROMPTS: [template], generateMoreVariations: () => [] },
  }
  const route = load(path, common, { setTimeout: (resolve) => { resolve(); return 0 } })
  return { route, calls: () => calls }
}

async function rejectsWithoutGeneration(path, invalidBodies) {
  for (const body of invalidBodies) {
    const subject = setup(path)
    const response = await subject.route.POST(request(body))
    assert.equal(response.status, 400, `${path}: ${JSON.stringify(body)}`)
    assert.equal(subject.calls(), 0, path)
  }
}

;(async () => {
  const base = 'src/app/api/banner/test/templates'
  await rejectsWithoutGeneration(`${base}/generate-v2/route.ts`, [
    null, { batchSize: 0 }, { batchSize: 6 }, { batchSize: -1 },
    { promptIds: Array(6).fill(prompt.id) }, { promptIds: prompt.id },
  ])
  await rejectsWithoutGeneration(`${base}/bootstrap/route.ts`, [
    null, { generateAll: true }, { templateIds: [] },
    { templateIds: Array(6).fill(template.id) }, { templateIds: template.id },
  ])
  await rejectsWithoutGeneration(`${base}/route.ts`, [
    null, { generateAll: true }, { templateIds: [] },
    { templateIds: Array(6).fill(template.id) }, { templateIds: template.id },
  ])

  const v2 = setup(`${base}/generate-v2/route.ts`)
  const failed = await v2.route.POST(request({ promptIds: [prompt.id] }))
  assert.equal(failed.status, 200)
  assert.equal(v2.calls(), 1)
  assert.equal(JSON.stringify(await failed.json()).includes(secret), false)

  const v2Read = setup(`${base}/generate-v2/route.ts`, { databaseError: true })
  const readFailure = await v2Read.route.GET(request({}))
  assert.equal(readFailure.status, 500)
  assert.equal(JSON.stringify(await readFailure.json()).includes(secret), false)

  const boot = setup(`${base}/bootstrap/route.ts`)
  const bootFailure = await boot.route.POST(request({ templateIds: [template.id] }))
  assert.equal(bootFailure.status, 200)
  assert.equal(boot.calls(), 1)
  assert.equal(JSON.stringify(await bootFailure.json()).includes(secret), false)

  console.log('PASS banner maintenance limits paid generation to five and hides provider and database details')
})().catch((error) => { console.error(error); process.exitCode = 1 })
