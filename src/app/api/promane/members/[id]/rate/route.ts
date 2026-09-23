export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/promane/members/[id]/rate
 * Body: { workspaceSlug: string, hourlyRate: number }
 *
 * メンバーの時間単価を更新 (owner/admin限定 + IDOR防止 + 負値拒否)
 * Server Action のチャンクキャッシュ問題を回避するため API ルート化
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインセッションが切れています' }, { status: 401 })
    }

    const p = await ctx.params
    const { id: memberId } = p

    const body = await req.json().catch(() => ({}))
    const { workspaceSlug, hourlyRate } = body || {}

    if (!workspaceSlug || !memberId) {
      return NextResponse.json({ error: 'workspaceSlug と memberId は必須です' }, { status: 400 })
    }

    if (typeof hourlyRate !== 'number' || !Number.isSafeInteger(hourlyRate) || hourlyRate < 0 || hourlyRate > 2_147_483_647) {
      return NextResponse.json({ error: '時間単価は0〜2,147,483,647円の整数で入力してください' }, { status: 400 })
    }
    const rate = hourlyRate

    // ワークスペース所属 + 権限確認
    const workspace = await prisma.promaneWorkspace.findFirst({
      where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
      select: { id: true },
    })
    if (!workspace) {
      return NextResponse.json({ error: 'ワークスペースにアクセスできません' }, { status: 403 })
    }

    const myMember = await prisma.promaneMember.findFirst({
      where: { workspaceId: workspace.id, userId, isActive: true },
      select: { role: true },
    })
    if (!myMember || !['owner', 'admin'].includes(myMember.role)) {
      return NextResponse.json(
        { error: '時間単価を変更する権限がありません（owner/admin のみ）' },
        { status: 403 }
      )
    }

    // IDOR防止: 対象メンバーが自WSに属するか
    const target = await prisma.promaneMember.findFirst({
      where: { id: memberId, workspaceId: workspace.id },
      select: { id: true },
    })
    if (!target) {
      return NextResponse.json({ error: 'メンバーが見つかりません' }, { status: 404 })
    }

    await prisma.promaneMember.update({
      where: { id: memberId },
      data: { hourlyRate: rate },
    })

    return NextResponse.json({ success: true, hourlyRate: rate })
  } catch (e: any) {
    console.error('[promane/members/rate] failed')
    return NextResponse.json(
      { error: '時間単価の更新に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
