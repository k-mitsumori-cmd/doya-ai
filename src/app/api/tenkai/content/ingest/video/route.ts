// ============================================
// POST /api/tenkai/content/ingest/video
// ============================================
// 動画ファイル → Supabase Storage → AssemblyAI文字起こし

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUploadSignedUrl, buildStoragePath } from '@/lib/tenkai/storage'
import { incrementProjectCount } from '@/lib/tenkai/access'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { fileName, mimeType, fileSize, title } = body as {
      fileName: string
      mimeType: string
      fileSize: number
      title?: string
    }

    if (!fileName || !mimeType) {
      return NextResponse.json(
        { error: 'fileName, mimeType は必須です' },
        { status: 400 }
      )
    }

    // 動画/音声ファイルのみ許可
    if (!mimeType.startsWith('video/') && !mimeType.startsWith('audio/')) {
      return NextResponse.json(
        { error: '動画または音声ファイルのみ対応しています' },
        { status: 400 }
      )
    }

    // ファイルサイズ制限 (500MB)
    const maxSize = 500 * 1024 * 1024
    const numericSize = typeof fileSize === 'number' ? fileSize : 0
    if (numericSize > maxSize) {
      return NextResponse.json(
        { error: 'ファイルサイズが上限 (500MB) を超えています' },
        { status: 400 }
      )
    }

    // TenkaiProject作成（まずステータスdraftで作成）
    const project = await prisma.tenkaiProject.create({
      data: {
        userId,
        title: title || fileName,
        inputType: 'video',
        status: 'draft',
        language: 'ja',
      },
    })

    // ストレージパス生成
    const storagePath = buildStoragePath({
      userId,
      projectId: project.id,
      fileName,
    })

    // 署名付きアップロードURL生成
    const uploadData = await getUploadSignedUrl(storagePath)

    // プロジェクトにストレージURLを保存
    await prisma.tenkaiProject.update({
      where: { id: project.id },
      data: { inputVideoUrl: storagePath },
    })

    await incrementProjectCount(userId)

    return NextResponse.json({
      projectId: project.id,
      signedUrl: uploadData.signedUrl,
      path: uploadData.path,
      token: uploadData.token,
      storagePath,
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] ingest/video error:', message)
    return NextResponse.json(
      { error: message || '動画アップロード準備に失敗しました' },
      { status: 500 }
    )
  }
}
