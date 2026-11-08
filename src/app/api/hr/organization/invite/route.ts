import { privateApiJson } from '@/lib/private-api-response'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { checkMemberLimit, getOrgPlan, getOrgPlanLimits } from '@/lib/hr/billing'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { withToolSeatAdmission, ToolSeatAdmissionError, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import { sendInvitationEmail } from '@/lib/hr/email'
import { logAudit } from '@/lib/hr/audit'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const ctx = await getHrContext()
    if (!ctx) {
      return privateApiJson({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return privateApiJson({ error: 'この操作に必要な権限がありません。組織の管理者にご相談ください。' }, { status: 403 })
    }

    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return privateApiJson({ error: '招待する相手のメールアドレスを入力して、もう一度お試しください。' }, { status: 400 })
    }
    const emailNorm = email.trim().toLowerCase()
    if (emailNorm.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return privateApiJson({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
    }

    // メンバー数制限チェック
    const memberLimitError = await checkMemberLimit(ctx.organizationId)
    if (memberLimitError) {
      const plan = await getOrgPlan(ctx.organizationId)
      const canUpgrade = !['PRO', 'BUNDLE', 'ENTERPRISE'].includes(plan.toUpperCase())
      return privateApiJson({
        error: memberLimitError,
        code: 'HR_ORG_MEMBER_LIMIT',
        canManageBilling: ctx.role === HrMemberRole.OWNER,
        ...(canUpgrade ? { upgradeUrl: '/hr/pricing' } : { contactUrl: 'https://doyamarke.surisuta.jp/contact' }),
      }, { status: 403 })
    }

    // 画面はメンバー招待のみ。リクエスト本文から管理者・オーナー権限を指定させない。
    const inviteRole = HrMemberRole.MEMBER

    const token = randomBytes(32).toString('hex')
    // Recipient IDs are lock hints, never authority or an invitation claim.
    // Current company and domain roles are checked before creating a reservation.
    const recipients = await prisma.user.findMany({ where: { email: { equals: emailNorm, mode: 'insensitive' } }, select: { id: true }, take: 2 })
    if (recipients.length > 1) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
    const result = await withToolSeatAdmission({ tool: 'hr', organizationId: ctx.organizationId, actorUserId: ctx.userId, additionalUserIds: recipients.map(recipient => recipient.id) }, async tx => {
      const ceiling = await ceilToolRole({ tool: 'hr', organizationId: ctx.organizationId, userId: ctx.userId, toolRole: HrMemberRole.OWNER }, tx)
      const organizations = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "hr_organizations" WHERE id = ${ctx.organizationId} FOR UPDATE`
      if (organizations.length === 0) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
      const actor = await tx.$queryRaw<{ id: string; role: string }[]>`SELECT id, role FROM hr_organization_members
        WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId}
        AND "userId" = ${ctx.userId} AND status = 'ACTIVE' AND role IN ('OWNER', 'ADMIN') FOR UPDATE`
      // 会社の役割の上限（ctx の役割）より上には上げない
      const currentRole = actor.length && ceiling ? lowerToolRole('hr', actor[0].role, ceiling) : null
      const actorRole = currentRole ? lowerToolRole('hr', currentRole, ctx.role) : null
      if (actorRole !== HrMemberRole.OWNER && actorRole !== HrMemberRole.ADMIN) throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
      return { role: actorRole, value: undefined }
    }, async tx => {
      const currentRecipients = await tx.user.findMany({ where: { email: { equals: emailNorm, mode: 'insensitive' } }, select: { id: true }, take: 2 })
      if (currentRecipients.length !== recipients.length || currentRecipients.some(recipient => !recipients.some(hint => hint.id === recipient.id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')

      const existingMember = await tx.hrOrganizationMember.findFirst({
        where: { organizationId: ctx.organizationId, user: { email: emailNorm }, status: 'ACTIVE' },
      })
      if (existingMember) return { status: 400 as const, error: 'このユーザーは既にメンバーです' }

      const pendingInvite = await tx.hrInvitation.findFirst({
        where: { organizationId: ctx.organizationId, email: emailNorm, status: 'PENDING', expiresAt: { gt: new Date() } },
      })
      if (pendingInvite && pendingInvite.expiresAt.getTime() > Date.now()) return { status: 400 as const, error: 'このメールアドレスには有効な招待が既にあります' }

      const organization = await tx.hrOrganization.findUnique({
        where: { id: ctx.organizationId }, select: { name: true },
      })
      // Recheck the existing HR service limit inside the locked organization.
      const currentPlan = await getOrgPlan(ctx.organizationId, tx), limit = getOrgPlanLimits(currentPlan).maxMembers
      if (process.env.DOYA_DISABLE_LIMITS !== '1' && limit >= 0 && await tx.hrOrganizationMember.count({ where: { organizationId: ctx.organizationId, status: 'ACTIVE' } }) >= limit) return { status: 403 as const, error: 'メンバー数の上限に達しています', code: 'HR_ORG_MEMBER_LIMIT' }
      const invitation = await tx.hrInvitation.create({
        data: { organizationId: ctx.organizationId, email: emailNorm, role: inviteRole, token,
          invitedBy: ctx.userId, status: 'PENDING', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      })
      return { invitation, organizationName: organization?.name || '組織' }
    })
    if ('error' in result) return privateApiJson({ error: result.error }, { status: result.status })
    const { invitation, organizationName } = result

    // 招待URL生成
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'
    const inviteUrl = `${baseUrl}/hr/invite/${token}`

    let emailSent = false
    try {
      emailSent = await sendInvitationEmail({
        to: emailNorm,
        organizationName,
        inviterName: user?.name || null,
        role: inviteRole,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      })
    } catch {
      console.error('[HrInvite] Failed to send invitation email')
    }

    // 監査ログ
    await logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: user?.name || null,
      action: emailSent ? 'INVITE_SENT' : 'INVITE_CREATED',
      target: 'invitation',
      targetId: invitation.id,
      details: { email: emailNorm, role: inviteRole, emailSent },
    })

    return privateApiJson({
      success: true,
      emailSent,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      inviteUrl,
    })
  } catch (e: any) {
    const seatFailure = toolSeatAdmissionFailure(e)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    console.error('[hr/organization/invite] unexpected error')
    return privateApiJson(
      { error: '招待を作成できませんでした。時間をおいて、もう一度お試しください。' },
      { status: 500 }
    )
  }
}
