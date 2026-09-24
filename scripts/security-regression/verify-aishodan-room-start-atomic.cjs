const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../../src/app/api/aishodan/room/[token]/start/route.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

async function exercise({ preview = false, used = 0, roomCount = 0, createFails = false, conflictOnce = false } = {}) {
  let count = roomCount
  let usage = used
  let creates = 0
  let attempts = 0
  const room = {
    id: 'room', organizationId: 'org', isActive: true, isPreview: preview,
    expiresAt: null, maxSessions: 3, sessionCount: roomCount,
    scenario: { phases: [{ key: 'opening' }] },
    organization: { retentionDays: 30 },
  }
  const prisma = {
    aishodanMember: { findFirst: async () => ({ userId: 'owner' }) },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      if (conflictOnce && attempts === 1) {
        usage = 3
        throw Object.assign(Error('concurrent insert'), { code: 'P2034' })
      }
      const before = { count, usage }
      const tx = {
        aishodanRoom: {
          findUnique: async () => ({ isActive: true, isPreview: preview, expiresAt: null, maxSessions: 3, sessionCount: count }),
          updateMany: async () => { if (count >= 3) return { count: 0 }; count++; return { count: 1 } },
        },
        aishodanSession: {
          count: async () => usage,
          create: async () => {
            creates++
            if (createFails) throw Error('synthetic storage failure')
            usage++
            return { id: 'session', status: 'pending', currentPhase: 'opening', consentedAt: new Date(), startedAt: null, endedAt: null, guestName: null }
          },
        },
      }
      try { return await fn(tx) } catch (error) { count = before.count; usage = before.usage; throw error }
    },
  }
  const response = { json: (body, init) => { const r = Response.json(body, init); r.cookies = { set: () => {} }; return r } }
  const deps = {
    crypto: require('node:crypto'),
    'next/server': { NextResponse: response },
    '@/lib/prisma': { prisma },
    '@/lib/aishodan/public': { loadRoomByToken: async () => room, assertRoomUsable: () => ({ ok: true }), toPublicSession: (s) => ({ id: s.id }) },
    '@/lib/plan-limit': { assertFreeLimit: async () => ({ ok: true, limit: 3, used }), jstStartOfMonthUtc: () => new Date(), FREE_LIMITS: { aishodanSessions: 3 } },
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in deps, name); return deps[name] }, console, Date, URL, process: { env: { NODE_ENV: 'test' } } })
  const req = { url: 'https://example.com/api/aishodan/room/token/start', json: async () => ({ consent: true }), cookies: { get: () => undefined }, headers: { get: () => null } }
  const result = await exports.POST(req, { params: Promise.resolve({ token: 'token123' }) })
  return { status: result.status, body: await result.json(), count, usage, creates, attempts }
}

;(async () => {
  const success = await exercise({ used: 2 })
  assert.equal(success.status, 200)
  assert.equal(success.count, 1)
  assert.equal(success.usage, 3)

  const atLimit = await exercise({ used: 3 })
  assert.equal(atLimit.status, 429)
  assert.equal(atLimit.count, 0)
  assert.equal(atLimit.creates, 0)

  const conflict = await exercise({ used: 2, conflictOnce: true })
  assert.equal(conflict.status, 429)
  assert.equal(conflict.attempts, 2)
  assert.equal(conflict.count, 0)
  assert.equal(conflict.creates, 0)

  const failed = await exercise({ createFails: true })
  assert.equal(failed.status, 503)
  assert.equal(failed.count, 0)
  assert.equal(failed.usage, 0)

  const preview = await exercise({ preview: true, used: 3 })
  assert.equal(preview.status, 200)
  assert.equal(preview.count, 1)
  console.log('PASS aishodan start: serialized quota, room reservation and session creation roll back together')
})().catch((error) => { console.error(error); process.exitCode = 1 })
