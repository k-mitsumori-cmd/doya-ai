const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const now = new Date('2026-10-02T06:00:00.000Z')
const project = { id: 'guest-project', userId: null, guestId: 'guest-owner' }
let processing = false, quotaValue = JSON.stringify({ usedSeconds: 300, reservedSeconds: 30 })
let accountUpdates = 0, dailyTransfers = 0, transferMarkers = 0
const tx = {
  $executeRaw: async (parts, ...values) => {
    if (String(parts[0]).includes('INSERT INTO "SystemSetting"')) {
      dailyTransfers++
      assert(values.some(value => value === '2026-10-02'))
      assert(values.includes(dailyTransfers === 1 ? 2 : 1))
    } else if (String(parts[0]).includes('UPDATE "SystemSetting"')) {
      transferMarkers++
      assert(values.includes('account-owner'))
      assert(values.includes('2026-10-02'))
    }
    return 1
  },
  $queryRaw: async (parts, key) => [{ value: JSON.stringify({ day: '2026-10-02', count: key.includes('interview-article') ? 2 : 1 }) }],
  interviewProject: {
    findMany: async ({ where }) => {
      assert.equal(where.guestId, 'guest-owner')
      assert.equal(where.userId, null)
      return project.userId ? [] : [{ id: project.id }]
    },
    updateMany: async ({ where, data }) => {
      assert.equal(where.guestId, project.guestId)
      assert.equal(where.userId, null)
      assert.deepEqual(Array.from(where.id.in), [project.id])
      project.userId = data.userId
      return { count: 1 }
    },
  },
  interviewMaterial: {
    count: async () => processing ? 1 : 0,
    aggregate: async ({ where }) => {
      assert.equal(where.status, 'COMPLETED')
      assert.deepEqual(Array.from(where.projectId.in), [project.id])
      return { _sum: { duration: 120 } }
    },
  },
  interviewTranscription: { count: async () => 0 },
  systemSetting: {
    findUnique: async ({ where }) => where.key.startsWith('interview-transcription:') ? { value: quotaValue } : null,
    update: async ({ data }) => { accountUpdates++; quotaValue = data.value },
  },
}
const db = { $transaction: async fn => fn(tx) }
const claim = load('src/lib/interview/guest-claim.ts', {
  'node:crypto': crypto,
  '@/lib/prisma': { prisma: db },
  './month': { interviewJstMonthStartUtc: () => new Date('2026-09-30T15:00:00.000Z') },
}).claimInterviewGuestProjects
const access = load('src/lib/interview/access.ts', {
  'next/server': { NextResponse: { json: (_body, init) => ({ status: init.status }) } },
  'next-auth': { getServerSession: async () => null },
  '@/lib/auth': { authOptions: {} },
})
let routeUser = null, deletedCookie = null, routeClaims = 0
const route = load('src/app/api/interview/claim-guest/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => {
    const response = Response.json(body, init)
    response.cookies = { delete: name => { deletedCookie = name } }
    return response
  } } },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: routeUser }), getGuestIdFromRequest: () => 'guest-owner',
    INTERVIEW_GUEST_COOKIE: 'doyaInterview.guestId', requireDatabase: () => null,
  },
  '@/lib/interview/guest-claim': { claimInterviewGuestProjects: async () => { routeClaims++; return { state: 'claimed', count: 1 } } },
})

;(async () => {
  await check('processing guest project is never partially claimed', async () => {
    processing = true
    assert.equal((await claim('account-owner', 'guest-owner', now)).state, 'busy')
    assert.equal(project.userId, null)
    assert.equal(accountUpdates, 0)
    assert.equal(dailyTransfers, 0)
    assert.equal(transferMarkers, 0)
  })
  await check('same-cookie claim transfers ownership and usage exactly once', async () => {
    processing = false
    assert.equal((await claim('account-owner', 'guest-owner', now)).count, 1)
    assert.equal(project.userId, 'account-owner')
    assert.equal(project.guestId, 'guest-owner')
    assert.deepEqual(JSON.parse(quotaValue), { usedSeconds: 420, reservedSeconds: 30 })
    assert.equal(accountUpdates, 1)
    assert.equal(dailyTransfers, 2)
    assert.equal(transferMarkers, 1)
    assert.equal((await claim('account-owner', 'guest-owner', now)).count, 0)
    assert.equal(accountUpdates, 1)
    assert.equal(dailyTransfers, 2)
    assert.equal(transferMarkers, 1)
  })
  await check('another account with the old cookie cannot claim the project', async () => {
    assert.equal((await claim('other-account', 'guest-owner', now)).count, 0)
    assert.equal(project.userId, 'account-owner')
    await assert.rejects(() => claim('../invalid', 'guest-owner', now))
  })
  await check('claimed project rejects the old anonymous cookie but accepts its account', async () => {
    assert.equal(access.checkOwnership(project, null, 'guest-owner').status, 404)
    assert.equal(access.checkOwnership(project, 'account-owner', null), null)
    assert.equal(access.checkOwnership(project, 'other-account', null).status, 404)
  })
  await check('claim endpoint rejects cross-origin and anonymous requests before mutation', async () => {
    const request = origin => ({ headers: new Headers(origin ? { origin } : {}), nextUrl: new URL('https://doya.example/api/interview/claim-guest') })
    assert.equal((await route.POST(request(null))).status, 403)
    assert.equal((await route.POST(request('https://other.example'))).status, 403)
    assert.equal((await route.POST(request('https://doya.example'))).status, 401)
    assert.equal(routeClaims, 0)
    routeUser = 'account-owner'
    const success = await route.POST(request('https://doya.example'))
    assert.equal(success.status, 200)
    assert.equal((await success.json()).claimed, 1)
    assert.equal(deletedCookie, 'doyaInterview.guestId')
    assert.equal(routeClaims, 1)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
