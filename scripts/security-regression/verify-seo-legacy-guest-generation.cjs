const assert = require('node:assert/strict')
const { z } = require('zod')
const { load } = require('./load-typescript.cjs')

const routes = [
  'src/app/api/seo/articles/[id]/check/route.ts',
  'src/app/api/seo/articles/[id]/generate-note/route.ts',
  'src/app/api/seo/articles/[id]/vibe-edit/route.ts',
  'src/app/api/seo/articles/[id]/research/route.ts',
  'src/app/api/seo/articles/[id]/jobs/route.ts',
  'src/app/api/seo/sections/[id]/cv/route.ts',
  'src/app/api/seo/sections/[id]/regenerate/route.ts',
  'src/app/api/seo/sections/[id]/seo/route.ts',
  'src/app/api/seo/jobs/[id]/advance/route.ts',
  'src/app/api/seo/jobs/[id]/reset/route.ts',
  'src/app/api/seo/jobs/[id]/resume/route.ts',
]

async function main() {
  const owner = load('src/lib/seoArticleOwner.ts', {
    'next-auth': { getServerSession: async () => null },
    '@/lib/auth': {},
    '@/lib/seoAccess': { getGuestIdFromRequest: () => 'legacy-guest' },
  })
  for (const route of routes) {
    let sideEffects = 0
    const unavailable = new Proxy({}, { get: () => () => { sideEffects++; throw new Error('guest reached provider or database') } })
    const mocks = new Proxy({
      'next/server': { NextResponse: Response },
      zod: { z },
      '@/lib/seoArticleOwner': owner,
    }, { has: () => true, get: (target, key) => key in target ? target[key] : unavailable })
    const api = load(route, mocks)
    const response = await api.POST({ json: async () => ({}) }, { params: Promise.resolve({ id: 'legacy-article' }) })
    assert.equal(response.status, 401, route)
    assert.equal(sideEffects, 0, route)
  }
  console.log(`PASS legacy SEO guest cannot start provider-backed generation in ${routes.length} routes`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
