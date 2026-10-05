const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ status = 'pending', beforeSave } = {}) {
  const originalConsent = status === 'live' || status === 'consented' ? new Date(Date.now() - 60000) : null
  const row = {
    id: 'session', token: 'synthetic-token-12345', status,
    startedAt: status === 'live' ? new Date(Date.now() - 30000) : null, endedAt: null,
    consentedAt: originalConsent, consentIp: 'original-ip', consentUa: 'original-ua',
    candidateName: 'Original', expiresAt: new Date(Date.now() + 60000), updatedAt: new Date(),
    organization: { name: 'Company', recordAudio: false, retentionDays: 30, discloseToCandidate: false },
    template: { jobTitle: 'Role', durationMin: 15, intro: null, questions: [] },
  }
  let writes = 0
  const db = { mensetsuSession: {
    findUnique: async () => ({ ...row }),
    update: async ({ data }) => {
      beforeSave?.(row)
      Object.assign(row, data)
      writes++
      return { ...row }
    },
    updateMany: async ({ where, data }) => {
      beforeSave?.(row)
      if (!where.status.in.includes(row.status) || row.startedAt || row.endedAt || row.consentedAt ||
          row.expiresAt <= where.expiresAt.gt || row.updatedAt.getTime() !== where.updatedAt.getTime()) return { count: 0 }
      Object.assign(row, data)
      writes++
      return { count: 1 }
    },
  } }
  const publicApi = load('src/lib/mensetsu/public.ts', { '@/lib/prisma': { prisma: db } })
  const api = load('src/app/api/mensetsu/live/[token]/consent/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@/lib/prisma': { prisma: db }, '@/lib/mensetsu/public': publicApi,
  })
  return {
    row, originalConsent, get writes() { return writes },
    run: (agreed = true) => api.POST({
      json: async () => ({ agreed, candidateName: 'New Name' }),
      headers: { get: (name) => name === 'user-agent' ? 'new-ua' : 'new-ip' },
    }, { params: Promise.resolve({ token: row.token }) }),
  }
}

;(async () => {
  await check('first explicit consent saves and returns the new public state', async () => {
    const f = fixture()
    const response = await f.run()
    assert.equal(response.status, 200)
    assert.equal(response.body.session.status, 'consented')
    assert.equal(response.body.session.candidateName, 'New Name')
    assert.equal(f.row.consentUa, 'new-ua')
    assert.equal(f.writes, 1)
    assert.equal(response.body.session.consentIp, undefined)
  })
  for (const status of ['consented', 'live']) {
    await check(`repeated consent preserves ${status} and initial evidence`, async () => {
      const f = fixture({ status })
      const response = await f.run()
      assert.equal(response.status, 200)
      assert.equal(response.body.session.status, status)
      assert.equal(f.row.consentedAt, f.originalConsent)
      assert.equal(f.row.consentIp, 'original-ip')
      assert.equal(f.row.candidateName, 'Original')
      assert.equal(f.writes, 0)
    })
  }
  await check('simultaneous consent requests record consent once', async () => {
    const f = fixture()
    const responses = await Promise.all([f.run(), f.run()])
    assert.deepEqual(responses.map((r) => r.status), [200, 200])
    assert.equal(f.writes, 1)
  })
  await check('unagreed request does not write consent', async () => {
    const f = fixture()
    assert.equal((await f.run(false)).status, 400)
    assert.equal(f.writes, 0)
  })
  for (const status of ['completed', 'evaluating', 'evaluated', 'aborted']) {
    await check(`late consent cannot overwrite ${status}`, async () => {
      const f = fixture({ beforeSave: (row) => { row.status = status; row.endedAt = new Date() } })
      assert.equal((await f.run()).status, 409)
      assert.equal(f.row.status, status)
      assert.equal(f.row.consentedAt, null)
      assert.equal(f.writes, 0)
    })
  }
  await check('changed candidate details are not overwritten by a stale consent request', async () => {
    const f = fixture({ beforeSave: (row) => {
      row.candidateName = 'Recruiter Edit'
      row.updatedAt = new Date(row.updatedAt.getTime() + 1)
    } })
    assert.equal((await f.run()).status, 409)
    assert.equal(f.row.candidateName, 'Recruiter Edit')
    assert.equal(f.row.consentedAt, null)
    assert.equal(f.writes, 0)
  })
  await check('expiration during consent prevents saving evidence', async () => {
    const f = fixture({ beforeSave: (row) => { row.expiresAt = new Date(Date.now() - 1000) } })
    assert.equal((await f.run()).status, 410)
    assert.equal(f.writes, 0)
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch((error) => { console.error(error); process.exitCode = 1 })
