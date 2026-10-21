import 'server-only'
import type Stripe from 'stripe'
import { LifecycleError } from './state'
import type { CheckoutProvider, ProviderCheckout, ProviderCustomer } from './checkout-provider'

const unknown = (): never => { throw new LifecycleError('CHECKOUT_RESULT_UNKNOWN') }

/** Transport-only adapter. The checkout coordinator owns all admission, dispatch and facts. */
export function checkoutStripeProvider(sdk: Stripe, mode: 'test' | 'live'): CheckoutProvider {
  const expectedLive = mode === 'live'
  function customer(raw: Stripe.Customer | Stripe.DeletedCustomer): ProviderCustomer {
    return { id: raw.id, livemode: 'livemode' in raw ? raw.livemode : false, deleted: 'deleted' in raw && raw.deleted === true, email: 'email' in raw ? raw.email : null, metadata: 'metadata' in raw ? raw.metadata : {} }
  }
  function customerId(raw: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
    if (raw === null) return null
    if (typeof raw === 'string') return raw
    if ('deleted' in raw && raw.deleted === true || !('livemode' in raw) || raw.livemode !== expectedLive) return unknown()
    return raw.id
  }
  function subscriptionId(raw: string | Stripe.Subscription | null): string | null {
    if (raw === null) return null
    if (typeof raw === 'string') return raw
    if (raw.livemode !== expectedLive) return unknown()
    return raw.id
  }
  function checkout(raw: Stripe.Checkout.Session): ProviderCheckout {
    const items = raw.line_items
    if (!items || items.has_more || items.data.length !== 1) return unknown()
    const price = items.data[0]?.price
    if (!price || typeof price === 'string') return unknown()
    return {
      id: raw.id, livemode: raw.livemode, mode: raw.mode, status: raw.status,
      client_reference_id: raw.client_reference_id, metadata: raw.metadata,
      customer: customerId(raw.customer), customer_email: raw.customer_email,
      subscription: subscriptionId(raw.subscription), url: raw.url,
      success_url: raw.success_url, cancel_url: raw.cancel_url, expires_at: raw.expires_at,
      line_items: { data: [{ quantity: items.data[0].quantity, price: { id: price.id } }], has_more: false },
    }
  }
  async function exactCheckout(id: string) {
    return checkout(await sdk.checkout.sessions.retrieve(id, { expand: ['line_items'] }))
  }
  return {
    async createCustomer(params, options) {
      const raw = await sdk.customers.create({ email: params.email, name: params.name, metadata: { ...params.metadata, app: 'doya-ai' } }, { idempotencyKey: options.idempotencyKey })
      return customer(raw)
    },
    async retrieveCustomer(id) { return customer(await sdk.customers.retrieve(id)) },
    async createCheckout(params, options) {
      const raw = await sdk.checkout.sessions.create({
        mode: 'subscription', payment_method_types: ['card'], allow_promotion_codes: true,
        customer: params.customer || undefined,
        customer_email: params.customer ? undefined : params.customer_email || undefined,
        line_items: [{ price: params.priceId, quantity: 1 }],
        success_url: params.successUrl, cancel_url: params.cancelUrl,
        expires_at: params.expiresAt, client_reference_id: params.client_reference_id,
        locale: 'ja',
        metadata: { ...params.metadata, app: 'doya-ai' },
        subscription_data: {
          metadata: { ...params.metadata, app: 'doya-ai' },
          ...(params.trialDays >= 1 ? { trial_period_days: params.trialDays } : {}),
        },
      }, { idempotencyKey: options.idempotencyKey })
      // A successful create is already an external write. An auxiliary read failure remains unknown.
      return exactCheckout(raw.id)
    },
    retrieveCheckout: exactCheckout,
  }
}

export function stripeModeFromSecret(secret: string | undefined): 'test' | 'live' {
  if (secret?.startsWith('sk_test_')) return 'test'
  if (secret?.startsWith('sk_live_')) return 'live'
  throw new LifecycleError('CHECKOUT_STRIPE_MODE_UNKNOWN', 503)
}
