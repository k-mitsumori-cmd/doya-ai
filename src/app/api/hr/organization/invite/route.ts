export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { checkMemberLimit } from '@/lib/hr/billing'
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
    const { email, role } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'email is required' }, { status: 400 })
    }

    // メンバー数制限チェック
    const memberLimitError = await checkMemberLimit(ctx.organizationId)
    if (memberLimitError) {
      return NextResponse.json({ error: memberLimitError }, { status: 403 })
    }

    const emailNorm = email.trim().toLowerCase()
    const inviteRole = role || HrMemberRole.MEMBER

    const existingMember = await prisma.hrOrganizationMember.findFirst({
      where: {
        organizationId: ctx.organizationId,
        user: { email: emailNorm },
        status: 'ACTIVE',
      },
    })
    if (existingMember) {
      return NextResponse.json(
        { error: 'This user is already a member' },
        { status: 400 }
      )
    }

    const pendingInvite = await prisma.hrInvitation.findFirst({
      where: {
        organizationId: ctx.organizationId,
        email: emailNorm,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    })
    if (pendingInvite) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 400 }
      )
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    // 組織名を取得
    const org = await prisma.hrOrganization.findUnique({
      where: { id: ctx.organizationId },
      select: { name: true },
    })

    const invitation = await prisma.hrInvitation.create({
      data: {
        organizationId: ctx.organizationId,
        email: emailNorm,
        role: inviteRole,
        token,
        invitedBy: ctx.userId,
        status: 'PENDING',
        expiresAt,
      },
    })

    // 招待URL生成
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'
    const inviteUrl = `${baseUrl}/hr/invite/${token}`

    // 招待メール送信（非同期、エラーでも招待自体は成功）
    sendInvitationEmail({
      to: emailNorm,
      organizationName: org?.name || '組織',
      inviterName: user?.name || null,
      role: inviteRole,
      inviteUrl,
      expiresAt,
    }).catch((e) => {
      console.error('[HrInvite] Failed to send invitation email:', e)
    })

    // 監査ログ
    logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: user?.name || null,
      action: 'INVITE_SENT',
      target: 'invitation',
      targetId: invitation.id,
      details: { email: emailNorm, role: inviteRole },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
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
    return NextResponse.json(
      { error: e?.message || 'Failed to create invitation' },
      { status: 500 }
    )
  }
}
