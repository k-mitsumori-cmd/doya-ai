// Actual five route modules and shared HTTP parser; store responses are synthetic.
process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const { load } = require('./load-typescript.cjs')
const cases = []
const services = ['shodan', 'aio', 'quote', 'mensetsu', 'aishodan']
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const types = load('src/lib/owner-transfer/types.ts', { 'node:crypto': crypto, '@/lib/account-lifecycle/state': state })
const privateResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: { json: Response.json } } })
const input = { expectedOwnerMemberId: 'old', targetMemberId: 'new', targetUserId: 'successor', targetRole: 'member', targetPlan: 'LIGHT' }
const op = '10000000-0000-4000-8000-000000000001'
async function check(name, fn) { await fn(); cases.push(name); console.log('PASS', name) }
const reply = (identity, phase, value = input) => ({ actorId: identity.actorUserId, service: identity.service,
  organizationId: identity.organizationId, operationId: identity.operationId, phase,
  input: phase === 'committed' ? value : null, createdAt: phase === 'missing' ? null : new Date().toISOString() })

for (const service of services) {
  let actor = 'actor', calls = [], transferError = null
  const store = {
    ownerTransferCandidates: async (...args) => {
      calls.push(['candidates', ...args]); return { actorId: args[2], service, organization: { id: 'org', slug: 'selected', name: 'Synthetic' },
        owner: { memberId: 'old', userId: args[2] }, candidates: [] }
    },
    ownerTransferStatus: async identity => { calls.push(['status', identity]); return reply(identity, 'missing') },
    transferOwner: async (identity, value, slug) => { calls.push(['transfer', identity, value, slug]); if (transferError) throw transferError; return reply(identity, 'committed', value) },
    cancelOwnerTransfer: async identity => { calls.push(['cancel', identity]); return reply(identity, 'canceled') },
  }
  const http = load('src/lib/owner-transfer/http.ts', {
    'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
    '@/lib/auth': { authOptions: {} }, '@/lib/private-api-response': privateResponse,
    '@/lib/account-lifecycle/state': state, './store': store, './types': types,
  }, { Buffer, URLSearchParams })
  const route = load(`src/app/api/${service}/owner-transfer/route.ts`, { '@/lib/owner-transfer/http': http })
  const base = `https://synthetic.invalid/api/${service}/owner-transfer`
  const headers = response => { assert.equal(response.headers.get('Cache-Control'), 'private, no-store'); assert.match(response.headers.get('Vary'), /Cookie/) }
  const post = body => route.POST(new Request(base, { method: 'POST', body: JSON.stringify(body) }))
  const get = query => route.GET(new Request(base + '?' + new URLSearchParams(query)))
  ;(async () => {
    await check(`${service}: candidates explicit slug and private response`, async () => {
      calls = []; const result = await get({ action: 'candidates', expectedActor: 'actor', orgSlug: 'selected' })
      assert.equal(result.status, 200); headers(result)
      assert.deepEqual(calls[0].slice(0, 4), ['candidates', service, 'selected', 'actor'])
    })
    await check(`${service}: transfer and status exact actor, service and operation`, async () => {
      calls = []; const result = await post({ action: 'transfer', expectedActor: 'actor', orgId: 'org', orgSlug: 'selected', operationId: op, input })
      assert.equal(result.status, 200); headers(result); assert.equal((await result.json()).phase, 'committed')
      assert.equal(calls[0][0], 'transfer'); assert.equal(calls[0][1].service, service)
      const status = await get({ action: 'status', expectedActor: 'actor', orgId: 'org', operationId: op })
      assert.equal(status.status, 200); headers(status); assert.equal(calls[1][0], 'status')
    })
    await check(`${service}: no actor mismatch or implicit organization reaches store`, async () => {
      calls = []
      for (const body of [
        { action: 'transfer', expectedActor: 'foreign', orgId: 'org', orgSlug: 'selected', operationId: op, input },
        { action: 'transfer', expectedActor: 'actor', orgId: 'org', operationId: op, input },
        { action: 'cancel', expectedActor: 'foreign', orgId: 'org', operationId: op },
      ]) { const result = await post(body); assert.equal(result.status >= 400, true); headers(result) }
      const status = await get({ action: 'status', expectedActor: 'foreign', orgId: 'org', operationId: op })
      assert.equal(status.status, 409); headers(status); assert.equal(calls.length, 0)
      const candidates = await get({ action: 'candidates', expectedActor: 'foreign', orgSlug: 'selected' })
      assert.equal(candidates.status, 409); headers(candidates); assert.equal(calls.length, 0)
      actor = ''; const denied = await get({ action: 'candidates', expectedActor: 'actor', orgSlug: 'selected' }); assert.equal(denied.status, 401)
      actor = 'actor'; assert.equal(calls.length, 0)
    })
    await check(`${service}: missing cancel carries authenticated compound identity`, async () => {
      calls = []; const result = await post({ action: 'cancel', expectedActor: 'actor', orgId: 'org', operationId: op })
      assert.equal(result.status, 200); headers(result); assert.equal(calls.length, 1)
      assert.equal(calls[0][1].service, service); assert.equal(calls[0][1].actorUserId, 'actor')
    })
    await check(`${service}: confirmed store rejection binds code to the exact saved operation`, async () => {
      calls = []; transferError = new types.OwnerTransferError('OWNER_TRANSFER_CONFIRMATION_CHANGED')
      try {
        const response = await post({ action: 'transfer', expectedActor: 'actor', orgId: 'org', orgSlug: 'selected', operationId: op, input })
        assert.equal(response.status, 409); headers(response)
        assert.deepEqual(await response.json(), { code: 'OWNER_TRANSFER_CONFIRMATION_CHANGED',
          error: transferError.message, actorId: 'actor', service, organizationId: 'org', operationId: op })
        assert.equal(calls.length, 1)
      } finally { transferError = null }
    })
  })().catch(error => { console.error(error); process.exitCode = 1 })
}
process.on('beforeExit', () => {
  if (process.exitCode) return
  assert.equal(cases.length, 25)
  const files = [...services.map(service => `src/app/api/${service}/owner-transfer/route.ts`),
    'src/lib/owner-transfer/http.ts', 'scripts/security-regression/verify-owner-transfer-routes.cjs']
  const sourceHashes = Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))
  console.log(JSON.stringify({ passed: cases.length, cases, sourceHashes, scope: 'Actual HTTP route/parser with synthetic store/session; no DB.' }))
})
