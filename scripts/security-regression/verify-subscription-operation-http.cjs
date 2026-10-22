const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': require('node:crypto') })
const operationId = '123e4567-e89b-42d3-a456-426614174000'
const calls = []
const prisma = { user: { findUnique: async args => {
  if (args.where.email) return { id: 'actor1', email: 'actor@example.invalid' }
  return { id: 'actor1', email: 'actor@example.invalid', stripeCustomerId: null, stripeSubscriptionId: null, serviceSubscriptions: [] }
} } }
const http = load('src/lib/account-lifecycle/subscription-http.ts', {
  'server-only': {}, './state': state,
  './subscription': { subscriptionCoordinator: () => ({ handle: async (kind, actor, action) => {
    calls.push({ kind, actor, action })
    return { actorId: actor.id, operationId: action.operationId, kind, phase: 'missing', reason: null, actions: [], canAbort: true, canContinue: false }
  } }) },
  './subscription-stripe-provider': { liveSubscriptionStripeProvider: () => ({}) },
  './checkout-stripe-provider': { stripeModeFromSecret: () => 'test' },
  '@/lib/prisma': { prisma },
})
const session = { user: { id: 'actor1', email: 'actor@example.invalid' } }
const route = kind => load(`src/app/api/stripe/subscription/${kind}/route.ts`, {
  'next/server': { NextResponse: Response }, 'next-auth': { getServerSession: async () => session },
  '@/lib/auth': {}, '@/lib/account-lifecycle/state': state,
  '@/lib/account-lifecycle/subscription-http': http,
})
;(async () => {
  for (const kind of ['cancel', 'resume']) {
    const api = route(kind)
    const start = { action: 'start', operationId, expectedActorId: 'actor1', serviceId: 'banner', ...(kind === 'cancel' ? { mode: 'period_end' } : {}) }
    await check(`${kind} strict start and private actor envelope`, async () => {
      const response = await api.POST({ json: async () => start })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      assert.equal(response.headers.get('vary'), 'Cookie')
      assert.equal((await response.json()).actorId, 'actor1')
      assert.equal(calls.at(-1).kind, kind)
    })
    for (const bad of [
      { ...start, operationId: 'bad' }, { ...start, expectedActorId: 'foreign' },
      { ...start, unknown: true }, { ...start, mode: 'never' },
      { action: 'status', operationId, expectedActorId: 'actor1', serviceId: 'banner' },
    ]) await check(`${kind} rejects unfenced or mismatched body ${JSON.stringify(bad)}`, async () => {
      const before = calls.length
      const response = await api.POST({ json: async () => bad })
      assert.ok([400, 403].includes(response.status))
      assert.equal(calls.length, before)
    })
    await check(`${kind} saved-handle status is read only`, async () => {
      const response = await api.POST({ json: async () => ({ action: 'status', operationId, expectedActorId: 'actor1' }) })
      assert.equal(response.status, 200)
      assert.equal(calls.at(-1).action.action, 'status')
    })
  }
  console.log(JSON.stringify({ passed: results.length, scope: 'actual routes and parser with synthetic session/coordinator; no DB or SDK' }))
})().catch(error => { console.error(error); process.exitCode = 1 })
