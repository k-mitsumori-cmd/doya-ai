// ============================================
// GET / DELETE /api/interview/materials/[id]
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { getSignedFileUrl } from '@/lib/interview/storage'
import { enqueueInterviewMaterialStoragePurge } from '@/lib/interview/storage-purge-queue'
import { preserveInterviewTranscriptionUsageBeforeDelete } from '@/lib/interview/transcription-budget'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
  return p.id
}

/**
 * GET — 素材詳細取得
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const material = await prisma.interviewMaterial.findUnique({
      where: { id },
      include: {
        project: { select: { userId: true, guestId: true } },
        transcriptions: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!material) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(material.project, userId, guestId)
    if (ownerErr) return ownerErr

    // fileUrlが期限切れの場合は再取得
    let fileUrl = material.fileUrl
    if (material.filePath && material.status === 'COMPLETED') {
      try {
        fileUrl = await getSignedFileUrl(material.filePath, 3600)
      } catch {
        // ストレージ接続できない場合は既存URLを使う
      }
    }

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        projectId: material.projectId,
        type: material.type,
        fileName: material.fileName,
        fileUrl,
        fileSize: material.fileSize ? Number(material.fileSize) : null,
        mimeType: material.mimeType,
        duration: material.duration,
        status: material.status,
        error: material.error,
        latestTranscription: material.transcriptions[0] || null,
        createdAt: material.createdAt.toISOString(),
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
 * DELETE — 素材削除
 */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const material = await prisma.interviewMaterial.findUnique({
      where: { id },
      include: { project: { select: { userId: true, guestId: true } } },
    })

    if (!material) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(material.project, userId, guestId)
    if (ownerErr) return ownerErr

    // 生成開始・プロジェクト削除と直列化する。処理中の外部ジョブのファイルは消さない。
    const outcome = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${material.projectId}))`
      const current = await tx.interviewMaterial.findUnique({
        where: { id }, select: { id: true, projectId: true, status: true, filePath: true },
      })
      if (!current || current.projectId !== material.projectId) return 'missing' as const
      if (current.status === 'PROCESSING') return 'processing' as const
      await preserveInterviewTranscriptionUsageBeforeDelete(tx, material.project)
      if (current.filePath) {
        await enqueueInterviewMaterialStoragePurge(tx, {
          id, projectId: current.projectId, filePath: current.filePath,
          userId: material.project.userId, guestId: material.project.guestId,
        })
      }
      await tx.interviewMaterial.delete({ where: { id } })
      return 'deleted' as const
    })
    if (outcome === 'missing') return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    if (outcome === 'processing') return NextResponse.json({ success: false, error: '文字起こし中は素材を削除できません。完了後に再試行してください。' }, { status: 409 })
    return NextResponse.json({ success: true, fileCleanupPending: true })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}
