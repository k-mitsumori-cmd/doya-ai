import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, appendFile, readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

// Vercel等のサーバーレス環境では /tmp を使用
function getUploadBaseDir() {
  const envDir = process.env.INTERVIEW_STORAGE_DIR || process.env.NEXT_PUBLIC_INTERVIEW_STORAGE_DIR
  if (envDir) return envDir

  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp/interview'
  }

  return join(process.cwd(), 'uploads', 'interview')
}

// チャンクアップロード（大きなファイル用）
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
    const chunk = formData.get('chunk') as File | null
    const chunkIndexStr = formData.get('chunkIndex') as string
    const totalChunksStr = formData.get('totalChunks') as string
    const fileName = formData.get('fileName') as string
    const fileSizeStr = formData.get('fileSize') as string
    const mimeType = formData.get('mimeType') as string
    const tempFileName = formData.get('tempFileName') as string

    // パラメータの検証とデバッグ情報
    const missingParams: string[] = []
    if (!projectId) missingParams.push('projectId')
    if (!chunk) missingParams.push('chunk')
    if (!chunkIndexStr || isNaN(parseInt(chunkIndexStr))) missingParams.push('chunkIndex')
    if (!totalChunksStr || isNaN(parseInt(totalChunksStr))) missingParams.push('totalChunks')
    if (!fileName) missingParams.push('fileName')
    if (!tempFileName) missingParams.push('tempFileName')

    if (missingParams.length > 0) {
      console.error('[INTERVIEW] Missing parameters:', missingParams)
      console.error('[INTERVIEW] Received parameters:', {
        projectId: projectId || 'missing',
        chunk: chunk ? `File(${chunk.size} bytes)` : 'missing',
        chunkIndex: chunkIndexStr || 'missing',
        totalChunks: totalChunksStr || 'missing',
        fileName: fileName || 'missing',
        tempFileName: tempFileName || 'missing',
        mimeType: mimeType || 'missing',
        fileSize: fileSizeStr || 'missing',
      })
      return NextResponse.json(
        { 
          error: '必須パラメータが不足しています', 
          details: `不足しているパラメータ: ${missingParams.join(', ')}\n必要なパラメータ: projectId, chunk, chunkIndex, totalChunks, fileName, tempFileName` 
        },
        { status: 400 }
      )
    }

    const chunkIndex = parseInt(chunkIndexStr)
    const totalChunks = parseInt(totalChunksStr)
    const fileSize = parseInt(fileSizeStr)

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

    // チャンクの保存先ディレクトリ
    const baseDir = getUploadBaseDir()
    const chunkDir = join(baseDir, 'chunks', projectId)
    // tempFileNameはクライアント側から送信される（すべてのチャンクで同じ値）
    const chunkFilePath = join(chunkDir, `${tempFileName}.chunk.${chunkIndex}`)

    try {
      // チャンクディレクトリの作成
      if (!existsSync(chunkDir)) {
        await mkdir(chunkDir, { recursive: true })
      }

      // チャンクを保存
      const bytes = await chunk.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(chunkFilePath, buffer)

      console.log(`[INTERVIEW] Chunk ${chunkIndex + 1}/${totalChunks} saved: ${chunkFilePath}`)

      // すべてのチャンクがアップロードされたか確認
      const uploadedChunks: number[] = []
      for (let i = 0; i < totalChunks; i++) {
        const chunkFile = join(chunkDir, `${tempFileName}.chunk.${i}`)
        if (existsSync(chunkFile)) {
          uploadedChunks.push(i)
        }
      }

      console.log(`[INTERVIEW] Uploaded chunks: ${uploadedChunks.length}/${totalChunks}`, uploadedChunks)

      // すべてのチャンクが揃った場合、ファイルを結合
      if (uploadedChunks.length === totalChunks) {
        console.log(`[INTERVIEW] All chunks received. Starting file merge...`)
        const finalDir = join(baseDir, projectId)
        if (!existsSync(finalDir)) {
          await mkdir(finalDir, { recursive: true })
        }

        const savedFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`
        const finalFilePath = join(finalDir, savedFileName)

        // チャンクを順番に結合
        for (let i = 0; i < totalChunks; i++) {
          const chunkFile = join(chunkDir, `${tempFileName}.chunk.${i}`)
          const chunkData = await readFile(chunkFile)
          if (i === 0) {
            await writeFile(finalFilePath, chunkData)
          } else {
            await appendFile(finalFilePath, chunkData)
          }
          // チャンクファイルを削除
          try {
            const { unlink } = await import('fs/promises')
            await unlink(chunkFile)
          } catch (e) {
            console.warn(`[INTERVIEW] Failed to delete chunk file: ${chunkFile}`, e)
          }
        }

        // ファイルタイプ判定
        const fileNameLower = fileName.toLowerCase()
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

        // ファイルサイズを確認
        const { stat } = await import('fs/promises')
        const finalFileStats = await stat(finalFilePath)
        const relativePath = process.env.VERCEL 
          ? finalFilePath
          : `/uploads/interview/${projectId}/${savedFileName}`

        // DBに記録
        let material
        try {
          material = await prisma.interviewMaterial.create({
            data: {
              projectId,
              type: materialType,
              fileName: fileName,
              filePath: relativePath,
              fileSize: finalFileStats.size,
              mimeType,
              status: 'UPLOADED',
            },
          })
        } catch (dbError) {
          console.error('[INTERVIEW] Database error when creating material:', dbError)
          throw dbError
        }

        console.log(`[INTERVIEW] File merge completed. Material ID: ${material.id}`)
        
        return NextResponse.json({
          completed: true,
          material,
          message: 'ファイルのアップロードが完了しました',
        })
      }

      // チャンクがまだ揃っていない場合
      return NextResponse.json({
        completed: false,
        uploadedChunks: uploadedChunks.length,
        totalChunks,
        progress: Math.round((uploadedChunks.length / totalChunks) * 100),
      })
    } catch (fileError) {
      console.error('[INTERVIEW] File operation error:', fileError)
      throw fileError
    }
  } catch (error) {
    console.error('[INTERVIEW] Chunk upload error:', error)
    const errorMessage = error instanceof Error ? error.message : '不明なエラー'
    
    return NextResponse.json(
      {
        error: 'チャンクのアップロードに失敗しました',
        details: `エラー詳細: ${errorMessage}`,
      },
      { status: 500 }
    )
  }
}

