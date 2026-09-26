const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const denied = new Response(JSON.stringify({ error: 'admin required' }), { status: 401 })
const nextServer = { NextResponse: { json: (body, opts) => new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) } }

;(async () => {
  for (const route of ['test/debug', 'test/health', 'test/templates-minimal', 'models']) {
    let sideEffects = 0
    const api = load(`src/app/api/banner/${route}/route.ts`, {
      'next/server': nextServer,
      '@/lib/banner-admin-guard': { requireBannerAdmin: () => denied },
      '@/lib/prisma': { prisma: new Proxy({}, { get() { sideEffects++; throw Error('DB SHOULD NOT BE READ') } }) },
      '@/lib/nanobanner': { isNanobannerConfigured: () => { sideEffects++; throw Error('PROVIDER SHOULD NOT BE READ') } },
    }, { fetch: async () => { sideEffects++; throw Error('PROVIDER SHOULD NOT BE CALLED') } })
    const response = await api.GET(new Request(`https://local.test/api/banner/${route}`))
    assert.equal(response.status, 401, route)
    assert.equal(sideEffects, 0, route)
  }

  const prisma = { bannerTemplate: { findMany: async () => { throw Error('SENSITIVE_DB_DETAIL') } } }
  const debug = load('src/app/api/banner/test/debug/route.ts', {
    'next/server': nextServer,
    '@/lib/banner-admin-guard': { requireBannerAdmin: () => null },
    '@/lib/prisma': { prisma },
  })
  const failed = await debug.GET(new Request('https://local.test/api/banner/test/debug'))
  assert.equal(failed.status, 500)
  assert(!JSON.stringify(await failed.json()).includes('SENSITIVE_DB_DETAIL'))
  console.log('PASS banner diagnostic APIs require admin before DB/provider work and hide DB errors')
})().catch(error => { console.error(error); process.exitCode = 1 })
