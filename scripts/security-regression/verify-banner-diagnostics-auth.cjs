const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const denied = new Response(JSON.stringify({ error: 'admin required' }), { status: 401 })
const nextServer = { NextResponse: { json: (body, opts) => new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) } }

;(async () => {
  for (const route of ['models']) {
    let sideEffects = 0
    const api = load(`src/app/api/banner/${route}/route.ts`, {
      'next/server': nextServer,
      '@/lib/banner-admin-guard': { requireBannerAdmin: () => denied },
      '@/lib/banner/vision-response': { readBannerVisionJson: async () => { sideEffects++; throw Error('PROVIDER SHOULD NOT BE READ') } },
      '@/lib/prisma': { prisma: new Proxy({}, { get() { sideEffects++; throw Error('DB SHOULD NOT BE READ') } }) },
      '@/lib/nanobanner': { isNanobannerConfigured: () => { sideEffects++; throw Error('PROVIDER SHOULD NOT BE READ') } },
    }, { fetch: async () => { sideEffects++; throw Error('PROVIDER SHOULD NOT BE CALLED') } })
    const response = await api.GET(new Request(`https://local.test/api/banner/${route}`))
    assert.equal(response.status, 401, route)
    assert.equal(sideEffects, 0, route)
  }

  console.log('PASS banner diagnostic API requires admin before DB/provider work')
})().catch(error => { console.error(error); process.exitCode = 1 })
