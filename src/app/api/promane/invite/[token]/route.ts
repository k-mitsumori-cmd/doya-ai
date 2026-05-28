export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

/**
 * GET /api/promane/invite/[token]
 * 招待トークンの検証 → ワークスペース情報を返す
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = 'then' in ctx.params ? await ctx.params : ctx.params
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
      return NextResponse.json({ error: 'この招待は既に承諾済みです' }, { status: 410 })
    }
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: '招待リンクの有効期限が切れています' }, { status: 410 })
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
    console.error('[promane/invite/token][GET]', e)
    return NextResponse.json({ error: e?.message || '招待検証に失敗しました' }, { status: 500 })
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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { token } = p

    const invitation = await prisma.promaneInvitation.findUnique({
      where: { token },
      include: { workspace: { select: { id: true, slug: true } } },
    })
    if (!invitation) {
      return NextResponse.json({ error: '招待リンクが見つかりません' }, { status: 404 })
    }
    if (invitation.acceptedAt) {
      return NextResponse.json({ error: '既に承諾済みです' }, { status: 410 })
    }
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: '有効期限が切れています' }, { status: 410 })
    }
    // メールアドレスが一致しなくても受け入れる（柔軟性のため）が、警告に使う
    const emailMismatch = userEmail?.toLowerCase() !== invitation.email

    // 既にメンバーか確認
    const existing = await prisma.promaneMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId } },
    })
    if (existing) {
      // 既にメンバー → 招待は承諾扱いにして直接リダイレクト
      await prisma.promaneInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      })
      return NextResponse.json({
        success: true,
        workspaceSlug: invitation.workspace.slug,
        alreadyMember: true,
      })
    }

    // トランザクションでメンバー作成&招待承諾
    await prisma.$transaction([
      prisma.promaneMember.create({
        data: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
          displayName: userName || invitation.email.split('@')[0],
        },
      }),
      prisma.promaneInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ])

    return NextResponse.json({
      success: true,
      workspaceSlug: invitation.workspace.slug,
      emailMismatch,
    })
  } catch (e: any) {
    console.error('[promane/invite/token][POST]', e)
    return NextResponse.json({ error: e?.message || '招待承諾に失敗しました' }, { status: 500 })
  }
}
