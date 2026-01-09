import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

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

    // ファイルサイズチェック（4.75GB制限 - Vercel Blob Storageの上限）
    // 注意: Vercelのサーバーレス関数には4.5MBのリクエストボディサイズ制限があります
    // 4.5MBを超えるファイルはチャンクアップロードを使用します
    const MAX_FILE_SIZE = 4.75 * 1024 * 1024 * 1024 // 4.75GB（Vercel Blob Storageの上限）
    const CHUNK_THRESHOLD = 50 * 1024 * 1024 // 50MB（チャンクアップロードの閾値）
    
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeGB = (file.size / 1024 / 1024 / 1024).toFixed(2)
      const maxSizeGB = (MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(2)
      return NextResponse.json(
        {
          error: 'ファイルサイズが大きすぎます',
          details: `最大ファイルサイズ: ${maxSizeGB}GB（MAX）\n現在のファイルサイズ: ${fileSizeGB}GB\n\n${maxSizeGB}GBを超えるファイルはアップロードできません。`,
        },
        { status: 400 }
      )
    }
    
    // Vercelのサーバーレス関数の制限（4.5MB）を超える場合はチャンクアップロードを使用
    const VERCEL_LIMIT = 4.5 * 1024 * 1024 // 4.5MB
    if (file.size > VERCEL_LIMIT) {
      // 4.5MBを超える場合はチャンクアップロードにリダイレクト
      return NextResponse.json(
        {
          error: 'チャンクアップロードを使用してください',
          details: `ファイルサイズが${(VERCEL_LIMIT / 1024 / 1024).toFixed(0)}MBを超えているため、チャンクアップロードを使用してください。`,
          useChunkUpload: true,
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
    let project
    try {
      project = await prisma.interviewProject.findFirst({
        where: {
          id: projectId,
          OR: [{ userId: userId || undefined }, { guestId: guestId || undefined }],
        },
      })
    } catch (dbError) {
      console.error('[INTERVIEW] Database query error:', dbError)
      // Prismaエラーコードの判定
      if (dbError && typeof dbError === 'object' && 'code' in dbError) {
        const prismaError = dbError as { code: string }
        if (prismaError.code === 'P2021') {
          return NextResponse.json(
            {
              error: 'データベースのテーブルが存在しません',
              details: 'データベースのマイグレーションが必要です。管理者にお問い合わせください。',
            },
            { status: 503 }
          )
        } else if (prismaError.code === 'P1001' || prismaError.code === 'P1017') {
          return NextResponse.json(
            {
              error: 'データベースに接続できません',
              details: 'データベースサーバーに接続できませんでした。しばらくしてから再度お試しください。',
            },
            { status: 503 }
          )
        }
      }
      throw dbError
    }

    if (!project) {
      return NextResponse.json(
        { error: 'プロジェクトが見つかりません', details: '指定されたプロジェクトIDが存在しないか、アクセス権限がありません。' },
        { status: 404 }
      )
    }

    // ファイルタイプ判定
    const mimeType = file.type
    const fileNameLower = file.name.toLowerCase()
    const extension = fileNameLower.split('.').pop()

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

    // Vercel Blob Storageにアップロード
    const savedFileName = `${projectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const blobPath = `interview/${savedFileName}`
    
    let blob: { url: string; pathname: string; size: number }
    try {
      const buffer = await file.arrayBuffer()
      blob = await put(blobPath, buffer, {
        access: 'public',
        contentType: mimeType || undefined,
      })
      console.log(`[INTERVIEW] File uploaded to Blob Storage: ${blob.url}`)
    } catch (blobError) {
      console.error('[INTERVIEW] Failed to upload file to Blob Storage:', blobError)
      throw new Error(`ファイルのアップロードに失敗しました: ${blobError instanceof Error ? blobError.message : '不明なエラー'}`)
    }

    // DBに記録
    let material
    try {
      material = await prisma.interviewMaterial.create({
        data: {
          projectId,
          type: materialType,
          fileName: file.name,
          filePath: blob.pathname, // Blob pathnameを保存
          fileUrl: blob.url, // Blob URLを保存
          fileSize: blob.size || file.size,
          mimeType,
          status: 'UPLOADED',
        },
      })
    } catch (dbError) {
      console.error('[INTERVIEW] Database error when creating material:', dbError)
      // Prismaエラーコードの判定
      if (dbError && typeof dbError === 'object' && 'code' in dbError) {
        const prismaError = dbError as { code: string; meta?: any }
        if (prismaError.code === 'P2021') {
          throw new Error('データベースのテーブルが存在しません。データベースのマイグレーションが必要です。')
        } else if (prismaError.code === 'P2003') {
          throw new Error('プロジェクトが見つかりません。プロジェクトIDが無効です。')
        } else if (prismaError.code === 'P1001' || prismaError.code === 'P1017') {
          throw new Error('データベースに接続できません。')
        }
      }
      throw dbError
    }

    return NextResponse.json({ material })
  } catch (error) {
    console.error('[INTERVIEW] Material upload error:', error)
    console.error('[INTERVIEW] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Prismaエラーコードの判定
    let statusCode = 500
    let errorMessage = error instanceof Error ? error.message : '不明なエラー'
    
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string }
      if (prismaError.code === 'P2021') {
        errorMessage = 'データベースのテーブルが存在しません。データベースのマイグレーションが必要です。'
        statusCode = 503
      } else if (prismaError.code === 'P1001' || prismaError.code === 'P1017') {
        errorMessage = 'データベースに接続できません。'
        statusCode = 503
      }
    }
    
    console.error('[INTERVIEW] File info:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      projectId,
    })
    
    // エラーの種類に応じた詳細メッセージ
    let details = 'ファイルサイズや形式を確認してください。'
    if (errorMessage.includes('テーブルが存在しません') || errorMessage.includes('does not exist')) {
      details = 'データベースのテーブルが存在しません。\nデータベースのマイグレーションが必要です。Vercelのビルドログで「[db-push]」を確認してください。'
    } else if (errorMessage.includes('プロジェクトが見つかりません') || errorMessage.includes('プロジェクトIDが無効')) {
      details = 'プロジェクトが見つかりません。\nプロジェクトの作成に失敗している可能性があります。もう一度お試しください。'
    } else if (errorMessage.includes('データベースに接続できません')) {
      details = 'データベースに接続できません。\nデータベースサーバーに接続できませんでした。しばらくしてから再度お試しください。'
    } else if (errorMessage.includes('ENOSPC') || errorMessage.includes('ENOENT')) {
      details = 'ディスク容量が不足しているか、ファイルシステムへのアクセス権限がありません。'
    } else if (errorMessage.includes('EACCES')) {
      details = 'ファイルへの書き込み権限がありません。'
    } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      details = 'ファイルのアップロードがタイムアウトしました。ファイルサイズが大きすぎる可能性があります。'
    } else if (errorMessage.includes('memory') || errorMessage.includes('Memory')) {
      details = 'メモリ不足が発生しました。ファイルサイズが大きすぎる可能性があります。'
    } else if (errorMessage.includes('ファイルの読み込みに失敗')) {
      details = 'ファイルの読み込みに失敗しました。\nファイルが破損しているか、アクセス権限がありません。'
    } else if (errorMessage.includes('ファイルの保存に失敗')) {
      details = 'ファイルの保存に失敗しました。\nサーバーのストレージに問題がある可能性があります。'
    }
    
    return NextResponse.json(
      {
        error: 'ファイルのアップロードに失敗しました',
        details: `${details}\nエラー詳細: ${errorMessage}`,
      },
      { status: statusCode }
    )
  }
}

