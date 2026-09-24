export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = await ctx.params
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

    const p = await ctx.params
    const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const member = await tx.kintaiMember.findFirst({
            where: { inviteToken: p.token, status: 'PENDING' },
            include: { organization: { select: { name: true } }, employee: { select: { email: true } } },
          })
          if (!member) return { status: 404, error: '無効または期限切れの招待リンクです' }
          if (member.createdAt && Date.now() - new Date(member.createdAt).getTime() > INVITE_EXPIRY_MS) {
            return { status: 410, error: '招待リンクの有効期限（48時間）が切れています。管理者に再招待を依頼してください。' }
          }
          if (!member.employee) return { status: 409, error: '従業員情報が見つかりません。管理者にお問い合わせください。' }
          const invitedEmail = (member.inviteEmail || member.employee.email).trim().toLowerCase()
          if (session.user.email!.trim().toLowerCase() !== invitedEmail) {
            return { status: 403, error: '招待先のメールアドレスでログインしてください。' }
          }
          const existing = await tx.kintaiMember.findFirst({
            where: { organizationId: member.organizationId, userId, id: { not: member.id } },
          })
          if (existing) return { status: 409, error: 'このアカウントは既にこの組織に所属しています' }

          await tx.kintaiMember.updateMany({
            where: { userId, status: 'ACTIVE', id: { not: member.id } },
            data: { status: 'INACTIVE' },
          })
          const claimed = await tx.kintaiMember.updateMany({
            where: { id: member.id, inviteToken: p.token, status: 'PENDING' },
            data: { userId, status: 'ACTIVE', inviteToken: null, acceptedAt: new Date() },
          })
          if (claimed.count !== 1) throw new Error('Invitation was claimed concurrently')
          return { status: 200, success: true, organizationId: member.organizationId, organizationName: member.organization.name }
        }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
        const { status, ...body } = result
        return NextResponse.json(body, { status })
      } catch (e: any) {
        if (e?.code === 'P2002') return NextResponse.json({ error: 'このアカウントは既にこの組織に所属しています' }, { status: 409 })
        if (e?.code !== 'P2034' || attempt === 2) throw e
      }
    }
    return NextResponse.json({ error: '参加に失敗しました。再度お試しください。' }, { status: 500 })
  } catch (e: any) {
    console.error('[kintai/invite/[token] POST]', e?.message, e?.code)
    return NextResponse.json({ error: '参加に失敗しました。管理者にお問い合わせください。' }, { status: 500 })
  }
}
