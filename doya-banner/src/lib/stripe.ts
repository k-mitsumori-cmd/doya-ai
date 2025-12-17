import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
})

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID!

// プラン定義（将来拡張用）
export const PLANS = {
  FREE: {
    id: 'free',
    name: '無料プラン',
    price: 0,
    dailyLimit: 1, // 1日1枚
  },
  PRO: {
    id: 'pro',
    name: 'プロプラン',
    price: 9980,
    dailyLimit: null, // 無制限（将来上限追加可能）
  },
} as const

export type PlanType = keyof typeof PLANS

