// Offline input/provider budget regression. No database or paid model calls.
const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const persona = require('./fixtures/persona-result.cjs')

function fixture(providerResponse = () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(persona()) }] } }] })) {
  let reservations = 0
  let modelCalls = 0
  let refunds = 0
  let signal
  const resultSchema = load('src/lib/persona/result-schema.ts', { zod: require('zod') })
  const route = load('src/app/api/persona/generate/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => ({ user: { id: 'synthetic' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {} },
    '@/lib/net/safe-fetch': { safeFetchText: async () => '<html><title>Example</title></html>' },
    crypto: require('node:crypto'),
    '@/lib/persona/project-ledger': {
      reservePersonaProject: async () => { reservations++; return { state: 'reserved', project: { id: 'project', leaseToken: 'lease' }, used: 1, limit: 5 } },
      settlePersonaProject: async (_db, _user, _id, _lease, value) => { if ('failureCode' in value) refunds++; return true },
    },
    '@/lib/persona/image-entitlements': load('src/lib/persona/image-entitlements.ts'),
    '@/lib/persona/result-schema': resultSchema,
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    '@/lib/operational-json': load('src/lib/operational-json.ts', {}, { TextDecoder }),
    '@/lib/persona/provider-response': load('src/lib/persona/provider-response.ts'),
    '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
  }, {
    AbortSignal,
    process: { env: { GOOGLE_GENAI_API_KEY: 'synthetic' } },
    fetch: async (_url, options) => { modelCalls++; signal = options.signal; return providerResponse() },
  })
  return {
    get reservations() { return reservations }, get modelCalls() { return modelCalls }, get refunds() { return refunds }, get signal() { return signal },
    post: body => route.POST(new Request('http://test/api/persona/generate', { method: 'POST', body: JSON.stringify(body) })),
  }
}

;(async () => {
  await check('Persona rejects oversized and invalid input before quota and provider calls', async () => {
    const f = fixture()
    for (const body of [
      { url: 'https://example.test', additionalInfo: 'x'.repeat(1024 * 1024) },
      { url: 'https://example.test', serviceName: 'x'.repeat(201) },
      { url: 'https://example.test', additionalInfo: 'x'.repeat(8001) },
      { existingPersona: { persona: { name: 'old' } }, modifications: 'x'.repeat(8001) },
      { existingPersona: { persona: { name: 'old' } } },
      { url: 'https://example.test', additionalInfo: { text: 'wrong type' } },
    ]) {
      const response = await f.post(body)
      assert.ok([400, 413].includes(response.status))
    }
    assert.equal(f.reservations, 0)
    assert.equal(f.modelCalls, 0)
  })
  await check('Persona generation and modification remain usable for valid input', async () => {
    const normal = fixture()
    assert.equal((await normal.post({ url: 'https://example.test', additionalInfo: 'example' })).status, 200)
    assert.ok(normal.signal)
    const modified = fixture()
    assert.equal((await modified.post({ existingPersona: persona(), modifications: '年齢を変更してください' })).status, 200)
  })
  await check('Persona rejects oversized provider envelopes and refunds the claim', async () => {
    for (const response of [
      () => new Response('x', { headers: { 'content-length': String(2 * 1024 * 1024 + 1) } }),
      () => new Response('x'.repeat(2 * 1024 * 1024 + 1)),
    ]) {
      const f = fixture(response)
      const result = await f.post({ url: 'https://example.test' })
      assert.equal(result.status, 500)
      assert.equal(f.modelCalls, 2)
      assert.equal(f.refunds, 1)
      assert.equal((await result.text()).includes('xxxxx'), false)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
