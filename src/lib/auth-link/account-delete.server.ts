import type { PrismaClient } from '@prisma/client'
import { anonymizedEmail, type DeleteRepo } from './account-delete'

export function createPrismaDeleteRepo(prisma: PrismaClient): DeleteRepo {
  return {
    async getDeletionFacts(userId) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, plan: true, deletedAt: true, stripeSubscriptionId: true } })
      if (!user) return { user: null, liveSubscriptions: 0, nagusameLive: false, ownsCompanyWithOtherMembers: false }
      const nag = await prisma.mitsuboshiNagusameSubscription.findUnique({ where: { userId }, select: { plan: true, stripeSubId: true, currentPeriodEnd: true } })
      const now = new Date()
      const nagusameLive = Boolean(nag && (nag.plan !== 'free' || (nag.stripeSubId && (!nag.currentPeriodEnd || nag.currentPeriodEnd > now))))
      const liveSubscriptions = await prisma.subscription.count({ where: { userId, status: { in: ['active', 'trialing', 'past_due'] } } })
      const company = await prisma.accountCompany.findUnique({ where: { userId }, select: { id: true } })
      const others = company ? await prisma.accountCompanyMember.count({ where: { companyId: company.id, status: 'active', NOT: { userId } } }) : 0
      return { user, liveSubscriptions, nagusameLive, ownsCompanyWithOtherMembers: others > 0 }
    },
    async anonymize(userId, now) {
      await prisma.$transaction(async (tx) => {
        await tx.session.deleteMany({ where: { userId } })
        await tx.account.deleteMany({ where: { userId } })
        await tx.appDevice.deleteMany({ where: { userId } })
        await tx.accountLinkRequest.deleteMany({ where: { userId } })
        // ドリップのメールを、実在しない宛先に送り続けないため
        await tx.dripEnrollment.updateMany({ where: { userId, status: 'active' }, data: { status: 'cancelled' } })
        // 自分が持ち主の会社の、招待中の行を取り消す（招待のメールのリンクを、退会のあとに使えなくする）。会社の行は残す
        const own = await tx.accountCompany.findUnique({ where: { userId }, select: { id: true } })
        if (own) await tx.accountCompanyMember.deleteMany({ where: { companyId: own.id, status: 'invited' } })
        // 参加している会社の名簿から外し、メールを匿名にする
        await tx.accountCompanyMember.updateMany({
          where: { userId },
          data: { status: 'removed', removedAt: now, email: anonymizedEmail(userId), inviteToken: null },
        })
        await tx.user.update({
          where: { id: userId },
          data: { email: anonymizedEmail(userId), name: null, image: null, emailNormalized: null, emailVerified: null, deletedAt: now, anonymizedAt: now },
        })
      })
    },
  }
}
