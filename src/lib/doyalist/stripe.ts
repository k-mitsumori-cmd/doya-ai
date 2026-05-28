import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

export const DOYALIST_PLANS = {
  free: {
    name: 'フリー',
    priceId: null,
    monthlyProjects: 3,
    companiesPerProject: 20,
    features: ['月3リストまで', '各リスト20社まで', '法人番号検索のみ'],
  },
  light: {
    name: 'ライト',
    priceId: process.env.STRIPE_DOYALIST_LIGHT_PRICE_ID || 'price_doyalist_light',
    monthlyProjects: 10,
    companiesPerProject: 50,
    features: ['月10リストまで', '各リスト50社まで', 'AI分析・スコアリング', 'gBizINFO連携'],
  },
  pro: {
    name: 'プロ',
    priceId: process.env.STRIPE_DOYALIST_PRO_PRICE_ID || 'price_doyalist_pro',
    monthlyProjects: 30,
    companiesPerProject: 100,
    features: ['月30リストまで', '各リスト100社まで', 'AI分析・スコアリング', 'gBizINFO連携', 'アプローチ文面自動生成', 'Webスクレイピング', 'CSVエクスポート'],
  },
  enterprise: {
    name: 'エンタープライズ',
    priceId: process.env.STRIPE_DOYALIST_ENTERPRISE_PRICE_ID || 'price_doyalist_enterprise',
    monthlyProjects: 200,
    companiesPerProject: 500,
    features: ['月200リストまで', '各リスト500社まで', 'AI分析・スコアリング', 'gBizINFO連携', 'アプローチ文面自動生成', 'Webスクレイピング', 'CSVエクスポート', 'API連携', '優先サポート'],
  },
} as const

export type DoyalistPlanId = keyof typeof DOYALIST_PLANS

export async function createCheckoutSession(
  userId: string,
  planId: DoyalistPlanId,
  customerEmail: string
): Promise<string> {
  const plan = DOYALIST_PLANS[planId]
  if (!plan.priceId) throw new Error('Free plan does not require checkout')

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: customerEmail,
    line_items: [{ price: plan.priceId, quantity: 1 }],
    success_url: `${process.env.NEXTAUTH_URL}/doyalist/settings?upgrade=success`,
    cancel_url: `${process.env.NEXTAUTH_URL}/doyalist/pricing?upgrade=cancelled`,
    metadata: { userId, service: 'doyalist', planId },
  })

  return session.url!
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  })
}
