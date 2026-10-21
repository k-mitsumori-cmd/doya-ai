// Actual read route and parsers; synthetic session/database only, no writes or network.
const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const parsing = load('src/lib/organization-workspace-selection.ts')
const { organizationSelection: select, workspaceHref, parseWorkspaceRead } = parsing
let actor = 'actor', reads = 0, fail = false, empty = false, unknown = false
const rows = [
  { role: 'member', organization: { id: 'A-id', slug: '組織A', name: 'Organization A' } },
  { role: 'owner', organization: { id: 'B-id', slug: 'B', name: 'Organization B' } },
]
const route = load('src/app/api/organization-workspace/[service]/route.ts', {
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
  '@/lib/auth': { authOptions: {} },
  '@/lib/organization-workspace-selection': parsing,
  '@/lib/prisma': { prisma: { aishodanMember: { findMany: async query => {
    reads++
    assert.equal(query.where.userId, actor)
    assert.equal(query.where.status, 'ACTIVE')
    assert.deepEqual(Array.from(query.where.role.in), ['owner', 'admin', 'manager', 'member'])
    assert.equal(query.orderBy.createdAt, 'asc')
    assert.equal(query.select.organization.select.id, true)
    if (fail) throw Error('synthetic DB failure')
    return empty ? [] : rows
  }, findFirst: async query => {
    reads++; assert.equal(query.where.userId, actor); assert.equal(query.where.status, 'ACTIVE')
    return unknown ? { id: 'unknown-role-membership' } : null
  } } } },
})
let passed = 0
async function check(name, fn) { await fn(); passed++; console.log('PASS ' + name) }
async function request(query = '', expected = 'actor', service = 'aishodan') {
  const response = await route.GET(new Request('https://example.invalid/api/organization-workspace/' + service + query, { headers: { 'x-doya-workspace-actor': expected } }), { params: Promise.resolve({ service }) })
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.ok(response.headers.get('vary').toLowerCase().includes('cookie'))
  return { status: response.status, data: await response.json() }
}
;(async () => {
  await check('absent and selected Unicode organization remain distinct', () => {
    assert.equal(select('?filter=ready').kind, 'absent')
    assert.equal(select('?org=%E7%B5%84%E7%B9%94A').slug, '組織A')
  })
  for (const query of ['?org=', '?org', '?org=A&org=B', '?%6frg=A&org=B', '?org=%E0%A4', '?org=%', '?org=..', '?org=.', '?org=A%2FB', '?org=A%5CB', '?org=A+B', '?org=%00', '?org=%3F']) {
    await check('invalid organization cannot become default: ' + query, async () => {
      assert.equal(select(query).kind, 'invalid'); const before = reads
      assert.equal((await request(query)).status, 400); assert.equal(reads, before)
    })
  }
  await check('scoped host link replaces org and preserves other query and fragment', () => {
    assert.equal(workspaceHref('/aishodan/sessions?verdict=hot&org=B#item', '組織A'), '/aishodan/sessions?verdict=hot&org=%E7%B5%84%E7%B9%94A#item')
    for (const path of ['https://other.invalid/aishodan', '//other.invalid/aishodan', '/m/public', '/aishodan/invite/token', '/aishodan/../../home']) assert.throws(() => workspaceHref(path, 'A'))
  })
  await check('explicit A wins over owner-first B and echoes actual principal and organization ID', async () => {
    const result = await request('?org=' + encodeURIComponent('組織A'))
    assert.equal(result.status, 200); assert.equal(result.data.actorId, 'actor'); assert.equal(result.data.current.id, 'A-id')
    assert.equal(parseWorkspaceRead(result.data, 'actor', select('?org=' + encodeURIComponent('組織A'))).current.slug, '組織A')
  })
  await check('unscoped discovery preserves owner-first default', async () => {
    const result = await request(); assert.equal(result.status, 200); assert.equal(result.data.current.id, 'B-id')
  })
  await check('foreign explicit org is denied instead of substituting owner default', async () => {
    const result = await request('?org=foreign'); assert.equal(result.status, 403); assert.equal(result.data.current, undefined)
  })
  await check('SDK/session actor mismatch stops before membership read', async () => {
    const before = reads; assert.equal((await request('', 'another-actor')).status, 409); assert.equal(reads, before)
  })
  await check('guest and unsupported service fail with private responses and no membership read', async () => {
    const before = reads; actor = ''; assert.equal((await request()).status, 401); actor = 'actor'
    assert.equal((await request('', 'actor', 'quote')).status, 404); assert.equal(reads, before)
  })
  await check('read failure is unavailable rather than empty membership', async () => {
    fail = true; const result = await request(); fail = false
    assert.equal(result.status, 503); assert.equal(result.data.memberships, undefined)
  })
  await check('confirmed no memberships differs from an ACTIVE row with an unknown role', async () => {
    empty = true
    const noMembership = await request(); assert.equal(noMembership.status, 200); assert.equal(noMembership.data.current, null); assert.equal(noMembership.data.memberships.length, 0)
    unknown = true; assert.equal((await request()).status, 503)
    empty = false; unknown = false
  })
  await check('invalid or mismatched DTO is never proof of workspace', () => {
    const valid = { service: 'aishodan', actorId: 'actor', memberships: rows.map(r => ({ ...r.organization, role: r.role })), current: { ...rows[0].organization, role: 'member' } }
    for (const changed of [ { actorId: 'other' }, { service: 'quote' }, { error: 'not ready' }, { current: valid.memberships[1] }, { memberships: [valid.current, valid.current] }, { current: { ...valid.current, role: '__proto__' } }, { current: null } ]) {
      assert.throws(() => parseWorkspaceRead({ ...valid, ...changed }, 'actor', { kind: 'selected', slug: '組織A' }))
    }
    assert.equal(parseWorkspaceRead({ service: 'aishodan', actorId: 'actor', memberships: [], current: null }, 'actor', { kind: 'absent' }).current, null)
  })
  console.log(JSON.stringify({ passed, scope: 'Actual read-only endpoint, strict query/DTO/link parsers with synthetic session and Prisma; no browser, real SDK or database' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
