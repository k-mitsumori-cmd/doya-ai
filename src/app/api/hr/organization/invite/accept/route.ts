export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/hr/audit'

class InviteNoLongerAvailableError extends Error {}

// POST /api/hr/organization/invite/accept
// 招待を受諾してメンバーとして参加する
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { token } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'token is required' }, { status: 400 })
    }

    // 招待トークンを検索
    const invitation = await prisma.hrInvitation.findUnique({
      where: { token },
      include: {
        organization: { select: { id: true, name: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '招待が見つかりません' }, { status: 404 })
    }

    const account = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    if (!account?.email || account.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      return NextResponse.json({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
    }

    if (invitation.role !== 'MEMBER') {
      return NextResponse.json({ error: 'この招待の権限を確認できません。管理者に再招待を依頼してください' }, { status: 403 })
    }

    if (invitation.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'この招待は既に使用済み、またはキャンセルされています' },
        { status: 400 }
      )
    }

    if (new Date() > invitation.expiresAt) {
      // 期限切れの場合はステータスを更新
      await prisma.hrInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED' },
      })
      return NextResponse.json(
        { error: 'この招待は有効期限が切れています' },
        { status: 400 }
      )
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
      return NextResponse.json(
        { error: '既にこの組織のメンバーです' },
        { status: 400 }
      )
    }

    // メンバーとして追加 & 招待ステータスを更新
    const member = await prisma.$transaction(async (tx) => {
      const acceptedAt = new Date()
      const claimed = await tx.hrInvitation.updateMany({
        where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: acceptedAt } },
        data: { status: 'ACCEPTED', acceptedAt },
      })
      if (claimed.count !== 1) throw new InviteNoLongerAvailableError()
      return tx.hrOrganizationMember.create({
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
    })

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

    return NextResponse.json({
      success: true,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
      },
      role: invitation.role,
    })
  } catch (e: any) {
    if (e instanceof InviteNoLongerAvailableError) {
      return NextResponse.json({ error: 'この招待は使用済み、または有効期限が切れています' }, { status: 409 })
    }
    return NextResponse.json(
      { error: e?.message || 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
