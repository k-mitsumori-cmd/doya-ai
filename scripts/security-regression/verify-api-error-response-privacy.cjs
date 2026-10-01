const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const secret = 'PRIVATE_DATABASE_OR_PROVIDER_EXCEPTION'
const response = { NextResponse: Response }

;(async () => {
  await check('public healthcheck omits raw database errors and configured hosts', async () => {
    const healthcheck = load('src/app/api/mitsuboshi/nagusame/healthcheck/route.ts', {
      'next/server': response,
      '@/lib/prisma': { prisma: { $queryRaw: async () => { throw new Error(secret) } } },
      '@/lib/mitsuboshi/_shared/constants': {
        MITSUBOSHI_BRAND: { seriesName: 'mitsuboshi', currentVolume: 1 },
        MITSUBOSHI_CLAUDE_MODEL: 'test-model',
      },
    }, { process: { env: { MITSUBOSHI_HOSTS: `private.${secret}.example`, ANTHROPIC_API_KEY: 'configured' } } })
    const result = await healthcheck.GET({ headers: new Headers({ host: 'public.example' }) })
    const body = await result.json()
    assert.equal(result.status, 503)
    assert.equal(body.checks.database.ok, false)
    assert(!JSON.stringify(body).includes(secret))
    assert(!JSON.stringify(body).includes('private.'))
  })

  for (const service of ['slide', 'slashslide']) {
    await check(`${service} generation hides provider failure`, async () => {
      const route = load(`src/app/api/${service}/generate/route.ts`, {
        'next/server': response,
        '@/lib/retired-service': { SERVICE_RETIRED: false },
        'zod': require('zod'),
        [`@/lib/${service}/gemini`]: { generateSlideSpec: async () => { throw new Error(secret) } },
      })
      const result = await route.POST({ json: async () => ({ topic: 'test' }) })
      assert.equal(result.status, 500)
      assert(!JSON.stringify(await result.json()).includes(secret))
    })
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
