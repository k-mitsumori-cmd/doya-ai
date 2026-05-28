export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

/**
 * POST /api/promane/invite
 * 招待リンクを発行
 * Body: { workspaceId: string, email: string, role?: 'admin'|'member'|'guest' }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { workspaceId, email, role = 'member' } = body || {}

    if (!workspaceId || !email) {
      return NextResponse.json({ error: 'workspaceId と email は必須です' }, { status: 400 })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'メールアドレス形式が不正です' }, { status: 400 })
    }
    if (!['admin', 'member', 'guest'].includes(role)) {
      return NextResponse.json({ error: 'role が不正です' }, { status: 400 })
    }

    // 自分が workspace owner/admin か確認
    const myMember = await prisma.promaneMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    })
    if (!myMember || !['owner', 'admin'].includes(myMember.role)) {
      return NextResponse.json({ error: '招待権限がありません（owner/admin のみ）' }, { status: 403 })
    }

    // 既存メンバーは招待不要
    const existingMember = await prisma.promaneMember.findFirst({
      where: { workspaceId, user: { email } },
    })
    if (existingMember) {
      return NextResponse.json({ error: '既にメンバーです' }, { status: 409 })
    }

    // 既存の未承諾招待を確認（重複防止）
    const existingInvite = await prisma.promaneInvitation.findFirst({
      where: {
        workspaceId,
        email: email.toLowerCase(),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    })
    if (existingInvite) {
      const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'}/promane/invite/${existingInvite.token}`
      return NextResponse.json({ success: true, token: existingInvite.token, inviteUrl, reused: true })
    }

    // 新規招待作成（30日有効）
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const invitation = await prisma.promaneInvitation.create({
      data: {
        workspaceId,
        email: email.toLowerCase(),
        role,
        token,
        invitedById: userId,
        expiresAt,
      },
    })

    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'}/promane/invite/${token}`

    return NextResponse.json({
      success: true,
      token: invitation.token,
      inviteUrl,
      expiresAt: invitation.expiresAt,
    })
  } catch (e: any) {
    console.error('[promane/invite][POST]', e)
    return NextResponse.json({ error: e?.message || '招待リンク発行に失敗しました' }, { status: 500 })
  }
}
