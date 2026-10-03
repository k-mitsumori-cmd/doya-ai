export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'

class TransferConflict extends Error {}

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

    if (targetMemberId === ctx.memberId) {
      return NextResponse.json(
        { error: '自分自身にオーナーを譲渡することはできません' },
        { status: 400 }
      )
    }

    // 同じ組織への譲渡を直列化し、ロック後の権限と在籍状態を再確認する。
    const targetMember = await prisma.$transaction(async (tx) => {
      const organizations = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "hr_organizations" WHERE id = ${ctx.organizationId} FOR UPDATE`
      if (organizations.length === 0) throw new TransferConflict('組織が見つかりません')

      const owners = await tx.hrOrganizationMember.findMany({
        where: { organizationId: ctx.organizationId, role: HrMemberRole.OWNER, status: 'ACTIVE' },
        select: { id: true },
        take: 2,
      })
      if (owners.length !== 1 || owners[0].id !== ctx.memberId) {
        throw new TransferConflict('オーナー権限が変更されました。再読み込みしてください')
      }

      const target = await tx.hrOrganizationMember.findFirst({
        where: { id: targetMemberId, organizationId: ctx.organizationId, status: 'ACTIVE', role: { not: HrMemberRole.OWNER } },
        include: { user: { select: { name: true, email: true } } },
      })
      if (!target) throw new TransferConflict('譲渡先の状態が変わりました。再読み込みしてください')

      const promoted = await tx.hrOrganizationMember.updateMany({
        where: { id: targetMemberId, organizationId: ctx.organizationId, status: 'ACTIVE', role: { not: HrMemberRole.OWNER } },
        data: { role: HrMemberRole.OWNER },
      })
      if (promoted.count !== 1) throw new TransferConflict('譲渡先の状態が変わりました。再読み込みしてください')
      const demoted = await tx.hrOrganizationMember.updateMany({
        where: { id: ctx.memberId, organizationId: ctx.organizationId, status: 'ACTIVE', role: HrMemberRole.OWNER },
        data: { role: HrMemberRole.ADMIN },
      })
      if (demoted.count !== 1) throw new TransferConflict('オーナー権限が変更されました。再読み込みしてください')
      return target
    })

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
    if (e instanceof TransferConflict) {
      return NextResponse.json({ error: 'オーナー権限または譲渡先の状態が変わりました。再読み込みしてください' }, { status: 409 })
    }
    console.error('[hr/organization/transfer-owner] unexpected error')
    return NextResponse.json(
      { error: 'Failed to transfer ownership' },
      { status: 500 }
    )
  }
}
