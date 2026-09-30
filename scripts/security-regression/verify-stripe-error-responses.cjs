const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const secret = 'PRIVATE_STRIPE_INTERNAL'
const common = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => { throw new Error(secret) } },
  '@/lib/auth': { authOptions: {} },
  '@/lib/stripe': {},
  '@/lib/prisma': { prisma: {} },
  '@/lib/unified-plan': { UNIFIED_TRIAL_DAYS: 30 },
  '@/lib/trial': {},
  '@/lib/billing-sync': {},
  '@/lib/notifications': {},
  '@/lib/alert': {},
}

;(async () => {
  for (const routePath of [
    'checkout', 'portal', 'sync', 'sync/latest', 'subscription/cancel', 'subscription/resume',
  ]) {
    const route = load(`src/app/api/stripe/${routePath}/route.ts`, common)
    const response = await route.POST(new Request('https://example.test/api/stripe/test', { method: 'POST', body: '{}' }))
    assert.equal(response.status, 500, routePath)
    const body = await response.json()
    assert.equal(typeof body.error, 'string')
    assert.equal(JSON.stringify(body).includes(secret), false, routePath)
  }

  const webhookMocks = {
    'next/server': { NextResponse: Response },
    'next/headers': { headers: async () => ({ get: () => 'signature' }) },
    '@/lib/stripe': { constructWebhookEvent: () => { throw new Error(secret) } },
    '@/lib/prisma': {},
    '@/lib/billing-sync': {},
    '@/lib/notifications': {},
    '@/lib/stripe-webhook-receipts': {
      claimStripeWebhookEvent: async () => ({ kind: 'claimed', token: 'test-claim' }),
      finishStripeWebhookEvent: async () => {},
    },
    '@/lib/stripe-webhook-notifications': {},
    stripe: {},
  }
  const webhook = load('src/app/api/stripe/webhook/route.ts', webhookMocks, { process: { env: { STRIPE_WEBHOOK_SECRET: 'test-secret' } } })
  const response = await webhook.POST({ text: async () => '{}' })
  assert.equal(response.status, 400)
  assert.equal(JSON.stringify(await response.json()).includes(secret), false)

  const failedWebhook = load('src/app/api/stripe/webhook/route.ts', {
    ...webhookMocks,
    '@/lib/stripe': { constructWebhookEvent: () => ({
      type: 'checkout.session.completed',
      data: { object: { client_reference_id: 'user', customer: 'customer', subscription: 'subscription' } },
    }) },
    '@/lib/prisma': { prisma: { user: { update: async () => { throw new Error(secret) } } }, withRetry: (fn) => fn() },
  }, { process: { env: { STRIPE_WEBHOOK_SECRET: 'test-secret' } } })
  const failedResponse = await failedWebhook.POST({ text: async () => '{}' })
  assert.equal(failedResponse.status, 500)
  assert.equal(JSON.stringify(await failedResponse.json()).includes(secret), false)

  const configured = await require('../../next.config.js').headers()
  for (const prefix of ['/api/admin/:path*', '/api/stripe/:path*']) {
    const rule = configured.find((entry) => entry.source === prefix)
    assert.ok(rule, `missing ${prefix} cache rule`)
    assert.equal(rule.headers.find((header) => header.key === 'Cache-Control')?.value, 'private, no-store')
  }
  console.log('PASS Stripe error responses hide internal details and private API headers cover admin and Stripe')
})().catch((error) => { console.error(error); process.exitCode = 1 })
