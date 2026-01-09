import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import OpenAI from 'openai'
import { getFileFromGCS, generateSignedDownloadUrl } from '@/lib/gcs'

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

    // ファイルサイズをチェック
    // OpenAI Whisper APIの制限: 25MB
    // 25MBを超える場合は、GCSのURLを直接使用して処理を試みる
    const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024 // 25MB
    const USE_LARGE_FILE_MODE = material.fileSize && material.fileSize > MAX_SINGLE_FILE_SIZE
    
    if (USE_LARGE_FILE_MODE) {
      console.log(`[INTERVIEW] Large file detected (${(material.fileSize! / 1024 / 1024).toFixed(2)} MB), attempting direct URL transcription`)
    }

    // 大きなファイルの場合は、ストリーミングで処理を試みる
    if (USE_LARGE_FILE_MODE && material.fileUrl && material.fileUrl.includes('storage.googleapis.com')) {
      console.log(`[INTERVIEW] Attempting to transcribe large file using streaming`)
      try {
        // GCSからファイルをストリーミングで取得して処理
        // ただし、Vercelのサーバーレス関数のメモリ制限により、大きなファイルは処理できません
        // そのため、ファイルをチャンクに分割して処理する必要があります
        
        // URLからパスを抽出
        const urlPattern = /https:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/
        const match = material.fileUrl.match(urlPattern)
        
        if (match && match[1]) {
          const filePath = decodeURIComponent(match[1])
          
          // ファイルをストリーミングで取得（範囲リクエストを使用）
          // ただし、音声/動画ファイルの場合は、適切な分割ポイントで切る必要があります
          // 現在の実装では、ファイル全体を取得して処理します
          
          // 注意: この方法は、Vercelのサーバーレス関数のメモリ制限により、
          // 大きなファイル（25MB以上）では動作しません
          // 実際の実装では、Cloud RunやCloud Functionsなどの別のサービスを使用することを推奨します
          
          const fileSizeMB = (material.fileSize! / 1024 / 1024).toFixed(2)
          console.warn(`[INTERVIEW] Large file (${fileSizeMB} MB) cannot be processed in Vercel serverless function`)
          
          return NextResponse.json(
            { 
              error: 'ファイルサイズが大きすぎます',
              details: `現在の実装では、25MBを超えるファイルの文字起こしには対応していません。\n現在のファイルサイズ: ${fileSizeMB} MB\n\n対処方法:\n1. ファイルを分割してアップロードしてください（推奨: 20MB以下）\n2. 動画ファイルの場合は、音声のみを抽出してください\n3. 音声ファイルの場合は、圧縮してからアップロードしてください\n\n将来的には、大きなファイルの自動分割機能を追加予定です。`
            },
            { status: 413 }
          )
        }
      } catch (error) {
        console.error('[INTERVIEW] Large file processing error:', error)
        throw error
      }
    }

    // ファイルを読み込む（Google Cloud Storageから取得、またはローカルファイルシステムから）
    let fileBuffer: Buffer
    try {
      // 優先順位: fileUrl (完全なURL) > filePath (GCS pathname or ローカルファイルシステム)
      if (material.fileUrl) {
        // fileUrlが存在する場合
        if (material.fileUrl.includes('storage.googleapis.com')) {
          // Google Cloud StorageのURLの場合
          console.log(`[INTERVIEW] Fetching file from Google Cloud Storage: ${material.fileUrl}`)
          try {
            fileBuffer = await getFileFromGCS(material.fileUrl)
            console.log(`[INTERVIEW] File read from Google Cloud Storage successfully: ${fileBuffer.length} bytes`)
          } catch (gcsError) {
            // GCSからの取得に失敗した場合、直接fetchを試行
            console.warn(`[INTERVIEW] Failed to get file from GCS, trying direct fetch: ${gcsError}`)
            const response = await fetch(material.fileUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`)
            }
            const arrayBuffer = await response.arrayBuffer()
            fileBuffer = Buffer.from(arrayBuffer)
            console.log(`[INTERVIEW] File read from URL successfully: ${fileBuffer.length} bytes`)
          }
        } else {
          // その他のURL（直接fetch）
          console.log(`[INTERVIEW] Fetching file from URL: ${material.fileUrl}`)
          const response = await fetch(material.fileUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`)
          }
          const arrayBuffer = await response.arrayBuffer()
          fileBuffer = Buffer.from(arrayBuffer)
          console.log(`[INTERVIEW] File read from URL successfully: ${fileBuffer.length} bytes`)
        }
      } else if (material.filePath) {
        // filePathがGCS pathnameの場合（例: interview/projectId/filename）
        // fileUrlがない場合は、GCSから直接取得を試行
        if (!material.filePath.startsWith('http://') && !material.filePath.startsWith('https://') && !material.filePath.startsWith('/')) {
          // GCS pathnameの場合、fileUrlを構築して取得を試行
          console.log(`[INTERVIEW] filePath is a GCS pathname, trying to construct URL: ${material.filePath}`)
          // GCS URLを構築
          const bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
          const gcsUrl = `https://storage.googleapis.com/${bucketName}/${material.filePath}`
          try {
            fileBuffer = await getFileFromGCS(gcsUrl)
            console.log(`[INTERVIEW] File read from Google Cloud Storage successfully: ${fileBuffer.length} bytes`)
          } catch (gcsError) {
            console.error(`[INTERVIEW] Failed to get file from GCS: ${gcsError}`)
            return NextResponse.json(
              { error: 'ファイルの取得に失敗しました', details: 'Google Cloud Storageからファイルを取得できませんでした。' },
              { status: 404 }
            )
          }
        } else {
          // ローカルファイルシステムから読み込み（フォールバック）
          const baseDir = getUploadBaseDir()
          let filePath: string

          if (material.filePath && material.filePath.startsWith('/')) {
            // 絶対パスの場合（Vercel環境）
            filePath = material.filePath
          } else {
            // 相対パスの場合
            filePath = join(baseDir, material.filePath || '')
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
          fileBuffer = await readFile(filePath)
          console.log(`[INTERVIEW] File read from filesystem successfully: ${fileBuffer.length} bytes`)
        }
      } else {
        return NextResponse.json(
          { error: 'ファイルのURLまたはパスが設定されていません', details: 'ファイルを取得するための情報が不足しています。' },
          { status: 404 }
        )
      }
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
      
      // OpenAI SDK v4では、File、Blob、Buffer、ReadableStreamを直接受け取れる
      // Node.js環境では、Bufferを直接渡すのが最も簡単
      // ただし、Fileオブジェクトが必要な場合は、BlobからFileを作成する
      // Node.js 18+ではFileオブジェクトが利用可能
      let fileInput: File | Blob | Buffer
      
      // Node.js環境でFileオブジェクトが利用可能か確認
      if (typeof File !== 'undefined') {
        // Fileオブジェクトが利用可能な場合
        const blob = new Blob([fileBuffer], { type: material.mimeType || 'audio/mpeg' })
        fileInput = new File([blob], material.fileName, { type: material.mimeType || 'audio/mpeg' })
      } else {
        // Fileオブジェクトが利用できない場合、Blobを使用
        fileInput = new Blob([fileBuffer], { type: material.mimeType || 'audio/mpeg' })
      }

      const transcription = await openai.audio.transcriptions.create({
        file: fileInput as any, // File、Blob、またはBufferを受け取れる
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

