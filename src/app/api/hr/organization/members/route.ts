export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getHrContext, hasMinRole } from '@/lib/hr/access'

export async function GET() {
  try {
    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'ログイン状態か所属する組織を確かめて、もう一度お試しください。' }, { status: 401 })
    }

    const members = await prisma.hrOrganizationMember.findMany({
      where: {
        organizationId: ctx.organizationId,
        ...(!hasMinRole(ctx.role, 'ADMIN') ? { id: ctx.memberId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ success: true, members })
  } catch (e: any) {
    console.error('[hr/organization/members] unexpected error')
    return NextResponse.json(
      { error: 'メンバーの一覧を読み込めませんでした。時間をおいて再読み込みしてください。' },
      { status: 500 }
    )
  }
}
