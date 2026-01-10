import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// アップロード完了を通知（クライアントから直接GCSにアップロードした後）
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
    const { projectId, filePath, fileName, fileSize, mimeType, materialType } = body

    if (!projectId || !filePath || !fileName || !fileSize) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています', details: 'projectId、filePath、fileName、fileSizeが必要です。' },
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

    // 公開URLを生成
    const bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
    const fileUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`

    // データベースに記録
    const material = await prisma.interviewMaterial.create({
      data: {
        projectId,
        type: materialType || null,
        fileName: fileName,
        filePath: filePath,
        fileUrl: fileUrl,
        fileSize: fileSize,
        mimeType: mimeType || null,
        status: 'UPLOADED',
      },
    })

    console.log(`[INTERVIEW] Material created after direct upload: ${material.id}, URL: ${fileUrl}`)

    return NextResponse.json({
      success: true,
      material,
      message: 'ファイルのアップロードが完了しました',
    })
  } catch (error) {
    console.error('[INTERVIEW] Error completing upload:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    return NextResponse.json(
      {
        error: 'アップロード完了の処理に失敗しました',
        details: `エラー詳細: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}

