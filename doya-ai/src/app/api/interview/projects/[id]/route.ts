// ============================================
// GET / PUT / DELETE /api/interview/projects/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { deleteFile } from '@/lib/interview/storage'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

/**
 * GET — プロジェクト詳細 (素材・ドラフト含む)
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const project = await prisma.interviewProject.findUnique({
      where: { id },
      include: {
        materials: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            duration: true,
            status: true,
            error: true,
            createdAt: true,
          },
        },
        transcriptions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            materialId: true,
            status: true,
            summary: true,
            provider: true,
            confidence: true,
            createdAt: true,
          },
        },
        drafts: {
          orderBy: { version: 'desc' },
          take: 5,
          select: {
            id: true,
            version: true,
            title: true,
            displayFormat: true,
            wordCount: true,
            status: true,
            createdAt: true,
          },
        },
        recipe: {
          select: { id: true, name: true, category: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(project, userId, guestId)
    if (ownerErr) return ownerErr

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        intervieweeName: project.intervieweeName,
        intervieweeRole: project.intervieweeRole,
        intervieweeCompany: project.intervieweeCompany,
        intervieweeBio: project.intervieweeBio,
        genre: project.genre,
        theme: project.theme,
        thumbnailUrl: project.thumbnailUrl || null,
        purpose: project.purpose,
        targetAudience: project.targetAudience,
        tone: project.tone,
        mediaType: project.mediaType,
        outline: project.outline,
        finalContent: project.finalContent,
        recipe: project.recipe,
        materials: project.materials.map((m) => ({
          ...m,
          fileSize: m.fileSize ? Number(m.fileSize) : null,
          createdAt: m.createdAt.toISOString(),
        })),
        transcriptions: project.transcriptions.map((t) => ({
          ...t,
          createdAt: t.createdAt.toISOString(),
        })),
        drafts: project.drafts.map((d) => ({
          ...d,
          createdAt: d.createdAt.toISOString(),
        })),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — プロジェクト更新
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const project = await prisma.interviewProject.findUnique({
      where: { id },
      select: { id: true, userId: true, guestId: true },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(project, userId, guestId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const allowedFields = [
      'title', 'status', 'intervieweeName', 'intervieweeRole',
      'intervieweeCompany', 'intervieweeBio', 'genre', 'theme',
      'purpose', 'targetAudience', 'tone', 'mediaType',
      'outline', 'finalContent', 'recipeId',
    ]

    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) {
        data[key] = body[key]
      }
    }

    const updated = await prisma.interviewProject.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      success: true,
      project: {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE — プロジェクト削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const project = await prisma.interviewProject.findUnique({
      where: { id },
      include: {
        materials: { select: { filePath: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(project, userId, guestId)
    if (ownerErr) return ownerErr

    // ストレージからファイル削除
    for (const m of project.materials) {
      if (m.filePath) {
        await deleteFile(m.filePath).catch(() => {})
      }
    }

    // DB削除 (CASCADE で materials, transcriptions, drafts, reviews も削除)
    await prisma.interviewProject.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}
