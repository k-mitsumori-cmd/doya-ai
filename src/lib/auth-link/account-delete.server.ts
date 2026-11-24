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
        // ツール別のメンバー表（userId は文字列の列。外部キーが無い表も、Cascade でも User の行は残るので）を無効にする。物理削除はしない。
        // 90日後の削除は別設計（data-retention-90d.md）。ここは、退会した人が組織のメンバー一覧や権限判定に ACTIVE のまま残らないようにするだけ。
        const off = { status: 'INACTIVE' }
        const notOff = { userId, NOT: { status: 'INACTIVE' } }
        await tx.hrOrganizationMember.updateMany({ where: notOff, data: off })
        await tx.kintaiMember.updateMany({ where: notOff, data: off })
        await tx.sfaMember.updateMany({ where: notOff, data: off })
        await tx.shodanMember.updateMany({ where: notOff, data: off })
        await tx.aioMember.updateMany({ where: notOff, data: off })
        await tx.mensetsuMember.updateMany({ where: notOff, data: off })
        await tx.quoteMember.updateMany({ where: notOff, data: off })
        await tx.aishodanMember.updateMany({ where: notOff, data: off })
        await tx.incomeMember.updateMany({ where: notOff, data: off })
        await tx.expenseMember.updateMany({ where: notOff, data: off })
        await tx.promaneMember.updateMany({ where: { userId, isActive: true }, data: { isActive: false } })
        await tx.user.update({
          where: { id: userId },
          data: { email: anonymizedEmail(userId), name: null, image: null, emailNormalized: null, emailVerified: null, deletedAt: now, anonymizedAt: now },
        })
      })
    },
  }
}
