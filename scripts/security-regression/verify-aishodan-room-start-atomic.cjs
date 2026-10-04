const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../../src/app/api/aishodan/room/[token]/start/route.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

async function exercise({ preview = false, used = 0, ledgerUsed = 0, roomCount = 0, createFails = false, ledgerFails = false, quotaUnavailable = false, conflictOnce = false, authenticated = true, member = true, archiveBeforeCommit = false } = {}) {
  let count = roomCount
  let usage = used
  let ledgerLifetime = ledgerUsed
  let ledgerMonthly = ledgerUsed
  let creates = 0
  let attempts = 0
  let countedWhere
  const room = {
    id: 'room', organizationId: 'org', isActive: true, isPreview: preview,
    expiresAt: null, maxSessions: 3, sessionCount: roomCount,
    scenario: { phases: [{ key: 'opening' }] },
    organization: { retentionDays: 30 },
  }
  const prisma = {
    aishodanMember: { findFirst: async () => member ? ({ id: 'membership', userId: 'owner' }) : null },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      if (conflictOnce && attempts === 1) {
        usage = 3
        throw Object.assign(Error('concurrent insert'), { code: 'P2034' })
      }
      const before = { count, usage, ledgerLifetime, ledgerMonthly }
      const tx = {
        aishodanMember: { findFirst: async () => member ? ({ id: 'membership' }) : null },
        aishodanRoom: {
          findUnique: async () => ({ isActive: true, isPreview: preview, expiresAt: null, maxSessions: 3, sessionCount: count, scenario: { product: { archivedAt: archiveBeforeCommit ? new Date() : null } } }),
          updateMany: async () => { if (count >= 3) return { count: 0 }; count++; return { count: 1 } },
        },
        aishodanSession: {
          count: async ({ where }) => { countedWhere = where; return usage },
          create: async () => {
            creates++
            if (createFails) throw Error('synthetic storage failure')
            usage++
            return { id: 'session', status: 'pending', currentPhase: 'opening', consentedAt: new Date(), startedAt: null, endedAt: null, guestName: null }
          },
        },
      }
      try { return await fn(tx) } catch (error) { count = before.count; usage = before.usage; ledgerLifetime = before.ledgerLifetime; ledgerMonthly = before.ledgerMonthly; throw error }
    },
  }
  const response = { json: (body, init) => { const r = Response.json(body, init); r.cookies = { set: () => {} }; return r } }
  const deps = {
    crypto: require('node:crypto'),
    'next/server': { NextResponse: response },
    '@/lib/prisma': { prisma },
    '@/lib/aishodan/public': { loadRoomByToken: async () => room, assertRoomUsable: () => ({ ok: true }), toPublicSession: (s) => ({ id: s.id }) },
    '@/lib/aishodan/access': { resolveUserId: async () => authenticated ? 'owner' : undefined },
    '@/lib/plan-limit': { assertFreeLimit: async () => { if (quotaUnavailable) throw Error('synthetic DB failure'); return { ok: true, limit: 3, used } }, jstStartOfMonthUtc: () => new Date(), FREE_LIMITS: { aishodanSessions: 3 } },
    '@/lib/organization-quota-ledger': {
      getOrganizationQuotaUsage: async (_db, _key, _org, period, countLive) => Math.max(await countLive(), period === 'monthly' ? ledgerMonthly : ledgerLifetime),
      recordOrganizationQuotaUsage: async (_tx, _key, _org, lifetime, monthly) => {
        if (ledgerFails) throw Error('synthetic ledger failure')
        ledgerLifetime = lifetime + 1
        ledgerMonthly = monthly + 1
      },
    },
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in deps, name); return deps[name] }, console, Date, URL, process: { env: { NODE_ENV: 'test' } } })
  const req = { url: 'https://example.com/api/aishodan/room/token/start', json: async () => ({ consent: true }), cookies: { get: () => undefined }, headers: { get: () => null } }
  const result = await exports.POST(req, { params: Promise.resolve({ token: 'token123' }) })
  return { status: result.status, body: await result.json(), count, usage, ledgerLifetime, ledgerMonthly, creates, attempts, countedWhere }
}

;(async () => {
  const success = await exercise({ used: 2 })
  assert.equal(success.status, 200)
  assert.equal(success.count, 1)
  assert.equal(success.usage, 3)
  assert.equal(success.ledgerLifetime, 3)
  const archived = await exercise({ archiveBeforeCommit: true })
  assert.equal(archived.status, 429)
  assert.equal(archived.creates, 0)

  const realGuest = await exercise({ authenticated: false })
  assert.equal(realGuest.status, 200)

  const atLimit = await exercise({ used: 3 })
  assert.equal(atLimit.status, 429)
  assert.equal(atLimit.count, 0)
  assert.equal(atLimit.creates, 0)

  const deletedHistory = await exercise({ used: 0, ledgerUsed: 3 })
  assert.equal(deletedHistory.status, 429)
  assert.equal(deletedHistory.creates, 0)

  const unavailable = await exercise({ quotaUnavailable: true })
  assert.equal(unavailable.status, 503)
  assert.equal(unavailable.creates, 0)

  const conflict = await exercise({ used: 2, conflictOnce: true })
  assert.equal(conflict.status, 429)
  assert.equal(conflict.attempts, 2)
  assert.equal(conflict.count, 0)
  assert.equal(conflict.creates, 0)

  const failed = await exercise({ createFails: true })
  assert.equal(failed.status, 503)
  assert.equal(failed.count, 0)
  assert.equal(failed.usage, 0)
  assert.equal(failed.ledgerLifetime, 0)

  const ledgerFailure = await exercise({ ledgerFails: true })
  assert.equal(ledgerFailure.status, 503)
  assert.equal(ledgerFailure.usage, 0)
  assert.equal(ledgerFailure.ledgerLifetime, 0)

  const previewGuest = await exercise({ preview: true, authenticated: false })
  assert.equal(previewGuest.status, 401)
  assert.equal(previewGuest.creates, 0)

  const previewOutsider = await exercise({ preview: true, member: false })
  assert.equal(previewOutsider.status, 403)
  assert.equal(previewOutsider.creates, 0)

  const previewAtLimit = await exercise({ preview: true, used: 10 })
  assert.equal(previewAtLimit.status, 429)
  assert.equal(previewAtLimit.body.code, 'PREVIEW_DAILY_LIMIT')
  assert.equal(previewAtLimit.creates, 0)
  assert.equal(previewAtLimit.countedWhere.organizationId, 'org')
  assert.equal(previewAtLimit.countedWhere.room.isPreview, true)
  assert.ok(previewAtLimit.countedWhere.createdAt.gte instanceof Date)

  const preview = await exercise({ preview: true, used: 9 })
  assert.equal(preview.status, 200)
  assert.equal(preview.count, 1)
  console.log('PASS aishodan start: serialized quota, private preview cap, room reservation and session creation roll back together')
})().catch((error) => { console.error(error); process.exitCode = 1 })
