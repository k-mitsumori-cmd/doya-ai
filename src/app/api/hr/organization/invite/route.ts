export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { checkMemberLimit, getOrgPlan } from '@/lib/hr/billing'
import { sendInvitationEmail } from '@/lib/hr/email'
import { logAudit } from '@/lib/hr/audit'
import { randomBytes } from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any

    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }
    const emailNorm = email.trim().toLowerCase()
    if (emailNorm.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'メールアドレスの形式をご確認ください' }, { status: 400 })
    }

    // メンバー数制限チェック
    const memberLimitError = await checkMemberLimit(ctx.organizationId)
    if (memberLimitError) {
      const plan = await getOrgPlan(ctx.organizationId)
      const canUpgrade = !['PRO', 'BUNDLE', 'ENTERPRISE'].includes(plan.toUpperCase())
      return NextResponse.json({
        error: memberLimitError,
        code: 'HR_ORG_MEMBER_LIMIT',
        canManageBilling: ctx.role === HrMemberRole.OWNER,
        ...(canUpgrade ? { upgradeUrl: '/hr/pricing' } : { contactUrl: 'https://doyamarke.surisuta.jp/contact' }),
      }, { status: 403 })
    }

    // 画面はメンバー招待のみ。リクエスト本文から管理者・オーナー権限を指定させない。
    const inviteRole = HrMemberRole.MEMBER

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const result = await prisma.$transaction(async (tx) => {
      const organizations = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "hr_organizations" WHERE id = ${ctx.organizationId} FOR UPDATE`
      if (organizations.length === 0) return { status: 404 as const, error: '組織が見つかりません' }

      const existingMember = await tx.hrOrganizationMember.findFirst({
        where: { organizationId: ctx.organizationId, user: { email: emailNorm }, status: 'ACTIVE' },
      })
      if (existingMember) return { status: 400 as const, error: 'このユーザーは既にメンバーです' }

      const pendingInvite = await tx.hrInvitation.findFirst({
        where: { organizationId: ctx.organizationId, email: emailNorm, status: 'PENDING', expiresAt: { gt: new Date() } },
      })
      if (pendingInvite) return { status: 400 as const, error: 'このメールアドレスには有効な招待が既にあります' }

      const organization = await tx.hrOrganization.findUnique({
        where: { id: ctx.organizationId }, select: { name: true },
      })
      const invitation = await tx.hrInvitation.create({
        data: { organizationId: ctx.organizationId, email: emailNorm, role: inviteRole, token,
          invitedBy: ctx.userId, status: 'PENDING', expiresAt },
      })
      return { invitation, organizationName: organization?.name || '組織' }
    })
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
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
        expiresAt,
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

    return NextResponse.json({
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
    console.error('[hr/organization/invite] unexpected error')
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
