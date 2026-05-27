export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const member = await prisma.kintaiMember.findFirst({
      where: { inviteToken: p.token, status: 'PENDING' },
      include: {
        organization: { select: { name: true } },
      },
    })
    if (!member) {
      return NextResponse.json({ error: '無効または期限切れの招待リンクです' }, { status: 404 })
    }

    const employee = await prisma.kintaiEmployee.findFirst({
      where: { organizationId: member.organizationId, member: { id: member.id } },
      select: { name: true, email: true },
    })

    return NextResponse.json({
      organizationName: member.organization.name,
      employeeName: employee?.name || '',
      email: employee?.email || member.inviteEmail,
      role: member.role,
    })
  } catch (e) {
    console.error('[kintai/invite/[token] GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const member = await prisma.kintaiMember.findFirst({
      where: { inviteToken: p.token, status: 'PENDING' },
    })
    if (!member) {
      return NextResponse.json({ error: '無効または期限切れの招待リンクです' }, { status: 404 })
    }

    const userId = (session.user as any).id
    await prisma.kintaiMember.update({
      where: { id: member.id },
      data: {
        userId,
        status: 'ACTIVE',
        inviteToken: null,
        acceptedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, organizationId: member.organizationId })
  } catch (e) {
    console.error('[kintai/invite/[token] POST]', e)
    return NextResponse.json({ error: '参加に失敗しました' }, { status: 500 })
  }
}
