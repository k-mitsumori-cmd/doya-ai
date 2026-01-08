import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import OpenAI from 'openai'

// Vercel等のサーバーレス環境では /tmp を使用
function getUploadBaseDir() {
  const envDir = process.env.INTERVIEW_STORAGE_DIR || process.env.NEXT_PUBLIC_INTERVIEW_STORAGE_DIR
  if (envDir) return envDir
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return '/tmp/interview'
  }
  return join(process.cwd(), 'uploads', 'interview')
}

// 文字起こし実行（音声・動画ファイルから）
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { materialId, projectId } = body

    if (!materialId || !projectId) {
      return NextResponse.json({ error: 'Missing materialId or projectId' }, { status: 400 })
    }

    // 素材取得
    const material = await prisma.interviewMaterial.findFirst({
      where: {
        id: materialId,
        projectId,
        OR: [
          { project: { userId: userId || undefined } },
          { project: { guestId: guestId || undefined } },
        ],
      },
      include: {
        project: true,
      },
    })

    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    if (material.type !== 'audio' && material.type !== 'video') {
      return NextResponse.json({ error: 'Only audio/video files can be transcribed' }, { status: 400 })
    }

    // ファイルパスを解決
    const baseDir = getUploadBaseDir()
    let filePath: string

    if (material.filePath.startsWith('/')) {
      // 絶対パスの場合（Vercel環境）
      filePath = material.filePath
    } else {
      // 相対パスの場合
      filePath = join(baseDir, material.filePath)
    }

    // ファイルの存在確認
    if (!existsSync(filePath)) {
      console.error(`[INTERVIEW] File not found: ${filePath}`)
      return NextResponse.json(
        { error: 'ファイルが見つかりません', details: `ファイルパス: ${filePath}` },
        { status: 404 }
      )
    }

    console.log(`[INTERVIEW] Starting transcription for file: ${filePath}`)

    // OpenAI Whisper APIを使用して文字起こし
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.error('[INTERVIEW] OPENAI_API_KEY is not set')
      return NextResponse.json(
        { error: '文字起こし機能の設定が完了していません', details: 'OPENAI_API_KEYが設定されていません' },
        { status: 500 }
      )
    }

    const openai = new OpenAI({ apiKey: openaiApiKey })

    // ファイルを読み込む
    let fileBuffer: Buffer
    try {
      fileBuffer = await readFile(filePath)
      console.log(`[INTERVIEW] File read successfully: ${fileBuffer.length} bytes`)
    } catch (fileError) {
      console.error('[INTERVIEW] Failed to read file:', fileError)
      return NextResponse.json(
        { error: 'ファイルの読み込みに失敗しました', details: fileError instanceof Error ? fileError.message : '不明なエラー' },
        { status: 500 }
      )
    }

    // OpenAI Whisper APIで文字起こし
    let transcriptionText: string
    try {
      console.log(`[INTERVIEW] Calling OpenAI Whisper API...`)
      
      // OpenAI SDK v4では、File、Blob、Buffer、Streamを直接受け取れる
      // Node.js環境では、Bufferを直接送信できる
      // ファイル名とMIMEタイプを含むFile-likeオブジェクトを作成
      const fileLike = {
        name: material.fileName,
        type: material.mimeType || 'audio/mpeg',
        stream: () => {
          const { Readable } = require('stream')
          return Readable.from([fileBuffer])
        },
        arrayBuffer: async () => fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
        size: fileBuffer.length,
      } as any

      const transcription = await openai.audio.transcriptions.create({
        file: fileLike,
        model: 'whisper-1',
        language: 'ja', // 日本語を指定
        response_format: 'text',
      })

      transcriptionText = transcription as unknown as string
      console.log(`[INTERVIEW] Transcription completed: ${transcriptionText.length} characters`)
    } catch (openaiError: any) {
      console.error('[INTERVIEW] OpenAI Whisper API error:', openaiError)
      
      let errorMessage = '文字起こしに失敗しました'
      let errorDetails = ''

      if (openaiError?.response?.status === 401) {
        errorMessage = 'OpenAI APIキーが無効です'
        errorDetails = 'OPENAI_API_KEYを確認してください'
      } else if (openaiError?.response?.status === 429) {
        errorMessage = 'APIの利用制限に達しました'
        errorDetails = 'しばらく待ってから再度お試しください'
      } else if (openaiError?.message) {
        errorDetails = openaiError.message
      }

      return NextResponse.json(
        { error: errorMessage, details: errorDetails },
        { status: 500 }
      )
    }

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      return NextResponse.json(
        { error: '文字起こし結果が空です', details: '音声が検出されませんでした' },
        { status: 400 }
      )
    }

    // 文字起こし結果を保存
    const transcription = await prisma.interviewTranscription.create({
      data: {
        projectId,
        materialId,
        text: transcriptionText,
        provider: 'openai-whisper',
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'COMPLETED' },
    })

    console.log(`[INTERVIEW] Transcription saved: ${transcription.id}`)

    return NextResponse.json({ transcription })
  } catch (error) {
    console.error('[INTERVIEW] Transcription error:', error)
    console.error('[INTERVIEW] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      {
        error: '文字起こしに失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}

