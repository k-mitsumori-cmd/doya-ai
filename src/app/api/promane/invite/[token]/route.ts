export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { acceptPromaneInvitation } from '@/lib/promane/invite-admission'

type Ctx = { params: Promise<{ token: string }> }

/**
 * GET /api/promane/invite/[token]
 * 招待トークンの検証 → ワークスペース情報を返す
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = await ctx.params
    const { token } = p

    if (!token) {
      return NextResponse.json({ error: 'token は必須です' }, { status: 400 })
    }

    const invitation = await prisma.promaneInvitation.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: '招待リンクが見つかりません' }, { status: 404 })
    }
    if (invitation.acceptedAt) {
      return NextResponse.json({ error: 'この招待は既に承諾済みです', code: 'PROMANE_INVITE_ACCEPTED' }, { status: 410 })
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: '招待リンクの有効期限が切れています', code: 'PROMANE_INVITE_EXPIRED' }, { status: 410 })
    }

    return NextResponse.json({
      success: true,
      invitation: {
        workspaceName: invitation.workspace.name,
        workspaceSlug: invitation.workspace.slug,
        email: invitation.email,
        role: invitation.role,
        invitedByName: invitation.invitedBy.name,
        expiresAt: invitation.expiresAt,
      },
    })
  } catch (e: any) {
    console.error('[promane/invite/token][GET]')
    return NextResponse.json({ error: '招待検証に失敗しました' }, { status: 500 })
  }
}

/**
 * POST /api/promane/invite/[token]
 * 招待を承諾してワークスペースに参加
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    const userEmail = session?.user?.email
    const userName = session?.user?.name
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const p = await ctx.params
    const { token } = p
    if (!token || token.length > 128) {
      return NextResponse.json({ error: '招待リンクが正しくありません' }, { status: 400 })
    }

    const admission = await acceptPromaneInvitation({ token, userId, email: userEmail, displayName: userName })
    if (!admission.success) {
      const { status, ...body } = admission.response
      return NextResponse.json(body, { status })
    }
    return NextResponse.json(admission)
  } catch (e: any) {
    console.error('[promane/invite/token][POST]')
    return NextResponse.json({ error: '招待承諾に失敗しました' }, { status: 500 })
  }
}
