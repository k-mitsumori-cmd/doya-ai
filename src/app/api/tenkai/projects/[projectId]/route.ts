// ============================================
// GET / PUT / DELETE /api/tenkai/projects/[projectId]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ projectId: string }> | { projectId: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.projectId
}

/**
 * GET — プロジェクト詳細
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const projectId = await resolveId(ctx)

    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
      include: {
        outputs: {
          orderBy: [{ platform: 'asc' }, { version: 'desc' }],
          include: {
            brandVoice: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        inputType: project.inputType,
        inputUrl: project.inputUrl,
        inputText: project.inputText,
        inputVideoUrl: project.inputVideoUrl,
        transcript: project.transcript,
        analysis: project.analysis,
        status: project.status,
        wordCount: project.wordCount,
        language: project.language,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        outputs: project.outputs.map((o) => ({
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
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] project detail error:', message)
    return NextResponse.json(
      { error: message || 'プロジェクト詳細の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — プロジェクト更新
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const projectId = await resolveId(ctx)

    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const { title, inputText } = body as {
      title?: string
      inputText?: string
    }

    const data: Record<string, unknown> = {}
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json({ error: 'タイトルは空にできません' }, { status: 400 })
      }
      data.title = title.trim()
    }
    if (inputText !== undefined) {
      data.inputText = inputText
      data.wordCount = typeof inputText === 'string' ? inputText.length : 0
    }

    const updated = await prisma.tenkaiProject.update({
      where: { id: projectId },
      data,
    })

    return NextResponse.json({
      project: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] project update error:', message)
    return NextResponse.json(
      { error: message || 'プロジェクト更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — プロジェクト削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id
    const projectId = await resolveId(ctx)

    const project = await prisma.tenkaiProject.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })

    if (!project || project.userId !== userId) {
      return NextResponse.json({ error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    await prisma.tenkaiProject.delete({
      where: { id: projectId },
    })

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] project delete error:', message)
    return NextResponse.json(
      { error: message || 'プロジェクト削除に失敗しました' },
      { status: 500 }
    )
  }
}
