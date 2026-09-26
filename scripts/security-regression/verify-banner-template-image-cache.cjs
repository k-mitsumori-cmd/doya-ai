const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

class NextResponse extends Response {
  static json(body, opts) { return new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) }
  static redirect(url) { return new Response(null, { status: 302, headers: { location: String(url) } }) }
}

;(async () => {
  let imageUrl = 'data:image/png;base64,QUJD'
  let reads = 0
  const imageRoute = load('src/app/api/banner/test/image/[templateId]/route.ts', {
    'next/server': { NextResponse },
    '@/lib/prisma': { prisma: { bannerTemplate: { findUnique: async () => { reads++; return { imageUrl } } } } },
    'sharp': () => { throw Error('resize should not run') },
    '@/lib/banner-template-storage': { templateImageUrl: url => url },
  })
  const ctx = { params: Promise.resolve({ templateId: 'template-1' }) }
  const first = await imageRoute.GET(new Request('https://local.test/api/banner/test/image/template-1?v=1'), ctx)
  assert.equal(await first.text(), 'ABC')
  assert(!first.headers.get('cache-control').includes('immutable'))
  imageUrl = 'data:image/png;base64,REVG'
  const second = await imageRoute.GET(new Request('https://local.test/api/banner/test/image/template-1?v=2'), ctx)
  assert.equal(await second.text(), 'DEF')
  assert.equal(reads, 2)

  const updatedAt = new Date('2026-09-26T10:00:00.000Z')
  const templatesRoute = load('src/app/api/banner/test/templates/route.ts', {
    'next/server': { NextResponse },
    '@/lib/prisma': { prisma: { bannerTemplate: {
      findMany: async () => [{ templateId: 'template-1', imageUrl, updatedAt, industry: 'it', category: 'it', prompt: 'official', isFeatured: true }],
      count: async () => 1,
    } } },
    '@/lib/banner-admin-guard': { requireBannerAdmin: () => null },
    '@/lib/banner-template-storage': { hasPreparedVariants: () => false },
    '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [] },
  })
  const listing = await templatesRoute.GET(new Request('https://local.test/api/banner/test/templates?limit=1'))
  assert.equal(listing.status, 200)
  const body = await listing.json()
  assert.equal(body.templates[0].imageUrl, `/api/banner/test/image/template-1?v=${updatedAt.getTime()}`)
  console.log('PASS regenerated banner templates use versioned URLs and do not serve stale in-process image bytes')
})().catch(error => { console.error(error); process.exitCode = 1 })
