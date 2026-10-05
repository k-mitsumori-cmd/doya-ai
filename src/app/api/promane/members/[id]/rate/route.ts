export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function retryRateTransaction<T>(commit: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await commit() }
    catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2034')) throw error
      if (attempt === 2) throw new Error('同時にメンバーが変更されました')
    }
  }
  throw new Error('時間単価を更新できませんでした')
}

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

    if (typeof workspaceSlug !== 'string' || !workspaceSlug.trim() || workspaceSlug.length > 200 || !memberId) {
      return NextResponse.json({ error: 'workspaceSlug と memberId は必須です' }, { status: 400 })
    }

    if (typeof hourlyRate !== 'number' || !Number.isSafeInteger(hourlyRate) || hourlyRate < 0 || hourlyRate > 2_147_483_647) {
      return NextResponse.json({ error: '時間単価は0〜2,147,483,647円の整数で入力してください' }, { status: 400 })
    }
    const rate = hourlyRate

    const result = await retryRateTransaction(() => prisma.$transaction(async tx => {
      const workspace = await tx.promaneWorkspace.findFirst({
        where: { slug: workspaceSlug, members: { some: { userId, isActive: true } } },
        select: { id: true },
      })
      if (!workspace) return { status: 403 as const, error: 'ワークスペースにアクセスできません' }
      const actor = await tx.promaneMember.findFirst({
        where: { workspaceId: workspace.id, userId, isActive: true, role: { in: ['owner', 'admin'] } },
        select: { id: true },
      })
      if (!actor) return { status: 403 as const, error: '時間単価を変更する権限がありません（owner/admin のみ）' }
      const updated = await tx.promaneMember.updateMany({
        where: { id: memberId, workspaceId: workspace.id },
        data: { hourlyRate: rate },
      })
      if (updated.count !== 1) return { status: 404 as const, error: 'メンバーが見つかりません' }
      return { status: 200 as const }
    }, { isolationLevel: 'Serializable' }))
    if (result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ success: true, hourlyRate: rate })
  } catch (e: any) {
    console.error('[promane/members/rate] failed')
    return NextResponse.json(
      { error: '時間単価の更新に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
