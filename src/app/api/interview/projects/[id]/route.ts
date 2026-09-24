// ============================================
// GET / PUT / DELETE /api/interview/projects/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { enqueueInterviewProjectStoragePurge } from '@/lib/interview/storage-purge-queue'
import { preserveInterviewTranscriptionUsageBeforeDelete } from '@/lib/interview/transcription-budget'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
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

    if ('recipeId' in data && data.recipeId !== null) {
      if (typeof data.recipeId !== 'string' || !data.recipeId.trim()) {
        return NextResponse.json({ success: false, error: 'レシピの指定が正しくありません' }, { status: 400 })
      }
      const recipe = await prisma.interviewRecipe.findFirst({
        where: {
          id: data.recipeId,
          OR: [
            { isTemplate: true },
            { isPublic: true },
            ...(userId ? [{ userId }] : []),
          ],
        },
        select: { id: true },
      })
      if (!recipe) {
        return NextResponse.json({ success: false, error: 'レシピが見つかりません' }, { status: 404 })
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
      select: { id: true, userId: true, guestId: true },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(project, userId, guestId)
    if (ownerErr) return ownerErr

    // 再試行可能なストレージ削除記録とDB削除を同じトランザクションで確定する。
    const deleted = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${id}))`
      const processing = await tx.interviewMaterial.count({ where: { projectId: id, status: 'PROCESSING' } })
      if (processing > 0) return false
      await preserveInterviewTranscriptionUsageBeforeDelete(tx, project)
      await enqueueInterviewProjectStoragePurge(tx, project)
      await tx.interviewProject.delete({ where: { id } })
      return true
    })
    if (!deleted) return NextResponse.json({ success: false, error: '文字起こし中はプロジェクトを削除できません。完了後に再試行してください。' }, { status: 409 })

    return NextResponse.json({ success: true, fileCleanupPending: true })
  } catch {
    return NextResponse.json(
      { success: false, error: '削除に失敗しました' },
      { status: 500 }
    )
  }
}
