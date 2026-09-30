const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_PROVIDER_OR_DATABASE_DETAIL'

;(async () => {
  let notifications = 0
  const refine = load('src/app/api/banner/refine/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => { throw new Error(secret) } },
    '@/lib/auth': { authOptions: {} },
    sharp: () => {},
    '@/lib/notifications': { sendErrorNotification: async () => { notifications++ } },
    '@/lib/resolve-image-model': { resolveImageModel: async () => 'test' },
    '@/lib/pricing': { HIGH_USAGE_CONTACT_URL: '' },
    '@/lib/banner/monthly-quota': { reserveBannerMonthlyImages: async () => { throw new Error('unexpected quota call') }, releaseBannerMonthlyImages: async () => {} },
  })
  const failedRefine = await refine.POST({ json: async () => ({}) })
  assert.equal(failedRefine.status, 500)
  assert.equal(JSON.stringify(await failedRefine.json()).includes(secret), false)
  assert.equal(notifications, 1)

  let mailCalls = 0
  const sender = load('src/app/api/cron/drip-sender/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {}, withRetry: async () => { throw new Error(secret) } },
    '@/lib/email': { sendEmail: async () => { mailCalls++ } },
    '@/lib/drip-tokens': { generateUnsubscribeToken: () => 'test' },
    crypto,
  }, { process: { env: { CRON_SECRET: 'test-secret' } } })
  const authRequest = new Request('https://example.test/api/cron/drip-sender', {
    headers: { authorization: 'Bearer test-secret' },
  })
  const failedSend = await sender.GET(authRequest)
  assert.equal(failedSend.status, 500)
  assert.equal(JSON.stringify(await failedSend.json()).includes(secret), false)
  assert.equal(mailCalls, 0)

  const report = load('src/app/api/cron/drip-report/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/notifications': { sendDripReport: async () => { throw new Error(secret) } },
  }, { process: { env: { CRON_SECRET: 'test-secret' } } })
  const failedReport = await report.GET(new Request('https://example.test/api/cron/drip-report', {
    headers: { authorization: 'Bearer test-secret' },
  }))
  assert.equal(failedReport.status, 500)
  assert.equal(JSON.stringify(await failedReport.json()).includes(secret), false)

  const rules = await require('../../next.config.js').headers()
  const cronRule = rules.find((rule) => rule.source === '/api/cron/:path*')
  assert.equal(cronRule?.headers.find((header) => header.key === 'Cache-Control')?.value, 'private, no-store')
  const maintenanceRule = rules.find((rule) => rule.source === '/api/banner/test/templates/:path+')
  assert.equal(maintenanceRule?.headers.find((header) => header.key === 'Cache-Control')?.value, 'private, no-store')
  console.log('PASS banner refine and cron errors hide internals; cron responses are private; no email sent')
})().catch((error) => { console.error(error); process.exitCode = 1 })
