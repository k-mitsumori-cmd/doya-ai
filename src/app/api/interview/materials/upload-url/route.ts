// ============================================
// POST /api/interview/materials/upload-url
// ============================================
// 署名付きアップロードURLを生成する
// クライアントはこのURLに対してファイルを直接PUTし、
// Vercelのボディサイズ制限 (4.5MB) を完全バイパスする
//
// フロー:
// 1. クライアント → このエンドポイント: { projectId, fileName, mimeType, fileSize }
// 2. レスポンス: { signedUrl, materialId, path }
// 3. クライアント → signedUrl に PUT でファイル送信 (Vercel経由しない)
// 4. クライアント → /api/interview/materials/confirm で完了通知

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, ensureGuestId, setGuestCookie, requireDatabase } from '@/lib/interview/access'
import { createSignedUploadUrl, buildStoragePath, getDetectedMaxFileSize } from '@/lib/interview/storage'
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, getMaxFileSize } from '@/lib/interview/types'

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    // 認証
    const { userId } = await getInterviewUser()
    let guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) {
      guestId = ensureGuestId()
    }

    // リクエストボディ
    const body = await req.json()
    const { projectId, fileName, mimeType, fileSize } = body as {
      projectId: string
      fileName: string
      mimeType: string
      fileSize: number
    }

    // バリデーション
    if (!projectId || !fileName || !mimeType) {
      return NextResponse.json(
        { success: false, error: 'projectId, fileName, mimeType は必須です' },
        { status: 400 }
      )
    }

    // ファイル拡張子チェック
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: `非対応のファイル形式です: .${ext}` },
        { status: 400 }
      )
    }

    // MIMEタイプチェック
    const materialType = ALLOWED_MIME_TYPES[mimeType]
    if (!materialType) {
      return NextResponse.json(
        { success: false, error: `非対応のMIMEタイプです: ${mimeType}` },
        { status: 400 }
      )
    }

    // ファイルサイズチェック (検出された Supabase プラン上限 or 環境変数)
    const detectedMax = getDetectedMaxFileSize()
    const configMax = getMaxFileSize()
    const maxSize = Math.min(detectedMax, configMax)
    if (fileSize && fileSize > maxSize) {
      const mb = Math.round(maxSize / 1024 / 1024)
      return NextResponse.json(
        { success: false, error: `ファイルサイズが上限 (${mb}MB) を超えています。Supabaseプランをご確認ください。` },
        { status: 400 }
      )
    }

    // プロジェクト所有者チェック
    const project = await prisma.interviewProject.findUnique({
      where: { id: projectId },
      select: { id: true, userId: true, guestId: true },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    if (userId && project.userId !== userId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }
    if (!userId && guestId && project.guestId !== guestId) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    // ストレージパス生成
    const storagePath = buildStoragePath({
      userId,
      guestId,
      projectId,
      fileName,
    })

    // 署名付きアップロードURL生成 (Supabase Storage)
    const uploadData = await createSignedUploadUrl(storagePath)

    // 素材レコードを「アップロード待ち」として先に作成
    const material = await prisma.interviewMaterial.create({
      data: {
        projectId,
        type: materialType,
        fileName,
        filePath: storagePath,
        fileSize: fileSize ? BigInt(fileSize) : null,
        mimeType,
        status: 'UPLOADED', // confirm で COMPLETED に更新
      },
    })

    // レスポンス
    const res = NextResponse.json({
      success: true,
      signedUrl: uploadData.signedUrl,
      path: uploadData.path,
      token: uploadData.token,
      materialId: material.id,
    })

    // ゲストの場合はCookieをセット
    if (!userId && guestId) {
      setGuestCookie(res, guestId)
    }

    return res
  } catch (e: any) {
    console.error('[interview] upload-url error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'アップロードURL生成に失敗しました' },
      { status: 500 }
    )
  }
}
