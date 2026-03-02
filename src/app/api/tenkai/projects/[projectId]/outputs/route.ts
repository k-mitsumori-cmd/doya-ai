// ============================================
// GET /api/tenkai/projects/[projectId]/outputs
// ============================================
// プロジェクトの全出力取得

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ projectId: string }> | { projectId: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const p = 'then' in ctx.params ? await ctx.params : ctx.params
    const projectId = p.projectId

    // プロジェクト所有者確認
    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, title: true, status: true },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const outputs = await prisma.tenkaiOutput.findMany({
      where: { projectId },
      orderBy: [{ platform: 'asc' }, { version: 'desc' }],
      include: {
        brandVoice: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
      },
      outputs: outputs.map((o) => ({
        id: o.id,
        platform: o.platform,
        content: o.content,
        charCount: o.charCount,
        qualityScore: o.qualityScore,
        isEdited: o.isEdited,
        status: o.status,
        tokensUsed: o.tokensUsed,
        brandVoice: o.brandVoice,
        feedback: o.feedback,
        version: o.version,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] outputs list error:', message)
    return NextResponse.json(
      { error: message || '出力一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}
