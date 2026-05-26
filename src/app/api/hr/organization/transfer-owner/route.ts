export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'

// POST /api/hr/organization/transfer-owner
// オーナー権限を別メンバーに譲渡する
export async function POST(req: NextRequest) {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // OWNERのみ実行可能
    if (ctx.role !== HrMemberRole.OWNER) {
      return NextResponse.json(
        { error: 'オーナーのみがオーナー権限を譲渡できます' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { targetMemberId } = body

    if (!targetMemberId || typeof targetMemberId !== 'string') {
      return NextResponse.json({ error: 'targetMemberId is required' }, { status: 400 })
    }

    // 譲渡先メンバーを確認
    const targetMember = await prisma.hrOrganizationMember.findFirst({
      where: {
        id: targetMemberId,
        organizationId: ctx.organizationId,
        status: 'ACTIVE',
      },
      include: {
        user: { select: { name: true, email: true } },
      },
    })

    if (!targetMember) {
      return NextResponse.json(
        { error: '対象メンバーが見つかりません' },
        { status: 404 }
      )
    }

    if (targetMember.userId === ctx.userId) {
      return NextResponse.json(
        { error: '自分自身にオーナーを譲渡することはできません' },
        { status: 400 }
      )
    }

    // トランザクションで権限変更
    await prisma.$transaction([
      // 新オーナーに変更
      prisma.hrOrganizationMember.update({
        where: { id: targetMemberId },
        data: { role: HrMemberRole.OWNER },
      }),
      // 旧オーナー(自分)をADMINに降格
      prisma.hrOrganizationMember.update({
        where: { id: ctx.memberId },
        data: { role: HrMemberRole.ADMIN },
      }),
    ])

    // 監査ログ
    logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'TRANSFER_OWNER',
      target: 'organization',
      targetId: ctx.organizationId,
      details: {
        fromUserId: ctx.userId,
        toUserId: targetMember.userId,
        toMemberId: targetMemberId,
        toUserName: targetMember.user?.name,
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: `オーナー権限を ${targetMember.user?.name || targetMember.user?.email || targetMemberId} に譲渡しました`,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to transfer ownership' },
      { status: 500 }
    )
  }
}
