const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const urls = load('src/lib/account-lifecycle/checkout-urls.ts')
const epoch = '11111111-1111-4111-8111-111111111111'
const routeUnitGlobals = { process: { env: { NEXT_PUBLIC_APP_URL: 'https://offline.invalid', NEXTAUTH_URL: 'https://offline.invalid', STRIPE_SECRET_KEY: 'sk_test_synthetic' } } }

/** Policy-only route fixture. The private PG suite exercises the actual coordinator and SDK adapter. */
function routeUnitDeps({ prisma, onStart = async () => ({ id: 'cs_fixture', url: 'https://checkout.example.invalid/fixture' }) }) {
  const bridge = {
    parseCheckoutHttpAction(value) {
      if (!value || typeof value !== 'object' || !state.validLifecycleUuid(value.operationId) || !['start', 'start_after_terminal', 'status', 'resume', 'ready', 'abort'].includes(value.action)) throw new state.LifecycleError('INVALID_CHECKOUT_ACTION', 400)
      return value
    },
    async resolveCheckoutActor(session, expectedActorId) {
      const sessionId = session?.user?.id
      const email = session?.user?.email
      if (!sessionId && !email) throw new state.LifecycleError('CHECKOUT_AUTH_REQUIRED', 401)
      const user = await prisma.user.findUnique({ where: email ? { email } : { id: sessionId } })
      if (!user) throw new state.LifecycleError('CHECKOUT_ACTOR_UNAVAILABLE', 404)
      if (sessionId && user.id !== sessionId || expectedActorId && user.id !== expectedActorId) throw new state.LifecycleError('CHECKOUT_ACTOR_MISMATCH', 403)
      return user
    },
    currentCheckoutEpoch: async () => epoch,
    checkoutIdentity: (actorId, operationId) => ({ operator: { kind: 'user', id: actorId }, targetUserId: actorId, operationId, kind: 'checkout' }),
    checkoutHttpResult: (result, actorId) => {
      if ('id' in result) return { actorId, operationId: result.operationId, sessionId: result.id, url: result.url }
      return { ...result, actorId }
    },
    runCheckoutHttpAction: async (action, actorId, start) => {
      const result = await onStart(await start(), action, actorId)
      return result && typeof result === 'object' && 'id' in result ? { ...result, operationId: action.operationId } : result
    },
  }
  return {
    '@/lib/account-lifecycle/state': state,
    '@/lib/account-lifecycle/checkout-urls': urls,
    '@/lib/account-lifecycle/checkout-http': bridge,
    '@/lib/account-lifecycle/checkout-stripe-provider': { stripeModeFromSecret: () => 'test' },
  }
}

const genericStart = (operationId = crypto.randomUUID(), fields = {}) => ({ action: 'start', operationId, planId: 'banner-pro', billingPeriod: 'monthly', serviceId: null, returnTo: null, ...fields })
const hrStart = (operationId = crypto.randomUUID(), fields = {}) => ({ action: 'start', operationId, plan: 'pro', interval: 'monthly', ...fields })
module.exports = { routeUnitDeps, routeUnitGlobals, genericStart, hrStart, state }
