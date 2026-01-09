import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import OpenAI from 'openai'
import { getFileFromGCS, getFileChunkFromGCS } from '@/lib/gcs'
import { notifyApiError } from '@/lib/errorHandler'

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
  let materialId: string | undefined
  let projectId: string | undefined
  
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    materialId = body.materialId
    projectId = body.projectId

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
    // 1GBまでのファイルを処理するため、チャンク分割処理を実装
    const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024 // 25MB
    const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
    const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB（安全マージンを含む）
    const USE_CHUNK_MODE = material.fileSize && material.fileSize > MAX_SINGLE_FILE_SIZE && material.fileSize <= MAX_FILE_SIZE
    
    if (USE_CHUNK_MODE) {
      console.log(`[INTERVIEW] Large file detected (${(material.fileSize! / 1024 / 1024).toFixed(2)} MB), using chunk processing`)
    } else if (material.fileSize && material.fileSize > MAX_FILE_SIZE) {
      const fileSizeMB = (material.fileSize / 1024 / 1024).toFixed(2)
      return NextResponse.json(
        { 
          error: 'ファイルサイズが大きすぎます',
          details: `最大1GBまでのファイルに対応しています。\n現在のファイルサイズ: ${fileSizeMB} MB\n\n対処方法:\n1. ファイルを分割してアップロードしてください\n2. 動画ファイルの場合は、音声のみを抽出してください`
        },
        { status: 413 }
      )
    }

    // ファイルを読み込む（Google Cloud Storageから取得、またはローカルファイルシステムから）
    // パフォーマンス最適化: タイムアウトを設定して長時間待機を防ぐ
    const FILE_FETCH_TIMEOUT = 30000 // 30秒
    let fileBuffer: Buffer
    
    try {
      // ファイル取得処理をPromiseでラップしてタイムアウトを設定
      const fetchFilePromise = (async () => {
        // 優先順位: fileUrl (完全なURL) > filePath (GCS pathname or ローカルファイルシステム)
        if (material.fileUrl) {
          // fileUrlが存在する場合
          if (material.fileUrl.includes('storage.googleapis.com')) {
            // Google Cloud StorageのURLの場合
            console.log(`[INTERVIEW] Fetching file from Google Cloud Storage: ${material.fileUrl}`)
            try {
              return await getFileFromGCS(material.fileUrl)
            } catch (gcsError) {
              // GCSからの取得に失敗した場合、直接fetchを試行
              console.warn(`[INTERVIEW] Failed to get file from GCS, trying direct fetch: ${gcsError}`)
              const response = await fetch(material.fileUrl)
              if (!response.ok) {
                throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`)
              }
              const arrayBuffer = await response.arrayBuffer()
              return Buffer.from(arrayBuffer)
            }
          } else {
            // その他のURL（直接fetch）
            console.log(`[INTERVIEW] Fetching file from URL: ${material.fileUrl}`)
            const response = await fetch(material.fileUrl)
            if (!response.ok) {
              throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`)
            }
            const arrayBuffer = await response.arrayBuffer()
            return Buffer.from(arrayBuffer)
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
              return await getFileFromGCS(gcsUrl)
            } catch (gcsError) {
              console.error(`[INTERVIEW] Failed to get file from GCS: ${gcsError}`)
              throw new Error('Google Cloud Storageからファイルを取得できませんでした。')
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
              throw new Error(`ファイルが見つかりません: ${filePath}`)
            }

            console.log(`[INTERVIEW] Starting transcription for file: ${filePath}`)
            return await readFile(filePath)
          }
        } else {
          throw new Error('ファイルのURLまたはパスが設定されていません')
        }
      })()

      // タイムアウト処理
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`ファイルの取得がタイムアウトしました（${FILE_FETCH_TIMEOUT / 1000}秒）`))
        }, FILE_FETCH_TIMEOUT)
      })

      fileBuffer = await Promise.race([fetchFilePromise, timeoutPromise])
      console.log(`[INTERVIEW] File read successfully: ${fileBuffer.length} bytes`)
    } catch (fileError) {
      console.error('[INTERVIEW] Failed to read file:', fileError)
      const errorMessage = fileError instanceof Error ? fileError.message : '不明なエラー'
      return NextResponse.json(
        { 
          error: 'ファイルの読み込みに失敗しました', 
          details: errorMessage 
        },
        { status: 500 }
      )
    }

    // OpenAI Whisper APIで文字起こし
    let transcriptionText: string
    try {
      const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024 // 25MB
      const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB
      
      // 大きなファイルの場合はチャンク分割処理
      if (USE_CHUNK_MODE && material.fileUrl && material.fileUrl.includes('storage.googleapis.com')) {
        console.log(`[INTERVIEW] Processing large file in chunks (${(material.fileSize! / 1024 / 1024).toFixed(2)} MB)`)
        
        const totalSize = material.fileSize!
        const chunks: Buffer[] = []
        const chunkCount = Math.ceil(totalSize / CHUNK_SIZE)
        
        console.log(`[INTERVIEW] Splitting file into ${chunkCount} chunks`)
        
        // 各チャンクを順次取得（メモリ使用量を抑えるため）
        for (let i = 0; i < chunkCount; i++) {
          const startByte = i * CHUNK_SIZE
          const endByte = Math.min(startByte + CHUNK_SIZE - 1, totalSize - 1)
          
          console.log(`[INTERVIEW] Fetching chunk ${i + 1}/${chunkCount} (bytes ${startByte}-${endByte})`)
          
          try {
            const chunk = await getFileChunkFromGCS(material.fileUrl, startByte, endByte)
            chunks.push(chunk)
            console.log(`[INTERVIEW] Chunk ${i + 1} fetched: ${(chunk.length / 1024 / 1024).toFixed(2)} MB`)
          } catch (chunkError) {
            console.error(`[INTERVIEW] Failed to fetch chunk ${i + 1}:`, chunkError)
            throw new Error(`チャンク ${i + 1} の取得に失敗しました: ${chunkError instanceof Error ? chunkError.message : '不明なエラー'}`)
          }
        }
        
        // 各チャンクを順次処理して文字起こし
        const transcriptionParts: string[] = []
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]
          console.log(`[INTERVIEW] Processing chunk ${i + 1}/${chunks.length} (${(chunk.length / 1024 / 1024).toFixed(2)} MB)`)
          
          try {
            // チャンクが25MBを超える場合はスキップ（通常は発生しない）
            if (chunk.length > MAX_SINGLE_FILE_SIZE) {
              console.warn(`[INTERVIEW] Chunk ${i + 1} is too large (${(chunk.length / 1024 / 1024).toFixed(2)} MB), skipping`)
              transcriptionParts.push(`[チャンク ${i + 1}: サイズが大きすぎるためスキップしました]`)
              continue
            }
            
            let fileInput: File | Blob | Buffer
            if (typeof File !== 'undefined') {
              fileInput = new File([chunk], `${material.fileName}.chunk${i + 1}`, { type: material.mimeType || 'audio/mpeg' })
            } else {
              fileInput = new Blob([chunk], { type: material.mimeType || 'audio/mpeg' })
            }
            
            const OPENAI_API_TIMEOUT = Math.max(300000, chunk.length / 1024 / 1024 * 10000)
            
            const transcriptionPromise = openai.audio.transcriptions.create({
              file: fileInput as any,
              model: 'whisper-1',
              language: 'ja',
              response_format: 'text',
            })
            
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`チャンク ${i + 1} の処理がタイムアウトしました`))
              }, OPENAI_API_TIMEOUT)
            })
            
            const chunkTranscription = await Promise.race([transcriptionPromise, timeoutPromise])
            const chunkText = chunkTranscription as unknown as string
            
            if (chunkText && chunkText.trim().length > 0) {
              transcriptionParts.push(chunkText.trim())
              console.log(`[INTERVIEW] Chunk ${i + 1} completed: ${chunkText.length} characters`)
            } else {
              console.warn(`[INTERVIEW] Chunk ${i + 1} produced empty transcription`)
            }
          } catch (chunkError: any) {
            console.error(`[INTERVIEW] Failed to transcribe chunk ${i + 1}:`, chunkError)
            // チャンクの処理に失敗した場合は、エラーメッセージを追加して続行
            transcriptionParts.push(`[チャンク ${i + 1} の処理に失敗しました: ${chunkError?.message || '不明なエラー'}]`)
          }
        }
        
        // すべてのチャンクの結果を結合
        transcriptionText = transcriptionParts.join('\n\n')
        console.log(`[INTERVIEW] All chunks processed. Total length: ${transcriptionText.length} characters`)
        
        if (!transcriptionText || transcriptionText.trim().length === 0) {
          throw new Error('すべてのチャンクの処理に失敗しました')
        }
      } else {
        // 通常の処理（25MB以下のファイル）
        if (fileBuffer.length > MAX_SINGLE_FILE_SIZE) {
          const fileSizeMB = (fileBuffer.length / 1024 / 1024).toFixed(2)
          const maxSizeMB = (MAX_SINGLE_FILE_SIZE / 1024 / 1024).toFixed(0)
          console.warn(`[INTERVIEW] File size (${fileSizeMB} MB) exceeds limit (${maxSizeMB} MB)`)
          return NextResponse.json(
            { 
              error: 'ファイルサイズが大きすぎます',
              details: `文字起こし機能は最大${maxSizeMB}MBのファイルに対応しています。\n現在のファイルサイズ: ${fileSizeMB} MB\n\n対処方法:\n1. ファイルを分割してアップロードしてください（推奨: 20MB以下）\n2. 動画ファイルの場合は、音声のみを抽出してください\n3. 音声ファイルの場合は、圧縮してからアップロードしてください`
            },
            { status: 413 }
          )
        }
        
        console.log(`[INTERVIEW] Calling OpenAI Whisper API... (file size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)} MB)`)
        
        let fileInput: File | Blob | Buffer
        if (typeof File !== 'undefined') {
          fileInput = new File([fileBuffer], material.fileName, { type: material.mimeType || 'audio/mpeg' })
        } else {
          fileInput = new Blob([fileBuffer], { type: material.mimeType || 'audio/mpeg' })
        }

        const OPENAI_API_TIMEOUT = Math.max(300000, fileBuffer.length / 1024 / 1024 * 10000)
        
        const transcriptionPromise = openai.audio.transcriptions.create({
          file: fileInput as any,
          model: 'whisper-1',
          language: 'ja',
          response_format: 'text',
        })

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`OpenAI API呼び出しがタイムアウトしました（${(OPENAI_API_TIMEOUT / 1000 / 60).toFixed(1)}分）`))
          }, OPENAI_API_TIMEOUT)
        })

        const transcription = await Promise.race([transcriptionPromise, timeoutPromise])
        transcriptionText = transcription as unknown as string
        console.log(`[INTERVIEW] Transcription completed: ${transcriptionText.length} characters`)
      }
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

    // パフォーマンス最適化: データベース操作を並行実行（依存関係がないため）
    // エラーハンドリングを強化: Promise.allSettledを使用して、一方が失敗しても他方を継続
    try {
      const results = await Promise.allSettled([
        // 文字起こし結果を保存
        prisma.interviewTranscription.create({
          data: {
            projectId,
            materialId,
            text: transcriptionText,
            provider: 'openai-whisper',
          },
        }),
        // 素材のステータスを更新
        prisma.interviewMaterial.update({
          where: { id: materialId },
          data: { status: 'COMPLETED' },
        }),
      ])

      // 結果をチェック
      const transcriptionResult = results[0]
      const materialUpdateResult = results[1]

      // エラーチェック: 両方の操作が成功したか確認
      if (transcriptionResult.status === 'rejected') {
        console.error('[INTERVIEW] Failed to save transcription:', transcriptionResult.reason)
        // 素材の更新は成功した可能性があるため、ロールバックを試みる
        if (materialUpdateResult.status === 'fulfilled') {
          try {
            await prisma.interviewMaterial.update({
              where: { id: materialId },
              data: { status: 'PENDING' },
            })
            console.log('[INTERVIEW] Material status rolled back to PENDING')
          } catch (rollbackError) {
            console.error('[INTERVIEW] Failed to rollback material status:', rollbackError)
          }
        }
        throw new Error(`文字起こし結果の保存に失敗しました: ${transcriptionResult.reason instanceof Error ? transcriptionResult.reason.message : '不明なエラー'}`)
      }

      if (materialUpdateResult.status === 'rejected') {
        console.error('[INTERVIEW] Failed to update material status:', materialUpdateResult.reason)
        // 文字起こし結果は保存されているため、警告のみ
        console.warn('[INTERVIEW] Transcription saved but material status update failed')
      }

      const transcription = transcriptionResult.status === 'fulfilled' ? transcriptionResult.value : null
      if (!transcription) {
        throw new Error('文字起こし結果の取得に失敗しました')
      }

      console.log(`[INTERVIEW] Transcription saved: ${transcription.id}, Material update: ${materialUpdateResult.status === 'fulfilled' ? 'success' : 'failed'}`)

      return NextResponse.json({ transcription })
    } catch (dbError) {
      console.error('[INTERVIEW] Database operation failed:', dbError)
      
      // データベースエラーの詳細を返す
      const errorMessage = dbError instanceof Error ? dbError.message : '不明なエラー'
      return NextResponse.json(
        { 
          error: 'データベースへの保存に失敗しました', 
          details: errorMessage,
          note: '文字起こしは完了しましたが、保存に失敗しました。再度お試しください。'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('[INTERVIEW] Transcription error:', error)
    console.error('[INTERVIEW] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    await notifyApiError(error, request, 500, { endpoint: 'POST /api/interview/transcribe', materialId, projectId })
    
    return NextResponse.json(
      {
        error: '文字起こしに失敗しました',
        details: error instanceof Error ? error.message : '不明なエラー',
      },
      { status: 500 }
    )
  }
}

