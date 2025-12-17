import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const PLANS = {
  free: {
    name: 'フリープラン',
    description: '基本的なテンプレートが利用可能',
    price: 0,
    features: [
      '1日5回までの生成',
      '基本テンプレート利用可能',
      'テキスト生成のみ',
    ],
    dailyLimit: 5,
  },
  premium: {
    name: 'プレミアムプラン',
    description: '全機能が無制限で利用可能',
    price: 2980,
    priceId: process.env.STRIPE_PREMIUM_PRICE_ID,
    features: [
      '無制限の生成',
      '68種類の全テンプレート',
      'テキスト＆画像生成',
      'プレミアムテンプレート',
      '優先サポート',
    ],
    dailyLimit: -1, // 無制限
  },
}

export async function createCheckoutSession(userId: string, priceId: string) {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXTAUTH_URL}/dashboard?success=true`,
    cancel_url: `${process.env.NEXTAUTH_URL}/pricing?canceled=true`,
    metadata: {
      userId,
    },
  })

  return session
}

export async function createBillingPortalSession(customerId: string) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard`,
  })

  return session
}

