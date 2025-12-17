import Stripe from 'stripe'

// ========================================
// Stripe設定
// ========================================

// Stripeインスタンス（サーバーサイド用）
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

// 公開キー（クライアントサイド用）
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
}

// ========================================
// 価格ID設定
// ========================================
// Stripeダッシュボードで作成した価格IDをここに設定
// 本番環境では環境変数で管理することを推奨

export const STRIPE_PRICE_IDS = {
  // カンタンドヤAI
  kantan: {
    starter: {
      monthly: process.env.STRIPE_PRICE_KANTAN_STARTER_MONTHLY || 'price_kantan_starter_monthly',
      yearly: process.env.STRIPE_PRICE_KANTAN_STARTER_YEARLY || 'price_kantan_starter_yearly',
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_KANTAN_PRO_MONTHLY || 'price_kantan_pro_monthly',
      yearly: process.env.STRIPE_PRICE_KANTAN_PRO_YEARLY || 'price_kantan_pro_yearly',
    },
  },
  // ドヤバナーAI
  banner: {
    starter: {
      monthly: process.env.STRIPE_PRICE_BANNER_STARTER_MONTHLY || 'price_banner_starter_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_STARTER_YEARLY || 'price_banner_starter_yearly',
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY || 'price_banner_pro_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_PRO_YEARLY || 'price_banner_pro_yearly',
    },
    business: {
      monthly: process.env.STRIPE_PRICE_BANNER_BUSINESS_MONTHLY || 'price_banner_business_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_BUSINESS_YEARLY || 'price_banner_business_yearly',
    },
  },
  // セットプラン
  bundle: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_MONTHLY || 'price_bundle_monthly',
    yearly: process.env.STRIPE_PRICE_BUNDLE_YEARLY || 'price_bundle_yearly',
  },
}

// ========================================
// Checkout Session作成
// ========================================
export async function createCheckoutSession({
  priceId,
  userId,
  userEmail,
  successUrl,
  cancelUrl,
  mode = 'subscription',
}: {
  priceId: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
  mode?: 'subscription' | 'payment'
}) {
  const session = await stripe.checkout.sessions.create({
    mode,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: userEmail,
    client_reference_id: userId,
    metadata: {
      userId,
    },
    // 日本語化
    locale: 'ja',
    // サブスクリプション設定
    subscription_data: mode === 'subscription' ? {
      metadata: {
        userId,
      },
    } : undefined,
    // 請求先住所を収集しない（シンプル化）
    billing_address_collection: 'auto',
    // 税金自動計算（日本向け）
    automatic_tax: {
      enabled: false, // 税込み価格のため無効
    },
  })

  return session
}

// ========================================
// カスタマーポータル
// ========================================
export async function createCustomerPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

// ========================================
// サブスクリプション管理
// ========================================
export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId)
}

export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}

export async function resumeSubscription(subscriptionId: string) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  })
}

// ========================================
// カスタマー取得・作成
// ========================================
export async function getOrCreateCustomer({
  email,
  name,
  userId,
}: {
  email: string
  name?: string
  userId: string
}) {
  // 既存のカスタマーを検索
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  })

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0]
  }

  // 新規作成
  return await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  })
}

// ========================================
// Webhook署名検証
// ========================================
export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  webhookSecret: string
) {
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret)
}
