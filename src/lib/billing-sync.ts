import { prisma, withRetry } from '@/lib/prisma'
import { ALL_SERVICE_IDS } from '@/lib/stripe'
import { MANUAL_GRANTS_SETTING_KEY, parseManualGrantEmails } from '@/lib/billing-manual-grants'

const PLAN_RANK: Record<string, number> = { FREE: 0, LIGHT: 1, PRO: 2, BUNDLE: 3, ENTERPRISE: 4 }

type BillingSyncInput = {
  userId: string
  plan: string
  stripeCustomerId?: string | null
  stripeSubscriptionId?: string | null
  stripePriceId?: string | null
  stripeCurrentPeriodEnd?: Date | null
  /** 明示的な管理者のプラン変更のみ false。Stripe起点の同期は付与済み権利を保護。 */
  preserveManualGrant?: boolean
  role?: string
}

/**
 * User・全サービス・所有HR組織を一括反映する。
 * 途中失敗は全件ロールバックし、呼び出し元へ伝える。利用カウンタは既存値を保持。
 * 外部API/通知はトランザクションに含めない。
 */
export async function syncUnifiedBilling(input: BillingSyncInput) {
  if (!Object.hasOwn(PLAN_RANK, input.plan)) throw new Error('Invalid billing plan')
  return withRetry(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const current = await tx.user.findUniqueOrThrow({
            where: { id: input.userId }, select: { email: true, plan: true },
          })
          let userPlan = input.plan
          if (input.preserveManualGrant !== false) {
            // キャッシュ/読み取り失敗を「付与なし」と解釈すると誤降格するため、同じTXで読む。
            const grants = await tx.systemSetting.findUnique({ where: { key: MANUAL_GRANTS_SETTING_KEY } })
            const emails = new Set([
              ...parseManualGrantEmails(process.env.BILLING_MANUAL_GRANT_EMAILS),
              ...parseManualGrantEmails(grants?.value),
            ].map((email) => email.trim().toLowerCase()))
            if (current.email && emails.has(current.email.trim().toLowerCase()) &&
                (PLAN_RANK[current.plan] ?? -1) > PLAN_RANK[userPlan]) userPlan = current.plan
          }
          const servicePlan = userPlan === 'BUNDLE' ? 'PRO' : userPlan
          const stripeData = {
            ...(input.stripeSubscriptionId !== undefined && { stripeSubscriptionId: input.stripeSubscriptionId }),
            ...(input.stripePriceId !== undefined && { stripePriceId: input.stripePriceId }),
            ...(input.stripeCurrentPeriodEnd !== undefined && { stripeCurrentPeriodEnd: input.stripeCurrentPeriodEnd }),
          }
          await tx.user.update({ where: { id: input.userId }, data: {
            plan: userPlan, ...stripeData,
            ...(input.stripeCustomerId !== undefined && { stripeCustomerId: input.stripeCustomerId }),
            ...(input.role !== undefined && { role: input.role }),
          } })
          // writing等の旧IDも同期し、解約後に旧行から有料権利が復活しないようにする。
          await tx.userServiceSubscription.updateMany({
            where: { userId: input.userId }, data: { plan: servicePlan, ...stripeData },
          })
          for (const serviceId of ALL_SERVICE_IDS) {
            await tx.userServiceSubscription.upsert({
              where: { userId_serviceId: { userId: input.userId, serviceId } },
              create: { userId: input.userId, serviceId, plan: servicePlan, ...stripeData },
              update: { plan: servicePlan, ...stripeData },
            })
          }
          const ownerships = await tx.hrOrganizationMember.findMany({
            where: { userId: input.userId, role: 'OWNER', status: 'ACTIVE' }, select: { organizationId: true },
          })
          if (ownerships.length) await tx.hrOrganization.updateMany({
            where: { id: { in: ownerships.map((m) => m.organizationId) } },
            data: { plan: servicePlan === 'LIGHT' ? 'STARTER' : servicePlan },
          })
          return { userPlan, servicePlan, previousPlan: current.plan }
        }, { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 30_000 })
      } catch (error) {
        if ((error as { code?: string })?.code !== 'P2034' || attempt >= 2) throw error
      }
    }
  })
}
