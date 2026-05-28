export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/promane/invitations
 * Query: ?type=received|sent (default: received)
 *
 * received: 自分のメール宛に届いた未承諾招待を返す
 * sent: ワークスペースで自分が発行した招待一覧（owner/admin のみ）+ ?workspaceId=
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    const userEmail = session?.user?.email?.toLowerCase()
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const type = req.nextUrl.searchParams.get('type') || 'received'

    if (type === 'received') {
      if (!userEmail) return NextResponse.json({ success: true, invitations: [] })
      const invitations = await prisma.promaneInvitation.findMany({
        where: {
          email: userEmail,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        include: {
          workspace: { select: { name: true, slug: true } },
          invitedBy: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json({
        success: true,
        invitations: invitations.map((i) => ({
          id: i.id,
          token: i.token,
          workspaceName: i.workspace.name,
          workspaceSlug: i.workspace.slug,
          role: i.role,
          invitedByName: i.invitedBy.name,
          invitedByEmail: i.invitedBy.email,
          createdAt: i.createdAt,
          expiresAt: i.expiresAt,
        })),
      })
    }

    if (type === 'sent') {
      const workspaceId = req.nextUrl.searchParams.get('workspaceId')
      if (!workspaceId) return NextResponse.json({ error: 'workspaceId は必須です' }, { status: 400 })
      // 権限確認: owner/admin のみ
      const member = await prisma.promaneMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      })
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      }
      const invitations = await prisma.promaneInvitation.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      return NextResponse.json({
        success: true,
        invitations: invitations.map((i) => ({
          id: i.id,
          token: i.token, // 取消・コピー用（admin/ownerのみが見ているため安全）
          email: i.email,
          role: i.role,
          acceptedAt: i.acceptedAt,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
          isExpired: i.expiresAt < new Date(),
        })),
      })
    }

    return NextResponse.json({ error: 'typeは received|sent のみ' }, { status: 400 })
  } catch (e: any) {
    console.error('[promane/invitations][GET]', e)
    return NextResponse.json({ error: e?.message || '取得に失敗しました' }, { status: 500 })
  }
}

/**
 * DELETE /api/promane/invitations?id=xxx
 * 発行した招待を取り消す (owner/admin のみ)
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id は必須です' }, { status: 400 })

    const inv = await prisma.promaneInvitation.findUnique({
      where: { id },
      select: { workspaceId: true, acceptedAt: true },
    })
    if (!inv) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (inv.acceptedAt) return NextResponse.json({ error: '既に承諾済みです' }, { status: 410 })

    const member = await prisma.promaneMember.findUnique({
      where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId } },
    })
    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 })
    }

    await prisma.promaneInvitation.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[promane/invitations][DELETE]', e)
    return NextResponse.json({ error: e?.message || '削除に失敗しました' }, { status: 500 })
  }
}
