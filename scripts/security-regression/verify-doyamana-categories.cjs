const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const { randomUUID } = require('node:crypto')

const templates = [
  { id: 'built', templateId: 'v2', industry: '標準業種', category: 'it', prompt: '標準', isActive: true, sortOrder: 0, createdAt: new Date() },
  { id: 'custom', templateId: 'custom-1', industry: '独自業種', category: 'custom-genre', prompt: '独自のプロンプト', isActive: true, sortOrder: 1, createdAt: new Date() },
]
const categories = [{ id: 'custom-id', name: '独自業種', slug: 'custom-genre', description: null, order: 20, isActive: true, createdAt: new Date() }]
let nextId = 1
const prisma = {
  bannerTemplate: {
    findMany: async options => {
      const ids = options?.where?.id?.in
      return ids ? templates.filter(item => ids.includes(item.id)) : templates
    },
    findFirst: async ({ where }) => templates.find(item =>
      where.industry ? item.industry === where.industry :
      item.category !== where.NOT?.category &&
      (where.OR || []).some(condition =>
        (condition.industry && item.industry === condition.industry) ||
        (condition.category && item.category === condition.category))) || null,
    findUnique: async ({ where }) => templates.find(item => item.id === where.id) || null,
    count: async ({ where }) => templates.filter(item => item.category === where.category).length,
    updateMany: async ({ where, data }) => {
      const rows = templates.filter(item => item.category === where.category)
      rows.forEach(item => Object.assign(item, data))
      return { count: rows.length }
    },
    create: async ({ data }) => { const row = { id: `image-${nextId++}`, createdAt: new Date(), ...data }; templates.push(row); return row },
    update: async ({ where, data }) => { const row = templates.find(item => item.id === where.id); Object.assign(row, data); return row },
  },
  doyamanaCategory: {
    findMany: async () => categories,
    findUnique: async ({ where }) => categories.find(item => item.id === where.id || item.slug === where.slug) || null,
    findFirst: async ({ where }) => categories.find(item =>
      item.id !== where.NOT?.id &&
      ((where.name && item.name === where.name) || (where.slug && item.slug === where.slug))) || null,
    create: async ({ data }) => { const row = { id: `new-${nextId++}`, createdAt: new Date(), ...data }; categories.push(row); return row },
    update: async ({ where, data }) => { const row = categories.find(item => item.id === where.id); Object.assign(row, data); return row },
    delete: async ({ where }) => { const index = categories.findIndex(item => item.id === where.id); return categories.splice(index, 1)[0] },
  },
  doyamanaImage: { count: async () => 0 },
  $transaction: async callback => callback(prisma),
}
const common = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/admin-guard': { requireAdmin: async () => null },
  '@/lib/banner-prompts-v2': {
    BANNER_PROMPTS_V2: [{ id: 'v2', genre: '標準業種' }],
    GENRES: [{ id: 'standard', name: '標準業種', category: 'it' }],
  },
  '@/lib/operational-json': {
    readOperationalJson: async request => request.json(),
    OperationalBodyError: class extends Error {},
  },
}
const helper = load('src/lib/doyamana-categories.ts', common)
const mocks = { ...common, '@/lib/doyamana-categories': helper }
const list = load('src/app/api/admin/doyamana/categories/route.ts', mocks)
const detail = load('src/app/api/admin/doyamana/categories/[id]/route.ts', mocks)
const images = load('src/app/api/admin/doyamana/images/route.ts', {
  ...mocks,
  'node:crypto': { randomUUID },
  '@/lib/banner-admin-image-storage': { bannerAdminImageExists: async url => url === 'https://storage.test/new.webp' },
})
const imageDetail = load('src/app/api/admin/doyamana/images/[id]/route.ts', {
  ...mocks,
  '@/lib/banner-admin-image-storage': { bannerAdminImageExists: async url => url === 'https://storage.test/new.webp' },
})
const request = (body, url = 'https://example.test/api/admin/doyamana/categories') => ({
  url, json: async () => body,
})
const context = id => ({ params: Promise.resolve({ id }) })

