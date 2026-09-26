const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let dbCalls = 0
const api = load('src/app/api/banner/test/templates/route.ts', {
  'next/server': { NextResponse: { json: (body, opts) => new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) } },
  '@/lib/prisma': { prisma: new Proxy({}, { get() { dbCalls++; throw Error('DB SHOULD NOT BE READ') } }) },
  '@/lib/banner-admin-guard': { requireBannerAdmin: () => null },
  '@/lib/banner-template-storage': { hasPreparedVariants: () => false },
  '@/lib/banner-prompts-v2': { BANNER_PROMPTS_V2: [] },
})

;(async () => {
  for (const query of ['limit=0', 'limit=101', 'limit=1000000', 'limit=1e6', 'limit=abc', 'offset=-1', 'offset=10001', 'offset=1.5']) {
    const response = await api.GET(new Request(`https://local.test/api/banner/test/templates?${query}`))
    assert.equal(response.status, 400, query)
  }
  assert.equal(dbCalls, 0)
  console.log('PASS banner template paging rejects unbounded and malformed reads before DB access')
})().catch(error => { console.error(error); process.exitCode = 1 })
