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
import { createSignedUploadUrl, buildStoragePath, ensureBucket, getDetectedMaxFileSize } from '@/lib/interview/storage'
import { ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS, getMaxFileSize } from '@/lib/interview/types'
import { getInterviewLimitsByPlan, getInterviewGuestLimits } from '@/lib/pricing'

export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    // 認証
    const { userId, plan } = await getInterviewUser()
    let guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) {
      guestId = ensureGuestId()
    }

    // リクエストボディ
    const body = await req.json().catch(() => null)
    const projectId = body?.projectId
    const fileName = body?.fileName
    const mimeType = body?.mimeType
    const fileSize = body?.fileSize

    // バリデーション
    if (typeof projectId !== 'string' || !projectId || typeof fileName !== 'string' || !fileName || typeof mimeType !== 'string' || !mimeType) {
      return NextResponse.json(
        { success: false, error: 'projectId, fileName, mimeType は必須です' },
        { status: 400 }
      )
    }
    if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
      return NextResponse.json({ success: false, error: 'ファイルサイズが不正です' }, { status: 400 })
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

    // ストレージの実際の設定を確定してからサイズを判定する。
    // ここを省くとコールドスタート直後に暫定5GBで判定し、Storage側で拒否され得る。
    await ensureBucket()
    const planMax = (userId ? getInterviewLimitsByPlan(plan) : getInterviewGuestLimits()).uploadSizeLimit
    const storageMax = Math.min(getDetectedMaxFileSize(), getMaxFileSize())
    const maxSize = planMax > 0 ? Math.min(planMax, storageMax) : storageMax
    if (fileSize > maxSize) {
      const mb = Math.round(maxSize / 1024 / 1024)
      const isGuest = !userId
      return NextResponse.json(
        {
          success: false,
          error: `ファイルサイズが上限 (${mb}MB) を超えています。`,
          code: isGuest ? 'GUEST_UPLOAD_LIMIT' : 'PLAN_UPLOAD_LIMIT',
          actionUrl: isGuest ? '/auth/signin?callbackUrl=/interview' : '/interview/settings',
          actionLabel: isGuest ? 'ログインはこちら' : 'アップグレードはこちら',
        },
        { status: 400 }
      )
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
  } catch {
    console.error('[interview] upload-url preparation failed')
    return NextResponse.json(
      { success: false, error: 'アップロードの準備ができませんでした。しばらくしてから再度お試しください。', code: 'UPLOAD_UNAVAILABLE' },
      { status: 503 }
    )
  }
}
