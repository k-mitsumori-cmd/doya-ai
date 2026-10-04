const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const { load, check, results } = require('./load-typescript.cjs')

const budget = load('src/lib/shodan/profile-extraction-budget.ts', {
  'node:crypto': { createHash },
  '@/lib/prisma': { prisma: {} },
})

function database(initial = []) {
  const rows = new Map(initial)
  let tail = Promise.resolve()
  const tx = {
    $executeRaw: async () => {},
    systemSetting: {
      findUnique: async ({ where }) => rows.has(where.key) ? { value: rows.get(where.key) } : null,
      upsert: async ({ where, create, update }) => rows.set(where.key, rows.has(where.key) ? update.value : create.value),
    },
  }
  return { rows, $transaction: async callback => {
    let release
    const previous = tail
    tail = new Promise(resolve => { release = resolve })
    await previous
    try { return await callback(tx) } finally { release() }
  } }
}

;(async () => {
  await check('Shodan profile extraction serializes per organization and resets at JST midnight', async () => {
    const key = budget.shodanProfileUsageKey('org')
    const db = database([[key, '2026-09-25:49']])
    const now = new Date('2026-09-25T14:59:59Z')
    const attempts = await Promise.allSettled([
      budget.reserveShodanProfileExtraction('org', db, now),
      budget.reserveShodanProfileExtraction('org', db, now),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.reason instanceof budget.ShodanProfileDailyLimitError).length, 1)
    assert.equal(db.rows.get(key), '2026-09-25:50')
    await budget.reserveShodanProfileExtraction('org', db, new Date('2026-09-25T15:00:00Z'))
    assert.equal(db.rows.get(key), '2026-09-26:1')
    await budget.reserveShodanProfileExtraction('other-org', db, now)
    assert.equal(db.rows.get(budget.shodanProfileUsageKey('other-org')), '2026-09-25:1')
  })
  await check('Shodan profile extraction fails closed on ledger corruption', async () => {
    const key = budget.shodanProfileUsageKey('org')
    const db = database([[key, 'broken']])
    await assert.rejects(budget.reserveShodanProfileExtraction('org', db), /ledger invalid/)
    assert.equal(db.rows.get(key), 'broken')
  })
  await check('Shodan profile extraction rejects limit before website or AI calls', async () => {
    let researchCalls = 0
    let modelCalls = 0
    let reservations = 0
    let limited = true
    const api = load('src/app/api/shodan/company-profile/extract/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org', role: 'manager' }), hasMinRole: () => true, orgSlugFrom: () => 'org' },
      '@/lib/shodan/research': { researchCompany: async () => { researchCalls++; return { companyName: 'Example' } } },
      '@/lib/shodan/ai': { draftOwnProfile: async () => { modelCalls++; return { companyName: 'Example', gaps: [] } } },
      '@/lib/shodan/profile-extraction-budget': {
        ShodanProfileDailyLimitError: budget.ShodanProfileDailyLimitError,
        SHODAN_PROFILE_DAILY_LIMIT: 50,
        reserveShodanProfileExtraction: async id => {
          assert.equal(id, 'org')
          reservations++
          if (limited) throw new budget.ShodanProfileDailyLimitError()
        },
      },
    })
    assert.equal((await api.POST({ json: async () => ({ url: 42 }) })).status, 400)
    assert.equal(reservations, 0)
    const blocked = await api.POST({ json: async () => ({ url: 'https://example.com' }) })
    assert.equal(blocked.status, 429)
    assert.equal((await blocked.json()).code, 'SHODAN_PROFILE_DAILY_LIMIT')
    assert.equal(researchCalls, 0)
    assert.equal(modelCalls, 0)
    limited = false
    assert.equal((await api.POST({ json: async () => ({ url: 'https://example.com' }) })).status, 200)
    assert.equal(researchCalls, 1)
    assert.equal(modelCalls, 1)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
