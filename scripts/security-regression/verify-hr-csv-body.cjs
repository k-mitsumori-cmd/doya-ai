const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const operationalJson = load('src/lib/operational-json.ts', {}, { TextDecoder })
const MAX_BYTES = 6_001_024
let session = { user: { id: 'u' } }, context = { organizationId: 'o', role: 'OWNER' }, writes = 0, outage = false
const api = load('src/app/api/hr/employees/import/route.ts', {
  'next-auth': { getServerSession: async () => session },
  '@/lib/auth': {},
  '@/lib/prisma': { prisma: {} },
  '@/lib/hr/access': { getHrContext: async () => context, hasMinRole: role => role === 'OWNER' },
  '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
  '@/lib/operational-json': operationalJson,
  '@/lib/hr/billing': {
    createWithinEmployeeLimit: async (_id, create) => {
      if (outage) throw Error('private database information')
      return { allowed: true, value: await create({
        hrEmployee: { create: async () => { writes++; return { id: 'synthetic' } } },
        hrEmployeeHistory: { create: async () => ({}) },
      }) }
    },
    employeeLimitMessage: () => '',
  },
})
const request = (body, headers = {}) => new Request('http://localhost/api/hr/employees/import', { method: 'POST', body, headers })
async function verify(req, status) {
  const response = await api.POST(req)
  assert.equal(response.status, status)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('vary'), /(?:^|,\s*)Cookie(?:,|$)/i)
  return response.json()
}
;(async () => {
  for (const [label, body] of [['malformed', '{'], ['null', 'null'], ['array', '[]'], ['scalar', '123'], ['empty', '']]) {
    await check(`${label} JSON is a private 400 before writes`, async () => {
      const before = writes; await verify(request(body), 400); assert.equal(writes, before)
    })
  }
  await check('invalid UTF8 is rejected before writes', async () => {
    await verify(request(new Uint8Array([0xff])), 400); assert.equal(writes, 0)
  })
  await check('declared oversized JSON is rejected before body reads', async () => {
    await verify(request('{}', { 'content-length': String(MAX_BYTES + 1) }), 413); assert.equal(writes, 0)
  })
  await check('chunked oversized JSON is bounded without content length', async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BYTES)); controller.enqueue(new Uint8Array(1)); controller.close() } })
    await verify(new Request('http://localhost/api/hr/employees/import', { method: 'POST', body: stream, duplex: 'half' }), 413)
    assert.equal(writes, 0)
  })
  await check('CSV decoded character limit remains enforced', async () => {
    await verify(request(JSON.stringify({ csvText: 'a'.repeat(1_000_001) })), 413); assert.equal(writes, 0)
  })
  await check('escaped Unicode near the CSV limit still fits the JSON byte bound', async () => {
    const csv = 'lastName,firstName\nSynthetic,' + '山'.repeat(999_950)
    const encoded = JSON.stringify({ csvText: csv }).replace(/山/g, '\\u5c71')
    const data = await verify(request(encoded), 200)
    assert.equal(data.imported, 1); assert.equal(writes, 1)
  })
  for (const [label, actor, ctx, status] of [
    ['anonymous', null, context, 401], ['revoked', session, null, 401],
    ['member', session, { organizationId: 'o', role: 'MEMBER' }, 403],
  ]) await check(`${label} request is denied before even parsing malformed JSON`, async () => {
    const oldSession = session, oldContext = context, before = writes
    session = actor; context = ctx
    try { await verify(request('{'), status); assert.equal(writes, before) }
    finally { session = oldSession; context = oldContext }
  })
  await check('row failure hides raw database details and keeps partial result contract', async () => {
    outage = true
    try { const data = await verify(request(JSON.stringify({ csvText: 'lastName,firstName\nSynthetic,Person' })), 200)
      assert.equal(data.imported, 0); assert.equal(data.failed, 1)
      assert.doesNotMatch(JSON.stringify(data), /private database/)
    } finally { outage = false }
  })
  console.log(`HR CSV body: ${results.length} checks passed`)
})().catch(error => { console.error(error); process.exitCode = 1 })
