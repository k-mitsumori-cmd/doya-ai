const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

let authenticated = 0
let generated = 0
const route = load('src/app/api/generate/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => { authenticated++; return null } },
  '@/lib/auth': { authOptions: {} },
  '@/lib/templates': { SAMPLE_TEMPLATES: [{ id: 'synthetic', prompt: 'test' }] },
  '@/lib/gemini-text': {
    generateTextWithGemini: async () => { generated++; return 'output' },
    getGeminiModelName: () => 'test',
  },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
  '@/lib/retired-service': {
    SERVICE_RETIRED: true,
    retiredServiceResponse: (serviceName) => Response.json({ serviceName }, { status: 410 }),
  },
})

;(async () => {
  const response = await route.POST({ json: async () => ({ templateId: 'synthetic', inputs: {} }) })
  assert.equal(response.status, 410)
  assert.equal((await response.json()).serviceName, 'カンタンマーケAI')
  assert.equal(authenticated, 0)
  assert.equal(generated, 0)
  console.log('PASS retired generic generate route cannot invoke the provider')
})().catch(error => { console.error(error); process.exitCode = 1 })
