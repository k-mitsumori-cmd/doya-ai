const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, '../../src/app/api/mensetsu/sessions/route.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

async function exercise({ limit = 3, used = 0, conflictOnce = false, createFails = false } = {}) {
  let count = used
  let attempts = 0
  let creates = 0
  let quotaChecks = 0
  const prisma = {
    mensetsuTemplate: { findFirst: async () => ({ id: 'template', jobTitle: '営業', _count: { questions: 1, criteria: 1 } }) },
    mensetsuOrganization: { findUnique: async () => ({ retentionDays: 30 }) },
    $transaction: async (fn, options) => {
      assert.equal(options.isolationLevel, 'Serializable')
      attempts++
      if (conflictOnce && attempts === 1) {
        count = limit
        throw Object.assign(Error('concurrent issue'), { code: 'P2034' })
      }
      return fn({ mensetsuSession: {
        count: async () => count,
        create: async () => {
          creates++
          if (createFails) throw Error('storage unavailable')
          count++
          return { id: 'session', token: 'token', expiresAt: new Date(), candidateName: '候補者' }
        },
      } })
    },
  }
  const dependencies = {
    crypto: require('node:crypto'),
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/mensetsu/interview-url': { interviewUrl: (token) => `https://example.com/interview/${token}` },
    '@/lib/plan-limit': {
      assertFreeLimit: async () => ++quotaChecks === 1
        ? { ok: true, used: count, limit }
        : { ok: false, used: count, limit, reason: '上限に達しました' },
      FREE_LIMITS: { mensetsuSessions: 3 },
      jstStartOfMonthUtc: () => new Date(),
    },
    '@/lib/service-usage': { recordServiceUsage: async () => {} },
    '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'org', userId: 'user' }), orgSlugFrom: () => 'org' },
  }
  const exports = {}
  vm.runInNewContext(compiled, { exports, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name] }, console, Date, URL })
  const response = await exports.POST({ json: async () => ({ templateId: 'template', candidateName: '候補者' }) })
  return { status: response.status, body: await response.json(), count, creates, attempts }
}

;(async () => {
  const success = await exercise({ used: 2 })
  assert.equal(success.status, 200)
  assert.equal(success.count, 3)
  assert.equal(success.creates, 1)

  for (const [limit, expectedUpgrade] of [[3, '/mensetsu/pricing'], [30, undefined]]) {
    const blocked = await exercise({ limit, used: limit, conflictOnce: true })
    assert.equal(blocked.status, 402)
    assert.equal(blocked.attempts, 2)
    assert.equal(blocked.creates, 0)
    assert.equal(blocked.body.upgradeUrl, expectedUpgrade)
  }

  const failed = await exercise({ createFails: true })
  assert.equal(failed.status, 503)
  assert.equal(failed.creates, 1)
  assert.equal(failed.count, 0)
  console.log('PASS mensetsu issue: serialized quota, paid/free response and failed insert')
})().catch((error) => { console.error(error); process.exitCode = 1 })
