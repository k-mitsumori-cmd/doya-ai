export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

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

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const { id: memberId } = p

    const body = await req.json().catch(() => ({}))
    const { workspaceSlug, hourlyRate } = body || {}

    if (!workspaceSlug || !memberId) {
      return NextResponse.json({ error: 'workspaceSlug と memberId は必須です' }, { status: 400 })
    }

    // ⭐ 数値バリデーション (絶対値化せず、明示的に拒否)
    if (typeof hourlyRate !== 'number' || !Number.isFinite(hourlyRate)) {
      return NextResponse.json({ error: '時間単価は数値で入力してください' }, { status: 400 })
    }
    if (hourlyRate < 0) {
      return NextResponse.json(
        { error: '時間単価は 0以上を入力してください（負値は保存できません）' },
        { status: 400 }
      )
    }
    if (hourlyRate > 9_999_999_999) {
      return NextResponse.json({ error: '時間単価が大きすぎます' }, { status: 400 })
    }
    const rate = Math.floor(hourlyRate)

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

    // 最終防御: Math.max(0, ...) で念のため負値を完全排除
    const finalRate = Math.max(0, rate)
    if (finalRate !== rate) {
      console.warn(`[promane/rate] 異常値検知: ${rate} → ${finalRate}`)
    }

    await prisma.promaneMember.update({
      where: { id: memberId },
      data: { hourlyRate: finalRate },
    })

    return NextResponse.json({ success: true, hourlyRate: finalRate })
  } catch (e: any) {
    console.error('[promane/members/rate]', e)
    return NextResponse.json(
      { error: e?.message || '時間単価の更新に失敗しました' },
      { status: 500 }
    )
  }
}
