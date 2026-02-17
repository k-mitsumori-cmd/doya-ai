// ============================================
// PUT/DELETE /api/tenkai/outputs/[outputId]
// ============================================
// 出力の手動編集・削除
// NOTE: [projectId]/route.ts と同じディレクトリ名だが、
// Next.js では使い分けできないため、outputId用は別パスで分離
// 実際には /api/tenkai/outputs/edit/[outputId] として運用

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ outputId: string }> | { outputId: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.outputId
}

/**
 * PUT — 手動編集内容を保存
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const outputId = await resolveId(ctx)

    const output = await prisma.tenkaiOutput.findUnique({
      where: { id: outputId },
      include: { project: { select: { userId: true } } },
    })

    if (!output || output.project.userId !== userId) {
      return NextResponse.json({ error: '出力が見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const { content } = body as { content: Record<string, unknown> }

    if (!content) {
      return NextResponse.json({ error: 'content は必須です' }, { status: 400 })
    }

    const updated = await prisma.tenkaiOutput.update({
      where: { id: outputId },
      data: {
        content: content as any,
        isEdited: true,
      },
    })

    return NextResponse.json({
      id: updated.id,
      platform: updated.platform,
      content: updated.content,
      isEdited: updated.isEdited,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] output update error:', message)
    return NextResponse.json(
      { error: message || '出力の更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — 出力削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const outputId = await resolveId(ctx)

    const output = await prisma.tenkaiOutput.findUnique({
      where: { id: outputId },
      include: { project: { select: { userId: true } } },
    })

    if (!output || output.project.userId !== userId) {
      return NextResponse.json({ error: '出力が見つかりません' }, { status: 404 })
    }

    await prisma.tenkaiOutput.delete({
      where: { id: outputId },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] output delete error:', message)
    return NextResponse.json(
      { error: message || '出力の削除に失敗しました' },
      { status: 500 }
    )
  }
}
