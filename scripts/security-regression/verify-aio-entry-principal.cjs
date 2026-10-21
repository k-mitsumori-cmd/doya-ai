const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ actor = 'alpha', expected = 'alpha', org = null, context = true, billing = true } = {}) {
  const reads = { membership: 0, user: 0, billing: 0 }
  const route = load('src/app/api/aio/me/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => { reads.user++; return { plan: 'PRO', name: 'Synthetic' } } } } },
    '@/lib/aio/access': {
      listMembershipsFor: async id => { reads.membership++; assert.equal(id, actor); return [] },
      orgSlugFrom: () => org,
      getAioContext: async () => context ? { organizationId: 'synthetic-org' } : null,
    },
    '@/lib/aio/billing': { getAioBilling: async () => { reads.billing++; return billing ? { plan: 'PRO' } : null } },
  })
  const headers = expected === null ? {} : { 'X-Aio-Actor-Id': expected }
  return { reads, get: () => route.GET(new Request('https://example.invalid/api/aio/me', { headers })) }
}
function privateHeaders(response) {
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert(response.headers.get('Vary').split(/,\s*/).includes('Cookie'))
}
;(async () => {
  await check('Entry actor mismatch stops before membership and profile reads', async () => {
    const f = fixture({ actor: 'beta' }), response = await f.get()
    assert.equal(response.status, 409); assert.equal((await response.json()).code, 'ACTOR_CHANGED')
    assert.deepEqual(f.reads, { membership: 0, user: 0, billing: 0 }); privateHeaders(response)
  })
  for (const expected of ['', 'other']) await check('Invalid expected actor cannot disclose membership: ' + JSON.stringify(expected), async () => {
    const f = fixture({ expected }), response = await f.get()
    assert.equal(response.status, 409); assert.equal(f.reads.membership, 0); assert.equal(f.reads.user, 0); privateHeaders(response)
  })
  await check('Cookie logout with an expected actor is explicit authentication failure', async () => {
    const f = fixture({ actor: null }), response = await f.get(), data = await response.json()
    assert.equal(response.status, 401); assert.equal(data.actorId, null); assert.equal(data.code, 'ACTOR_REQUIRED')
    assert.equal(f.reads.membership, 0); privateHeaders(response)
  })
  await check('Confirmed empty membership binds actual actor and retains dashboard fields', async () => {
    const f = fixture(), response = await f.get(), data = await response.json()
    assert.equal(response.status, 200); assert.equal(data.actorId, 'alpha'); assert.equal(data.authenticated, true)
    assert.equal(data.onboarded, false); assert.equal(data.plan, 'PRO'); assert.equal(data.name, 'Synthetic')
    assert.deepEqual(data.memberships, []); privateHeaders(response)
  })
  await check('Existing callers without expected actor retain authenticated response compatibility', async () => {
    const f = fixture({ expected: null }), response = await f.get(), data = await response.json()
    assert.equal(response.status, 200); assert.equal(data.actorId, 'alpha'); assert.equal(data.plan, 'PRO'); privateHeaders(response)
  })
  await check('Existing guest callers retain guest response without profile queries', async () => {
    const f = fixture({ actor: null, expected: null }), response = await f.get(), data = await response.json()
    assert.equal(response.status, 200); assert.equal(data.authenticated, false); assert.equal(data.actorId, null)
    assert.equal(f.reads.user, 0); privateHeaders(response)
  })
  for (const [context, billing, code] of [[false, true, 403], [true, false, 409], [true, true, 200]]) await check('Organization billing branch remains private: ' + code, async () => {
    const f = fixture({ org: 'owned', context, billing }), response = await f.get()
    assert.equal(response.status, code); privateHeaders(response)
  })
  assert.equal(results.length, 10)
  console.log(JSON.stringify({ passed: results.length, expected: 10, scope: 'Actual AIO me handler and private response helper; synthetic session/Prisma/billing only. No real database/provider/browser acceptance.' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
