import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateSignedUploadUrl } from '@/lib/gcs'

// 署名付きURLを生成（クライアントから直接GCSにアップロード用）
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, fileName, fileSize, mimeType } = body

    if (!projectId || !fileName || !fileSize) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています', details: 'projectId、fileName、fileSizeが必要です。' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック（5TB制限）
    const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 * 1024 // 5TB
    if (fileSize > MAX_FILE_SIZE) {
      const fileSizeGB = (fileSize / 1024 / 1024 / 1024).toFixed(2)
      const maxSizeGB = (MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)
      return NextResponse.json(
        {
          error: 'ファイルサイズが大きすぎます',
          details: `最大ファイルサイズ: ${maxSizeGB}GB（MAX）\n現在のファイルサイズ: ${fileSizeGB}GB`,
        },
        { status: 400 }
      )
    }

    // プロジェクトの所有権確認
    const project = await prisma.interviewProject.findFirst({
      where: {
        id: projectId,
        OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません', details: '指定されたプロジェクトIDが存在しないか、アクセス権限がありません。' },
        { status: 404 }
      )
    }

    // ファイルパスを生成
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `interview/${projectId}/${timestamp}-${sanitizedFileName}`

    // 署名付きURLを生成（1時間有効）
    const { signedUrl, publicUrl } = await generateSignedUploadUrl(
      filePath,
      mimeType || 'application/octet-stream',
      3600 // 1時間
    )

    console.log(`[INTERVIEW] Generated signed URL for: ${filePath}`)

    return NextResponse.json({
      signedUrl,
      filePath,
      publicUrl,
      expiresIn: 3600, // 1時間（秒）
    })
  } catch (error) {
    console.error('[INTERVIEW] Error generating signed URL:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    
    // 認証エラーの場合は401を返す
    const isAuthError = errorMessage.includes('認証情報') || 
                       errorMessage.includes('GOOGLE_APPLICATION_CREDENTIALS') ||
                       errorMessage.includes('credentials')
    
    return NextResponse.json(
      {
        error: '署名付きURLの生成に失敗しました',
        details: errorMessage,
      },
      { status: isAuthError ? 401 : 500 }
    )
  }
}

