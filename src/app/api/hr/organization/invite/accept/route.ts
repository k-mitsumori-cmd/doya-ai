export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/hr/audit'
import { getOrgPlan, getOrgPlanLimits } from '@/lib/hr/billing'
import { withHrMembershipWrite, HrMembershipChanged } from '@/lib/hr/membership-write'
import { LifecycleError } from '@/lib/account-lifecycle/state'
import { privateApiJson } from '@/lib/private-api-response'

class InviteNoLongerAvailableError extends Error {}
class InviteExpiredError extends Error {}

// POST /api/hr/organization/invite/accept
// 招待を受諾してメンバーとして参加する
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return privateApiJson({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try { body = await req.json() } catch {
      return privateApiJson({ error: '招待情報の形式が正しくありません', code: 'INVALID_INVITATION_INPUT' }, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return privateApiJson({ error: '招待情報の形式が正しくありません', code: 'INVALID_INVITATION_INPUT' }, { status: 400 })
    const { token } = body as { token?: unknown }
    if (typeof token !== 'string' || !token.trim() || token.length > 256) {
      return privateApiJson({ error: '有効な招待トークンが必要です', code: 'INVALID_INVITATION_INPUT' }, { status: 400 })
    }

    // 招待トークンを検索
    const invitation = await prisma.hrInvitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
      },
    })

    if (!invitation) {
      return privateApiJson({ error: '招待が見つかりません' }, { status: 404 })
    }

    const account = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    const accountEmail = account?.email?.trim().toLowerCase()
    if (!accountEmail || accountEmail !== invitation.email.trim().toLowerCase()) {
      return privateApiJson({ error: '招待先のメールアドレスでログインしてください', code: 'INVITE_EMAIL_MISMATCH' }, { status: 403 })
    }

    if (invitation.role !== 'MEMBER') {
      return privateApiJson({ error: 'この招待の権限を確認できません。管理者に再招待を依頼してください' }, { status: 403 })
    }

    if (invitation.status === 'EXPIRED') {
      return privateApiJson({ error: 'この招待は有効期限が切れています', code: 'INVITE_EXPIRED' }, { status: 410 })
    }
    if (invitation.status !== 'PENDING') {
      return privateApiJson({ error: 'この招待は既に使用済み、またはキャンセルされています', code: 'INVITE_UNAVAILABLE' }, { status: 409 })
    }

    // 既にこの組織のメンバーか確認
    const existingMember = await prisma.hrOrganizationMember.findFirst({
      where: {
        organizationId: invitation.organizationId,
        userId,
        status: 'ACTIVE',
      },
    })
    if (existingMember) {
      return privateApiJson(
        { error: '既にこの組織のメンバーです' },
        { status: 400 }
      )
    }

    // メンバーとして追加 & 招待ステータスを更新
    const admission = await withHrMembershipWrite({ organizationId: invitation.organizationId, actorUserId: userId,
      knownUserIds: [userId], run: async (tx) => {
      await tx.$queryRaw`SELECT id FROM hr_invitations WHERE id = ${invitation.id} FOR UPDATE`
      const currentInvite = await tx.hrInvitation.findUnique({ where: { id: invitation.id } })
      const currentAccount = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (currentAccount?.email?.trim().toLowerCase() !== accountEmail) throw new InviteNoLongerAvailableError()
      if (!currentInvite || currentInvite.token !== token || currentInvite.organizationId !== invitation.organizationId || currentInvite.role !== 'MEMBER' || currentInvite.email.trim().toLowerCase() !== accountEmail) throw new InviteNoLongerAvailableError()
      if (currentInvite.status === 'EXPIRED') throw new InviteExpiredError()
      if (currentInvite.status === 'PENDING' && currentInvite.expiresAt.getTime() <= Date.now()) {
        await tx.hrInvitation.updateMany({ where: { id: invitation.id, status: 'PENDING', expiresAt: { lte: new Date() } },
          data: { status: 'EXPIRED' } })
        return { expired: true as const }
      }
      if (currentInvite.status !== 'PENDING') throw new InviteNoLongerAvailableError()
      const plan = await getOrgPlan(invitation.organizationId, tx)
      const limit = getOrgPlanLimits(plan).maxMembers
      if (process.env.DOYA_DISABLE_LIMITS !== '1' && limit >= 0) {
        const activeMembers = await tx.hrOrganizationMember.count({
          where: { organizationId: invitation.organizationId, status: 'ACTIVE' },
        })
        if (currentInvite.expiresAt.getTime() <= Date.now()) throw new InviteExpiredError()
        if (activeMembers >= limit) return { allowed: false as const, plan, limit }
      }
      const acceptedAt = new Date()
      if (currentInvite.expiresAt.getTime() <= acceptedAt.getTime()) throw new InviteExpiredError()
      const claimed = await tx.hrInvitation.updateMany({
        where: { id: invitation.id, token, organizationId: invitation.organizationId, role: 'MEMBER', email: currentInvite.email, status: 'PENDING', expiresAt: { gt: acceptedAt } },
        data: { status: 'ACCEPTED', acceptedAt },
      })
      if (claimed.count !== 1) {
        const current = await tx.hrInvitation.findUnique({ where: { id: invitation.id } })
        if (current?.status === 'EXPIRED' || (current?.status === 'PENDING' && current.expiresAt.getTime() <= Date.now())) throw new InviteExpiredError()
        throw new InviteNoLongerAvailableError()
      }
      const member = await tx.hrOrganizationMember.create({
        data: {
          organizationId: invitation.organizationId,
          userId,
          role: invitation.role,
          status: 'ACTIVE',
          invitedEmail: invitation.email,
          invitedAt: invitation.createdAt,
          acceptedAt,
        },
      })
      if (currentInvite.expiresAt.getTime() <= Date.now()) throw new InviteExpiredError()
      return { allowed: true as const, member }
    } })
    if ('expired' in admission) return privateApiJson({ error: 'この招待は有効期限が切れています', code: 'INVITE_EXPIRED' }, { status: 410 })
    if (!admission.allowed) {
      return privateApiJson({
        error: `メンバー数の上限（${admission.limit}名）に達しています。組織の管理者にプラン変更を依頼してください。`,
        code: 'HR_ORG_MEMBER_LIMIT',
      }, { status: 403 })
    }
    const member = admission.member

    // 監査ログ
    logAudit({
      organizationId: invitation.organizationId,
      userId,
      userName: session?.user?.name || null,
      action: 'INVITE_ACCEPTED',
      target: 'member',
      targetId: member.id,
      details: {
        email: invitation.email,
        role: invitation.role,
      },
    }).catch(() => {})

    return privateApiJson({
      success: true,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
      },
      role: invitation.role,
    })
  } catch (e: any) {
    if (e instanceof LifecycleError) return privateApiJson({ error: e.message, code: e.code }, { status: e.status })
    if (e instanceof HrMembershipChanged) return privateApiJson({ error: '招待先または組織の状態が変わりました。再確認してください' }, { status: 409 })
    if (e instanceof InviteExpiredError) {
      return privateApiJson({ error: 'この招待は有効期限が切れています', code: 'INVITE_EXPIRED' }, { status: 410 })
    }
    if (e instanceof InviteNoLongerAvailableError) {
      return privateApiJson({ error: 'この招待は使用済み、キャンセル済み、または確認できません。招待の状態を再確認してください。', code: 'INVITE_UNAVAILABLE' }, { status: 409 })
    }
    if (e?.code === 'P2002') {
      return privateApiJson({ error: '既にこの組織のメンバーです' }, { status: 409 })
    }
    console.error('[hr/organization/invite/accept]')
    return privateApiJson(
      { error: '招待を受諾できませんでした' },
      { status: 500 }
    )
  }
}
