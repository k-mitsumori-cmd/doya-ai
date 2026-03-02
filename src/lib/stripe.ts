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

// ドヤバナーAIの価格ID（先に定義してSEOで参照できるようにする）
const BANNER_LIGHT_MONTHLY = process.env.STRIPE_PRICE_BANNER_LIGHT_MONTHLY || 'price_banner_light_monthly'
const BANNER_LIGHT_YEARLY = process.env.STRIPE_PRICE_BANNER_LIGHT_YEARLY || 'price_banner_light_yearly'
const BANNER_PRO_MONTHLY = process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY || 'price_banner_pro_monthly'
const BANNER_PRO_YEARLY = process.env.STRIPE_PRICE_BANNER_PRO_YEARLY || 'price_banner_pro_yearly'
const BANNER_ENTERPRISE_MONTHLY = process.env.STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY || 'price_banner_enterprise_monthly'
const BANNER_ENTERPRISE_YEARLY = process.env.STRIPE_PRICE_BANNER_ENTERPRISE_YEARLY || 'price_banner_enterprise_yearly'

export const STRIPE_PRICE_IDS = {
  // ドヤSEO（ドヤライティングAI）
  // ドヤバナーAIと完全に同じStripe価格を使用（同一商品として課金）
  seo: {
    // LIGHT: 月額¥2,980（ドヤバナーAIと共通）
    light: {
      monthly: process.env.STRIPE_PRICE_SEO_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_SEO_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    // PRO: 月額¥9,980（ドヤバナーAIと共通）
    pro: {
      monthly: process.env.STRIPE_PRICE_SEO_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_SEO_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    // ENTERPRISE: 月額¥49,980（ドヤバナーAIと共通）
    enterprise: {
      monthly: process.env.STRIPE_PRICE_SEO_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_SEO_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // ドヤバナーAI
  banner: {
    // basic/starter/business は旧プラン互換（既存契約のpriceIdを解決するために残す）
    basic: {
      monthly:
        process.env.STRIPE_PRICE_BANNER_BASIC_MONTHLY ||
        process.env.STRIPE_PRICE_BANNER_STARTER_MONTHLY || // 互換（旧starterを使っている環境）
        'price_banner_basic_monthly',
      yearly:
        process.env.STRIPE_PRICE_BANNER_BASIC_YEARLY ||
        process.env.STRIPE_PRICE_BANNER_STARTER_YEARLY || // 互換（旧starterを使っている環境）
        'price_banner_basic_yearly',
    },
    starter: {
      monthly: process.env.STRIPE_PRICE_BANNER_STARTER_MONTHLY || 'price_banner_starter_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_STARTER_YEARLY || 'price_banner_starter_yearly',
    },
    light: {
      monthly: process.env.STRIPE_PRICE_BANNER_LIGHT_MONTHLY || 'price_banner_light_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_LIGHT_YEARLY || 'price_banner_light_yearly',
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY || 'price_banner_pro_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_PRO_YEARLY || 'price_banner_pro_yearly',
    },
    business: {
      monthly: process.env.STRIPE_PRICE_BANNER_BUSINESS_MONTHLY || 'price_banner_business_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_BUSINESS_YEARLY || 'price_banner_business_yearly',
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY || 'price_banner_enterprise_monthly',
      yearly: process.env.STRIPE_PRICE_BANNER_ENTERPRISE_YEARLY || 'price_banner_enterprise_yearly',
    },
  },
  // ドヤコピーAI（統一課金: ドヤバナーAIと同じ価格ID）
  copy: {
    light: {
      monthly: process.env.STRIPE_PRICE_COPY_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_COPY_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_COPY_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_COPY_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_COPY_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_COPY_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // ドヤインタビューAI（統一課金: ドヤバナーAIと同じ価格ID）
  interview: {
    light: {
      monthly: process.env.STRIPE_PRICE_INTERVIEW_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INTERVIEW_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_INTERVIEW_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INTERVIEW_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_INTERVIEW_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_INTERVIEW_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // ドヤLP AI（統一課金: ドヤバナーAIと同じ価格ID）
  lp: {
    light: {
      monthly: process.env.STRIPE_PRICE_LP_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_LP_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_LP_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_LP_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_LP_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_LP_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // ドヤボイスAI（統一課金: ドヤバナーAIと同じ価格ID）
  voice: {
    light: {
      monthly: process.env.STRIPE_PRICE_VOICE_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_VOICE_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_VOICE_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_VOICE_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_VOICE_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_VOICE_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // ドヤムービーAI（統一課金: ドヤバナーAIと同じ価格ID）
  movie: {
    light: {
      monthly: process.env.STRIPE_PRICE_MOVIE_LIGHT_MONTHLY || BANNER_LIGHT_MONTHLY,
      yearly: process.env.STRIPE_PRICE_MOVIE_LIGHT_YEARLY || BANNER_LIGHT_YEARLY,
    },
    pro: {
      monthly: process.env.STRIPE_PRICE_MOVIE_PRO_MONTHLY || BANNER_PRO_MONTHLY,
      yearly: process.env.STRIPE_PRICE_MOVIE_PRO_YEARLY || BANNER_PRO_YEARLY,
    },
    enterprise: {
      monthly: process.env.STRIPE_PRICE_MOVIE_ENTERPRISE_MONTHLY || BANNER_ENTERPRISE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_MOVIE_ENTERPRISE_YEARLY || BANNER_ENTERPRISE_YEARLY,
    },
  },
  // セットプラン
  bundle: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_MONTHLY || 'price_bundle_monthly',
    yearly: process.env.STRIPE_PRICE_BUNDLE_YEARLY || 'price_bundle_yearly',
  },
}

// ========================================
// 価格ID ↔ プランID 変換（厳密マッピング）
// ========================================
export type PlanId = 'seo-light' | 'seo-pro' | 'seo-enterprise' | 'banner-light' | 'banner-basic' | 'banner-pro' | 'banner-enterprise' | 'interview-light' | 'interview-pro' | 'interview-enterprise' | 'copy-light' | 'copy-pro' | 'copy-enterprise' | 'lp-light' | 'lp-pro' | 'lp-enterprise' | 'voice-light' | 'voice-pro' | 'voice-enterprise' | 'movie-light' | 'movie-pro' | 'movie-enterprise' | 'bundle'
export type ServiceId = 'seo' | 'banner' | 'interview' | 'copy' | 'lp' | 'voice' | 'movie' | 'bundle'

export function getServiceIdFromPlanId(planId: PlanId): ServiceId {
  return (planId.split('-')[0] as ServiceId) || 'bundle'
}

export function getPlanIdFromStripePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null
  const entries: Array<[PlanId, { monthly: string; yearly: string }]> = [
    ['seo-light', STRIPE_PRICE_IDS.seo.light],
    ['seo-pro', STRIPE_PRICE_IDS.seo.pro],
    ['seo-enterprise', STRIPE_PRICE_IDS.seo.enterprise],
    ['banner-light', STRIPE_PRICE_IDS.banner.light],
    ['banner-basic', STRIPE_PRICE_IDS.banner.basic],
    ['banner-pro', STRIPE_PRICE_IDS.banner.pro],
    ['banner-enterprise', STRIPE_PRICE_IDS.banner.enterprise],
    ['interview-light', STRIPE_PRICE_IDS.interview.light],
    ['interview-pro', STRIPE_PRICE_IDS.interview.pro],
    ['interview-enterprise', STRIPE_PRICE_IDS.interview.enterprise],
    ['copy-light', STRIPE_PRICE_IDS.copy.light],
    ['copy-pro', STRIPE_PRICE_IDS.copy.pro],
    ['copy-enterprise', STRIPE_PRICE_IDS.copy.enterprise],
    ['lp-light', STRIPE_PRICE_IDS.lp.light],
    ['lp-pro', STRIPE_PRICE_IDS.lp.pro],
    ['lp-enterprise', STRIPE_PRICE_IDS.lp.enterprise],
    ['voice-light', STRIPE_PRICE_IDS.voice.light],
    ['voice-pro', STRIPE_PRICE_IDS.voice.pro],
    ['voice-enterprise', STRIPE_PRICE_IDS.voice.enterprise],
    ['movie-light', STRIPE_PRICE_IDS.movie.light],
    ['movie-pro', STRIPE_PRICE_IDS.movie.pro],
    ['movie-enterprise', STRIPE_PRICE_IDS.movie.enterprise],
    ['bundle', STRIPE_PRICE_IDS.bundle],
  ]
  for (const [planId, prices] of entries) {
    if (prices.monthly === priceId || prices.yearly === priceId) return planId
  }
  return null
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
  metadata,
  mode = 'subscription',
}: {
  priceId: string
  userId: string
  userEmail: string
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
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
      ...(metadata || {}),
    },
    // 日本語化
    locale: 'ja',
    // サブスクリプション設定
    subscription_data: mode === 'subscription' ? {
      metadata: {
        userId,
        ...(metadata || {}),
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
  const configurationId = await getOrCreateCustomerPortalConfigurationId()
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    // Stripeダッシュボードで作成した「カスタマーポータル設定」を指定すると、
    // 解約/プラン変更などの機能を確実に有効化できる
    configuration: configurationId || undefined,
    // 日本語化
    locale: 'ja',
  })

  return session
}

// ========================================
// Customer Portal 設定（解約/プラン変更を有効化）
// ========================================
// - 環境変数 STRIPE_PORTAL_CONFIGURATION_ID があればそれを使う
// - なければ Stripe 側に既存設定があれば再利用し、なければ作成する
//   ※ Serverlessでも過剰作成にならないよう「list→metadata一致」を優先する
async function getOrCreateCustomerPortalConfigurationId(): Promise<string | null> {
  const configured = String(process.env.STRIPE_PORTAL_CONFIGURATION_ID || '').trim()
  if (configured) return configured

  // 価格IDが未設定（ダミー）の環境では、作成してもプラン変更の候補が空になるため
  // 設定IDなしでセッションを作る（Stripe側のデフォルト設定に委ねる）
  const realPriceIds = collectRealPriceIds()
  if (realPriceIds.length === 0) return null

  try {
    const existing = await stripe.billingPortal.configurations.list({ limit: 100 })
    const found = existing.data.find((c) => (c.metadata as any)?.app === 'doya-ai')
    if (found?.id) return found.id

    const created = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: '契約内容の変更・解約はこちらから行えます。',
      },
      features: {
        // 支払い方法の更新
        payment_method_update: { enabled: true },
        // 請求履歴
        invoice_history: { enabled: true },
        // サブスクの解約（Stripe側で「解約」ボタンを表示）
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          // Stripeがサポートしている範囲で理由入力を有効化
          cancellation_reason: { enabled: true },
        },
        // サブスクのプラン変更（アップ/ダウン両方）
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price'],
          // 変更候補をこのアプリの価格に絞る（他商品を誤って表示しない）
          products: [
            {
              product: process.env.STRIPE_PRODUCT_BANNER_ID || undefined,
              prices: realPriceIds,
            },
          ].filter((p: any) => !!p.product || (p.prices?.length || 0) > 0),
        },
      },
      metadata: {
        app: 'doya-ai',
      },
    })

    return created?.id || null
  } catch {
    return null
  }
}

function collectRealPriceIds(): string[] {
  const vals = [
    // Light（統一）
    process.env.STRIPE_PRICE_BANNER_LIGHT_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_LIGHT_YEARLY,
    // SEO
    process.env.STRIPE_PRICE_SEO_PRO_MONTHLY,
    process.env.STRIPE_PRICE_SEO_PRO_YEARLY,
    process.env.STRIPE_PRICE_SEO_ENTERPRISE_MONTHLY,
    process.env.STRIPE_PRICE_SEO_ENTERPRISE_YEARLY,
    // Banner（新プラン）
    process.env.STRIPE_PRICE_BANNER_PRO_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_PRO_YEARLY,
    process.env.STRIPE_PRICE_BANNER_ENTERPRISE_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_ENTERPRISE_YEARLY,
    // Banner（互換）
    process.env.STRIPE_PRICE_BANNER_BASIC_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_BASIC_YEARLY,
    process.env.STRIPE_PRICE_BANNER_STARTER_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_STARTER_YEARLY,
    process.env.STRIPE_PRICE_BANNER_BUSINESS_MONTHLY,
    process.env.STRIPE_PRICE_BANNER_BUSINESS_YEARLY,
    // Copy
    process.env.STRIPE_PRICE_COPY_PRO_MONTHLY,
    process.env.STRIPE_PRICE_COPY_PRO_YEARLY,
    process.env.STRIPE_PRICE_COPY_ENTERPRISE_MONTHLY,
    process.env.STRIPE_PRICE_COPY_ENTERPRISE_YEARLY,
    // LP
    process.env.STRIPE_PRICE_LP_PRO_MONTHLY,
    process.env.STRIPE_PRICE_LP_PRO_YEARLY,
    process.env.STRIPE_PRICE_LP_ENTERPRISE_MONTHLY,
    process.env.STRIPE_PRICE_LP_ENTERPRISE_YEARLY,
    // Voice
    process.env.STRIPE_PRICE_VOICE_PRO_MONTHLY,
    process.env.STRIPE_PRICE_VOICE_PRO_YEARLY,
    process.env.STRIPE_PRICE_VOICE_ENTERPRISE_MONTHLY,
    process.env.STRIPE_PRICE_VOICE_ENTERPRISE_YEARLY,
    // Bundle
    process.env.STRIPE_PRICE_BUNDLE_MONTHLY,
    process.env.STRIPE_PRICE_BUNDLE_YEARLY,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .filter((v) => v.startsWith('price_'))

  // 重複排除
  return Array.from(new Set(vals))
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
