const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_HUBSPOT_FAILURE'
const contacts = [
  { id: 'h1', email: 'first@example.test', firstname: 'First', lastname: null, createdAt: '1970-01-01T00:00:01.500Z' },
  { id: 'h2', email: 'second@example.test', firstname: 'Second', lastname: null, createdAt: '1970-01-01T00:00:02.000Z' },
]
const users = new Map()
const enrolled = new Set()
const fetchBoundaries = []
const cursors = []
let failFirstEnrollment = true
let syncNotifications = 0

const route = load('src/app/api/cron/hubspot-sync/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: {
    dripSetting: {
      findUnique: async () => ({ value: { ts: 1000 } }),
      update: async ({ data }) => { cursors.push(data.value.ts) },
    },
    user: {
      findUnique: async ({ where }) => users.get(where.email) || null,
      create: async ({ data }) => {
        const user = { id: data.email }
        users.set(data.email, user)
        return user
      },
    },
  }, withRetry: async (fn) => fn() },
  '@/lib/drip-enroll': { enrollUserInDripSequences: async (userId) => {
    if (userId === 'first@example.test' && failFirstEnrollment) {
      failFirstEnrollment = false
      throw new Error(secret)
    }
    if (enrolled.has(userId)) return 0
    enrolled.add(userId)
    return 1
  } },
  '@/lib/hubspot': {
    hubspotConfigured: () => true,
    fetchContactsCreatedAfter: async (since) => { fetchBoundaries.push(since); return contacts },
  },
  '@/lib/notifications': { sendHubspotSyncNotification: async () => { syncNotifications++ } },
}, { process: { env: { CRON_SECRET: 'test-secret' } } })

const authorized = new Request('https://example.test/api/cron/hubspot-sync', {
  headers: { authorization: 'Bearer test-secret' },
})

;(async () => {
  const partial = await route.GET(authorized)
  assert.equal(partial.status, 503)
  const partialBody = await partial.json()
  assert.equal(partialBody.retryPending, true)
  assert.equal(partialBody.cursor, 1000)
  assert.deepEqual(cursors, [])
  assert.equal(users.size, 2)
  assert.equal(enrolled.size, 1)

  const retried = await route.GET(authorized)
  assert.equal(retried.status, 200)
  const retriedBody = await retried.json()
  assert.equal(retriedBody.retryPending, false)
  assert.equal(retriedBody.cursor, 2000)
  assert.deepEqual(cursors, [2000])
  assert.deepEqual(fetchBoundaries, [999, 999])
  assert.equal(users.size, 2)
  assert.equal(enrolled.size, 2)
  assert.equal(syncNotifications, 2)

  const failedFetch = load('src/app/api/cron/hubspot-sync/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: { dripSetting: { findUnique: async () => ({ value: { ts: 1000 } }) } }, withRetry: async (fn) => fn() },
    '@/lib/drip-enroll': { enrollUserInDripSequences: async () => { throw new Error('unexpected enrollment') } },
    '@/lib/hubspot': { hubspotConfigured: () => true, fetchContactsCreatedAfter: async () => { throw new Error(secret) } },
    '@/lib/notifications': { sendHubspotSyncNotification: async () => { throw new Error('unexpected notification') } },
  }, { process: { env: { CRON_SECRET: 'test-secret' } } })
  const failed = await failedFetch.GET(authorized)
  assert.equal(failed.status, 502)
  assert.equal(JSON.stringify(await failed.json()).includes(secret), false)

  const invalidCursor = load('src/app/api/cron/hubspot-sync/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: { dripSetting: { findUnique: async () => ({ value: { ts: 'invalid' } }) } }, withRetry: async (fn) => fn() },
    '@/lib/drip-enroll': {},
    '@/lib/hubspot': { hubspotConfigured: () => true, fetchContactsCreatedAfter: async () => { throw new Error('unexpected fetch') } },
    '@/lib/notifications': {},
  }, { process: { env: { CRON_SECRET: 'test-secret' } } })
  assert.equal((await invalidCursor.GET(authorized)).status, 503)

  const client = load('src/lib/hubspot.ts', {}, {
    process: { env: { HUBSPOT_PRIVATE_APP_TOKEN: 'fake' } },
    fetch: async () => Response.json({ results: [], paging: { next: { after: 'more' } } }),
  })
  await assert.rejects(client.fetchContactsCreatedAfter(0, 1), /page limit/)

  console.log('PASS HubSpot sync retries failed contacts without cursor loss, overlaps timestamps, and rejects truncated fetches')
})().catch((error) => { console.error(error); process.exitCode = 1 })
