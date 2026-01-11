import { prisma } from '@/lib/prisma'

export type UnifiedPlan = 'FREE' | 'PRO' | 'ENTERPRISE'

export function normalizeUnifiedPlan(raw: any): UnifiedPlan {
  const p = String(raw || '').toUpperCase().trim()
  if (p === 'ENTERPRISE') return 'ENTERPRISE'
  if (p === 'PRO') return 'PRO'
  // 旧互換: STARTER/BUSINESS/BUNDLE/BASIC は PRO 扱い
  if (p === 'STARTER' || p === 'BUSINESS' || p === 'BUNDLE' || p === 'BASIC') return 'PRO'
  return 'FREE'
}

export function maxPlan(a: UnifiedPlan, b: UnifiedPlan): UnifiedPlan {
  const w = (x: UnifiedPlan) => (x === 'ENTERPRISE' ? 2 : x === 'PRO' ? 1 : 0)
  return w(a) >= w(b) ? a : b
}

/**
 * Complete Pack として、全サービスのプランを単一に揃える。
 * - 主要サービス: banner / writing / persona
 * - 互換: 旧 'seo' が存在する場合も同じプランに揃える（作成はしない）
 */
export async function syncUserPlanAcrossServices(args: {
  userId: string
  plan: any
  // Stripe由来の情報（ユーザーレコード側に保存）
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  stripeCurrentPeriodEnd?: Date | null
}) {
  const unified = normalizeUnifiedPlan(args.plan)

  // ユーザー本体のプラン（単一の真実）を更新
  await prisma.user.update({
    where: { id: args.userId },
    data: {
      plan: unified,
      ...(args.stripeSubscriptionId !== undefined ? { stripeSubscriptionId: args.stripeSubscriptionId } : {}),
      ...(args.stripePriceId !== undefined ? { stripePriceId: args.stripePriceId } : {}),
      ...(args.stripeCurrentPeriodEnd !== undefined ? { stripeCurrentPeriodEnd: args.stripeCurrentPeriodEnd } : {}),
    },
  })

  // 必須の3サービスは必ず upsert（存在しないユーザーでも作る）
  const primaryServiceIds = ['banner', 'writing', 'persona'] as const
  await Promise.all(
    primaryServiceIds.map((serviceId) =>
      prisma.userServiceSubscription.upsert({
        where: { userId_serviceId: { userId: args.userId, serviceId } },
        create: {
          userId: args.userId,
          serviceId,
          plan: unified,
          dailyUsage: 0,
          monthlyUsage: 0,
          lastUsageReset: new Date(),
        },
        update: {
          plan: unified,
        },
      })
    )
  )

  // 旧 'seo' が存在する場合は更新（作成はしない）
  await prisma.userServiceSubscription
    .updateMany({
      where: { userId: args.userId, serviceId: 'seo' },
      data: { plan: unified },
    })
    .catch(() => {})
}





