const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const calls = []
const prisma = { bannerTemplate: {
  findMany: async () => [],
  count: async () => 0,
  findFirst: async () => null,
  create: async ({ data }) => { calls.push(data); return { id: 'created', ...data } },
  update: async ({ data }) => { calls.push(data); return { id: 'updated', ...data } },
}, doyamanaCategory: { findUnique: async () => null } }
const mocks = {
  'node:crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/admin-guard': { requireAdmin: async () => null },
  '@/lib/doyamana-categories': {
    listDoyamanaCategories: async () => ({ categories: [{ id: 'ファッション・アパレル', name: 'ファッション・アパレル', imageCount: 0, isActive: true }], templateIds: new Map() }),
  },
  '@/lib/banner-prompts-v2': {
    BANNER_PROMPTS_V2: [],
    GENRES: [{ id: 'fashion', name: 'ファッション・アパレル', category: 'ec' }],
  },
  '@/lib/banner-admin-image-storage': {
    bannerAdminImageExists: async url => url === 'https://storage.test/admin/image.webp',
  },
  '@/lib/operational-json': {
    readOperationalJson: async req => req.json(),
    OperationalBodyError: class extends Error {},
  },
}
const base = 'src/app/api/admin/doyamana'
const categories = load(`${base}/categories/route.ts`, mocks)
const images = load(`${base}/images/route.ts`, mocks)
const detail = load(`${base}/images/[id]/route.ts`, mocks)
const request = body => ({ url: 'https://example.test/admin', json: async () => body })

;(async () => {
  const categoryResponse = await categories.GET(request())
  assert.equal(categoryResponse.status, 200)
  const list = (await categoryResponse.json()).categories
  assert.equal(list.length, 1)
  assert.equal(list[0].id, 'ファッション・アパレル')
  assert.equal(list[0].imageCount, 0)

  const payload = {
    categoryId: 'ファッション・アパレル',
    imageUrl: 'https://storage.test/admin/image.webp',
    prompt: '  sample prompt  ', order: 0, isActive: false,
  }
  const created = await images.POST(request(payload))
  assert.equal(created.status, 200)
  assert.match(calls[0].templateId, /^custom-[0-9a-f-]{36}$/)
  assert.equal(calls[0].industry, payload.categoryId)
  assert.equal(calls[0].category, 'ec')
  assert.equal(calls[0].prompt, 'sample prompt')
  assert.equal(calls[0].sortOrder, 0)
  assert.equal(calls[0].isActive, false)

  let lastImageWhere
  prisma.bannerTemplate.findMany = async options => {
    lastImageWhere = options.where
    return [{
    id: 'created', templateId: calls[0].templateId, industry: calls[0].industry,
    category: calls[0].category, prompt: calls[0].prompt, imageUrl: calls[0].imageUrl,
    isActive: false, isFeatured: false, size: '1200x628', sortOrder: 0,
    createdAt: new Date(), updatedAt: new Date(),
    }]
  }
  prisma.bannerTemplate.count = async () => 1
  const imageList = await images.GET({ url: 'https://example.test/api/admin/doyamana/images' })
  assert.equal((await imageList.json()).images[0].displayTitle, 'ファッション・アパレル')
  await images.GET({ url: 'https://example.test/api/admin/doyamana/images?category=ファッション・アパレル' })
  assert.equal(lastImageWhere.OR[1].industry, 'ファッション・アパレル')

  for (const bad of [
    { ...payload, categoryId: '存在しない' },
    { ...payload, imageUrl: 'https://other.test/image.webp' },
    { ...payload, order: '0' },
    { ...payload, prompt: '' },
    { ...payload, isActive: 'false' },
  ]) {
    const before = calls.length
    assert.equal((await images.POST(request(bad))).status, 400)
    assert.equal(calls.length, before)
  }

  const ctx = { params: Promise.resolve({ id: 'existing' }) }
  assert.equal((await detail.PUT(request({ prompt: 'new prompt' }), ctx)).status, 200)
  assert.equal('imageUrl' in calls.at(-1), false)
  assert.equal((await detail.PUT(request({ imageUrl: null }), ctx)).status, 200)
  assert.equal(calls.at(-1).imageUrl, null)
  assert.equal((await detail.PUT(request({ imageUrl: 'https://other.test/image.webp' }), ctx)).status, 400)

  const { readOperationalJson, OperationalBodyError } = load('src/lib/operational-json.ts')
  await assert.rejects(
    readOperationalJson(new Request('https://example.test', { method: 'POST', body: 'x'.repeat(100) }), 64),
    error => error instanceof OperationalBodyError && error.status === 413,
  )

  let signed = 0
  const storageBucket = {
    createSignedUploadUrl: async path => { signed++; return { data: { signedUrl: `https://storage.test/upload/${path}` }, error: null } },
    getPublicUrl: path => ({ data: { publicUrl: `https://storage.test/storage/v1/object/public/banner-admin-images/${path}` } }),
    info: async () => ({ data: { size: 123 }, error: null }),
  }
  const storage = {
    getBucket: async () => ({ data: { public: true }, error: null }),
    from: () => storageBucket,
  }
  const uploadHelper = load('src/lib/banner-admin-image-storage.ts', {
    'node:crypto': { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    '@/lib/interview/storage': { getSupabaseAdmin: () => ({ storage }) },
  })
  const uploadRoute = load(`${base}/images/upload-url/route.ts`, {
    'next/server': { NextResponse: Response },
    '@/lib/admin-guard': { requireAdmin: async () => null },
    '@/lib/banner-admin-image-storage': uploadHelper,
    '@/lib/operational-json': { readOperationalJson: async req => req.json(), OperationalBodyError: class extends Error {} },
  })
  for (const bad of [
    { mimeType: 'image/svg+xml', fileSize: 100 },
    { mimeType: 'image/png', fileSize: 0 },
    { mimeType: 'image/png', fileSize: 5 * 1024 * 1024 + 1 },
  ]) assert.equal((await uploadRoute.POST(request(bad))).status, 400)
  assert.equal(signed, 0)
  const urlResponse = await uploadRoute.POST(request({ mimeType: 'image/webp', fileSize: 1024 }))
  assert.equal(urlResponse.status, 200)
  const urls = await urlResponse.json()
  assert.equal(signed, 1)
  assert.equal(await uploadHelper.bannerAdminImageExists(urls.publicUrl), true)
  assert.equal(await uploadHelper.bannerAdminImageExists('https://other.test/image.webp'), false)
  console.log('PASS Doyamana admin image creation, empty categories, edit preservation, and payload limit')
})().catch(error => { console.error(error); process.exitCode = 1 })
