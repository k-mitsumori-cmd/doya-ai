// The actual admin route is a strict transport and principal boundary. The actual provider and
// transactional store are exercised by verify-admin-subscription-{provider,settlement}.cjs.
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const crypto = require('node:crypto')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const actor = 'admin1', user = { id: 'user1', email: 'owner@example.invalid',
  stripeSubscriptionId: 'sub_saved', stripeCustomerId: 'cus_owner', plan: 'PRO' }
function fixture({ signed = true, foreign = false } = {}) {
  let reads = 0, calls = 0
  const session = { valid: signed, adminUser: signed ? { id: actor } : undefined }
  const stripe = { subscriptions: { retrieve: async id => {
    reads++
    return { id, customer: 'cus_owner', status: 'active', current_period_end: 1900000000,
      cancel_at_period_end: false, items: { data: [{ price: { id: 'price_one', unit_amount: 1000, recurring: { interval: 'month' } } }] } }
  } } }
  const api = load('src/app/api/admin/stripe/route.ts', {
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-admin-token' }) }) },
    '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => session },
    '@/lib/prisma': { prisma: { user: { findUnique: async () => user } } },
    '@/lib/stripe': { stripe, isDoyaSubscriptionOwnedByUser: async () => !foreign },
    '@/lib/private-api-response': { privateApiJson: (body, init = {}) => Response.json(body, init) },
    '@/lib/account-lifecycle/state': state,
    '@/lib/account-lifecycle/admin-subscription': { adminSubscriptionCoordinator: () => ({
      handle: async (ctx, action) => { calls++; assert.equal(ctx.adminId, actor); return {
        source: 'admin', actorId: ctx.adminId, targetUserId: action.targetUserId,
        operationId: action.operationId, intent: action.intent, phase: 'reserved', reason: null,
        canAbort: true, canContinue: true, actionPhase: 'planned', result: null,
      } },
    }) },
    '@/lib/account-lifecycle/admin-subscription-stripe-provider': { liveAdminSubscriptionStripeProvider: () => ({}) },
    '@/lib/account-lifecycle/checkout-stripe-provider': { stripeModeFromSecret: () => 'test' },
  }, { Request, Response, Headers })
  const post = body => api.POST(new Request('https://offline.invalid/api/admin/stripe', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
  return { api, post, get reads() { return reads }, get calls() { return calls } }
}
const operationId = crypto.randomUUID()
const base = { action: 'start', operationId, expectedAdminId: actor, targetUserId: user.id, intent: 'period_end_cancel' }
;(async () => {
  await check('unauthenticated admin POST cannot reach coordinator or provider', async () => {
    const f = fixture({ signed: false }); assert.equal((await f.post(base)).status, 401)
    assert.equal(f.calls, 0); assert.equal(f.reads, 0)
  })
  await check('admin GET refuses foreign saved contract', async () => {
    const f = fixture({ foreign: true })
    assert.equal((await f.api.GET(new Request('https://offline.invalid/api/admin/stripe?userId=user1'))).status, 409)
  })
  await check('old unfenced body and unexpected fields are rejected before provider or coordinator', async () => {
    const f = fixture()
    for (const body of [{ userId: user.id, action: 'cancel' }, { ...base, extra: 'unchecked' },
      { ...base, expectedAdminId: 'other' }, { ...base, operationId: 'bad' }]) {
      const result = await f.post(body)
      assert.equal(result.status === 400 || result.status === 403, true)
    }
    assert.equal(f.calls, 0); assert.equal(f.reads, 0)
  })
  for (const intent of ['period_end_cancel', 'immediate_cancel', 'resume']) {
    await check(`admin ${intent} has exact actor/target/operation transport envelope`, async () => {
      const f = fixture(), response = await f.post({ ...base, intent })
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.actorId, actor); assert.equal(body.targetUserId, user.id)
      assert.equal(body.operationId, operationId); assert.equal(body.intent, intent)
      assert.equal(f.calls, 1); assert.equal(f.reads, 0)
    })
  }
  await check('status/reconcile/abort/continue keep same strict identity envelope', async () => {
    const f = fixture()
    for (const action of ['status', 'reconcile', 'abort', 'continue']) {
      assert.equal((await f.post({ ...base, action })).status, 200)
    }
    assert.equal(f.calls, 4); assert.equal(f.reads, 0)
  })
  console.log(JSON.stringify({ passed: results.length, scope: 'actual strict admin route; provider/store assertions in dedicated real-source fixtures' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
