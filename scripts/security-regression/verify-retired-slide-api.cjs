const assert = require('node:assert/strict')
const { z } = require('zod')
const { load } = require('./load-typescript.cjs')

const routes = [
  'src/app/api/slide/generate/route.ts',
  'src/app/api/slashslide/generate/route.ts',
  'src/app/api/slide/publish/google-slides/route.ts',
  'src/app/api/slashslide/publish/google-slides/route.ts',
]

async function main() {
  for (const route of routes) {
    let externalCalls = 0
    const mocks = {
      'next/server': { NextResponse: Response },
      zod: { z },
      '@/lib/retired-service': {
        SERVICE_RETIRED: true,
        retiredServiceResponse: () => Response.json({ error: '提供終了' }, { status: 410 }),
      },
      '@/lib/slide/gemini': { generateSlideSpec: async () => { externalCalls++; return {} } },
      '@/lib/slashslide/gemini': { generateSlideSpec: async () => { externalCalls++; return {} } },
      '@/lib/slide/googleSlides': { createGoogleSlideFromSpec: async () => { externalCalls++; return {} } },
      '@/lib/slashslide/googleSlides': { createGoogleSlideFromSpec: async () => { externalCalls++; return {} } },
    }
    const response = await load(route, mocks).POST({ json: async () => { throw new Error('request body must not be read') } })
    assert.equal(response.status, 410, route)
    assert.equal(externalCalls, 0, route)
  }
  console.log('PASS all retired slide APIs return 410 before AI generation or external sharing')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
