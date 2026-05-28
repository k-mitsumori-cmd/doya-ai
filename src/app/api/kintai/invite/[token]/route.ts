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

    // 招待トークン有効期限チェック（48時間）
    const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000
    if (member.createdAt && Date.now() - new Date(member.createdAt).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: '招待リンクの有効期限（48時間）が切れています。管理者に再招待を依頼してください。' }, { status: 410 })
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
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    // userId を確実に取得（session.user.id が欠けるケースに対応）
    let userId = (session.user as any)?.id as string | undefined
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      userId = dbUser?.id
    }
    if (!userId) {
      return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 400 })
    }

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const member = await prisma.kintaiMember.findFirst({
      where: { inviteToken: p.token, status: 'PENDING' },
      include: { organization: { select: { name: true } } },
    })
    if (!member) {
      return NextResponse.json({ error: '無効または期限切れの招待リンクです' }, { status: 404 })
    }

    const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000
    if (member.createdAt && Date.now() - new Date(member.createdAt).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: '招待リンクの有効期限（48時間）が切れています。管理者に再招待を依頼してください。' }, { status: 410 })
    }

    // 同じ組織に既存メンバーシップがある場合は削除（@@unique制約対策）
    const existingInSameOrg = await prisma.kintaiMember.findFirst({
      where: {
        organizationId: member.organizationId,
        userId,
        id: { not: member.id },
      },
    })
    if (existingInSameOrg) {
      // 既存メンバーのemployeeがあればinviteメンバーのemployeeにマージ
      await prisma.kintaiMember.delete({ where: { id: existingInSameOrg.id } })
    }

    // 他組織メンバーシップを非活性化
    await prisma.kintaiMember.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
        id: { not: member.id },
      },
      data: { status: 'INACTIVE' },
    })

    // 招待を受諾
    await prisma.kintaiMember.update({
      where: { id: member.id },
      data: {
        userId,
        status: 'ACTIVE',
        inviteToken: null,
        acceptedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      organizationId: member.organizationId,
      organizationName: member.organization.name,
    })
  } catch (e: any) {
    console.error('[kintai/invite/[token] POST]', e?.message, e?.code)
    const msg = e?.code === 'P2002'
      ? 'このアカウントは既にこの組織に所属しています'
      : '参加に失敗しました。管理者にお問い合わせください。'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
