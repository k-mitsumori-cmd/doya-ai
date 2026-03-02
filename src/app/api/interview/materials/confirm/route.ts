// ============================================
// POST /api/interview/materials/confirm
// ============================================
// クライアントが Supabase Storage への直接アップロード完了後に呼ぶ
// ファイルの存在を確認し、DBステータスを更新する

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, requireDatabase } from '@/lib/interview/access'
import { getFileMetadata, getSignedFileUrl } from '@/lib/interview/storage'

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const body = await req.json()
    const { materialId } = body as { materialId: string }

    if (!materialId) {
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
    if (userId && material.project.userId !== userId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }
    if (!userId && guestId && material.project.guestId !== guestId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
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

    // 署名付きURLを取得してDBに保存
    const fileUrl = await getSignedFileUrl(storagePath, 7 * 24 * 3600) // 7日間有効

    // DBステータス更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: {
        status: 'COMPLETED',
        fileUrl,
        fileSize: BigInt(metadata.size),
        mimeType: (metadata.mimeType && metadata.mimeType !== 'application/octet-stream')
          ? metadata.mimeType
          : (material.mimeType || metadata.mimeType),
      },
    })

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
  } catch (e: any) {
    console.error('[interview] confirm error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'アップロード確認に失敗しました' },
      { status: 500 }
    )
  }
}