;(async () => {
  let response = await list.GET(request(null))
  assert.equal(response.status, 200)
  let result = await response.json()
  assert.equal(result.categories.find(item => item.id === '標準業種').imageCount, 1)
  assert.equal(result.categories.find(item => item.id === 'custom-id').imageCount, 1)
  assert.equal(result.categories.find(item => item.id === 'custom-id').isManaged, true)
  templates[0].industry = '変更後の業種'
  result = await (await list.GET(request(null))).json()
  assert.equal(result.categories.find(item => item.id === '変更後の業種').imageCount, 1)
  assert.equal(result.categories.find(item => item.id === '標準業種').imageCount, 0)

  response = await detail.GET(request(null), context('custom-id'))
  result = await response.json()
  assert.equal(result.images[0].id, 'custom')
  assert.match(result.images[0].imageUrl, /custom-1/)
  assert.equal('totalUsage' in result.stats, false)

  response = await detail.PUT(request({ name: '新しい独自業種', slug: 'custom-genre', description: '', order: 21, isActive: false }), context('custom-id'))
  assert.equal(response.status, 200)
  assert.equal(templates[1].industry, '新しい独自業種')
  assert.equal((await list.GET(request(null, 'https://example.test/api/admin/doyamana/categories?activeOnly=true'))).status, 200)
  assert.equal((await (await list.GET(request(null, 'https://example.test/api/admin/doyamana/categories?activeOnly=true'))).json()).categories.some(item => item.id === 'custom-id'), false)
  assert.equal((await detail.PUT(request({ name: '新しい独自業種', slug: 'changed-slug', description: '', order: 21, isActive: false }), context('custom-id'))).status, 409)
  assert.equal((await detail.DELETE(request(null), context('custom-id'))).status, 409)
  assert.equal((await detail.PUT(request({ name: '標準業種', slug: 'standard', description: '', order: 0, isActive: true }), context('標準業種'))).status, 404)

  response = await list.POST(request({ name: '追加業種', slug: 'new-genre', description: null, order: 22, isActive: true }))
  assert.equal(response.status, 201)
  const added = (await response.json()).category
  response = await images.POST(request({ categoryId: added.id, imageUrl: 'https://storage.test/new.webp', prompt: '新しい画像' }))
  assert.equal(response.status, 200)
  assert.equal(templates.at(-1).industry, '追加業種')
  assert.equal(templates.at(-1).category, 'new-genre')
  response = await imageDetail.PUT(request({ categoryId: added.id }), context('built'))
  assert.equal(response.status, 200)
  assert.equal(templates[0].industry, '追加業種')
  assert.equal(templates[0].category, 'new-genre')
  assert.equal((await imageDetail.PUT(request({ templateId: 'renamed' }), context('built'))).status, 409)
  response = await imageDetail.PUT(request({ categoryId: '標準業種' }), context('built'))
  assert.equal(response.status, 200)
  assert.equal(templates[0].industry, '標準業種')
  assert.equal(templates[0].category, 'it')
  response = await detail.PUT(request({ name: '追加業種', slug: 'new-genre', description: null, order: 22, isActive: false }), context(added.id))
  assert.equal(response.status, 200)
  assert.equal((await images.POST(request({ categoryId: added.id, imageUrl: 'https://storage.test/new.webp', prompt: '不可' }))).status, 400)
  assert.equal((await imageDetail.PUT(request({ categoryId: added.id }), context('built'))).status, 400)
  assert.equal((await detail.DELETE(request(null), context(added.id))).status, 409)
  templates.pop()
  assert.equal((await detail.DELETE(request(null), context(added.id))).status, 200)
  assert.equal(categories.some(item => item.id === added.id), false)
  console.log('PASS Doyamana categories use live templates, custom CRUD, active filtering, and deletion guards')
})().catch(error => { console.error(error); process.exitCode = 1 })
