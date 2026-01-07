import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// 素材アップロード（音声・動画・テキスト・PDF等）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const projectId = formData.get('projectId') as string
    const file = formData.get('file') as File

    if (!projectId || !file) {
      return NextResponse.json(
        { error: 'プロジェクトIDまたはファイルが指定されていません', details: '必須パラメータが不足しています。' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック（500MB制限）
    const MAX_FILE_SIZE = 500 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'ファイルサイズが大きすぎます',
          details: `最大ファイルサイズは500MBです。現在のファイルサイズ: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: '空のファイルです', details: 'ファイルが空のため、アップロードできません。' },
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

    // ファイルタイプ判定
    const mimeType = file.type
    const fileName = file.name.toLowerCase()
    const extension = fileName.split('.').pop()

    let materialType = 'text'
    const isAudio = mimeType.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(extension || '')
    const isVideo = mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm'].includes(extension || '')
    const isPdf = mimeType === 'application/pdf' || extension === 'pdf'
    const isText = mimeType.startsWith('text/') || ['txt', 'md'].includes(extension || '') || extension === 'docx'

    if (isAudio) materialType = 'audio'
    else if (isVideo) materialType = 'video'
    else if (isPdf) materialType = 'pdf'
    else if (isText) materialType = 'text'
    else {
      return NextResponse.json(
        {
          error: '対応していないファイル形式です',
          details: `対応形式: 音声（MP3, WAV, M4A）、動画（MP4, MOV, AVI）、テキスト（TXT, DOCX）、PDF。\n検出された形式: ${mimeType || '不明'}（拡張子: ${extension || 'なし'}）`,
        },
        { status: 400 }
      )
    }

    // ファイル保存
    const uploadDir = join(process.cwd(), 'uploads', 'interview', projectId)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const fileName = `${Date.now()}-${file.name}`
    const filePath = join(uploadDir, fileName)
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    await writeFile(filePath, buffer)

    // DBに記録
    const material = await prisma.interviewMaterial.create({
      data: {
        projectId,
        type: materialType,
        fileName: file.name,
        filePath: `/uploads/interview/${projectId}/${fileName}`,
        fileSize: buffer.length,
        mimeType,
        status: 'UPLOADED',
      },
    })

    return NextResponse.json({ material })
  } catch (error) {
    console.error('[INTERVIEW] Material upload error:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    return NextResponse.json(
      {
        error: 'ファイルのアップロードに失敗しました',
        details: `エラー詳細: ${errorMessage}。ファイルサイズや形式を確認してください。問題が続く場合は、サポートにお問い合わせください。`,
      },
      { status: 500 }
    )
  }
}

