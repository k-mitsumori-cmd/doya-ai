// ============================================
// POST /api/interview/materials/confirm
// ============================================
// クライアントが Supabase Storage への直接アップロード完了後に呼ぶ
// ファイルの存在を確認し、DBステータスを更新する

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'
import { ensureBucket, getDetectedMaxFileSize, getFileMetadata, getSignedFileUrl } from '@/lib/interview/storage'
import { getMaxFileSize } from '@/lib/interview/types'
import { getInterviewGuestLimits, getInterviewLimitsByPlan } from '@/lib/pricing'
import { enqueueInterviewMaterialStoragePurge } from '@/lib/interview/storage-purge-queue'

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId, plan } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const body = await req.json().catch(() => null)
    const materialId = body?.materialId

    if (typeof materialId !== 'string' || !materialId) {
      return NextResponse.json(
        { success: false, error: 'materialId は必須です' },
        { status: 400 }
      )
    }

    // 素材レコード取得
    const material = await prisma.interviewMaterial.findUnique({
      where: { id: materialId },
      include: { project: { select: { userId: true, guestId: true } } },
    })

    if (!material) {
      return NextResponse.json(
        { success: false, error: '素材が見つかりません' },
        { status: 404 }
      )
    }

    // 所有者チェック
    const ownerErr = checkOwnership(material.project, userId, guestId)
    if (ownerErr) return ownerErr
    if (material.status !== 'UPLOADED' && material.status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'この素材のアップロード確認はできません' }, { status: 409 })
    }

    // Supabase Storage でファイルの存在確認
    const storagePath = material.filePath
    if (!storagePath) {
      return NextResponse.json(
        { success: false, error: 'ストレージパスが未設定です' },
        { status: 400 }
      )
    }

    const metadata = await getFileMetadata(storagePath)
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: 'ストレージにファイルが見つかりません。アップロードが完了していない可能性があります。' },
        { status: 400 }
      )
    }

    await ensureBucket()
    const planMax = (userId ? getInterviewLimitsByPlan(plan) : getInterviewGuestLimits()).uploadSizeLimit
    const storageMax = Math.min(getDetectedMaxFileSize(), getMaxFileSize())
    const maxSize = planMax > 0 ? Math.min(planMax, storageMax) : storageMax
    if (metadata.size > maxSize) {
      await prisma.$transaction(async (tx) => {
        const rejected = await tx.interviewMaterial.updateMany({
          where: { id: material.id, status: 'UPLOADED', fileUrl: null },
          data: { status: 'ERROR', error: 'ファイルサイズがプランの上限を超えています' },
        })
        if (rejected.count) await enqueueInterviewMaterialStoragePurge(tx, {
          id: material.id, projectId: material.projectId, filePath: storagePath,
          userId: material.project.userId, guestId: material.project.guestId,
        })
      })
      return NextResponse.json({ success: false, error: '実際のファイルサイズがアップロード上限を超えています。', code: 'UPLOAD_LIMIT_REACHED' }, { status: 413 })
    }

    // 署名付きURLを取得してDBに保存
    const fileUrl = await getSignedFileUrl(storagePath, 7 * 24 * 3600) // 7日間有効

    // DBステータス更新
    const updated = await prisma.interviewMaterial.updateMany({
      where: { id: materialId, status: { in: ['UPLOADED', 'COMPLETED'] } },
      data: {
        status: 'COMPLETED',
        fileUrl,
        fileSize: BigInt(metadata.size),
        mimeType: (metadata.mimeType && metadata.mimeType !== 'application/octet-stream')
          ? metadata.mimeType
          : (material.mimeType || metadata.mimeType),
      },
    })
    if (!updated.count) return NextResponse.json({ success: false, error: '素材の状態が変更されました。再読み込みしてください。' }, { status: 409 })

    return NextResponse.json({
      success: true,
      material: {
        id: material.id,
        fileName: material.fileName,
        type: material.type,
        fileSize: metadata.size,
        mimeType: metadata.mimeType,
        status: 'COMPLETED',
      },
    })
  } catch {
    console.error('[interview] upload confirmation failed')
    return NextResponse.json(
      { success: false, error: 'アップロードを確認できませんでした。しばらくしてから再試行してください。', code: 'UPLOAD_CONFIRM_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
