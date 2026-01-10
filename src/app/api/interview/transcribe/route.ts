import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { SpeechClient } from '@google-cloud/speech'
import { getFileFromGCS } from '@/lib/gcs'
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

    console.log('[INTERVIEW] Transcription request - userId:', userId || 'null', 'guestId:', guestId || 'null')

    if (!userId && !guestId) {
      console.error('[INTERVIEW] Unauthorized: both userId and guestId are missing')
      return NextResponse.json(
        { 
          error: '認証が必要です',
          details: 'ログインするか、ゲストセッションIDを設定してください。\n\n解決方法:\n1. ログインしてください\n2. ページを再読み込みしてください\n3. 問題が解決しない場合は、サポートにお問い合わせください'
        },
        { status: 401 }
      )
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

    // Google Cloud Speech-to-Textを使用して文字起こし
    // Speech-to-Textの制限: 最大60分の音声、または1GBのファイル
    // 既存のGCS認証情報を使用可能
    let credentials: any = undefined
    const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS
    
    if (!credsEnvVar) {
      console.error('[INTERVIEW] GOOGLE_APPLICATION_CREDENTIALS is not set')
      return NextResponse.json(
        { error: '文字起こし機能の設定が完了していません', details: 'Google Cloud Storageの認証情報が設定されていません。GOOGLE_APPLICATION_CREDENTIALS環境変数を設定してください。' },
        { status: 500 }
      )
    }

    // GOOGLE_APPLICATION_CREDENTIALSがJSON文字列の場合、パースしてcredentialsオブジェクトを取得
    try {
      const credsStr = credsEnvVar.trim()
      if (credsStr.startsWith('{')) {
        // JSON文字列として設定されている場合
        credentials = JSON.parse(credsStr)
        console.log('[INTERVIEW] Successfully parsed GOOGLE_APPLICATION_CREDENTIALS as JSON')
      } else {
        // ファイルパスとして設定されている場合（通常はVercelでは使用しない）
        console.log('[INTERVIEW] GOOGLE_APPLICATION_CREDENTIALS appears to be a file path (not supported in Vercel)')
        return NextResponse.json(
          { error: '文字起こし機能の設定が完了していません', details: 'GOOGLE_APPLICATION_CREDENTIALSはJSON文字列として設定する必要があります。ファイルパスはVercelでは使用できません。' },
          { status: 500 }
        )
      }
    } catch (parseError) {
      console.error('[INTERVIEW] Failed to parse GOOGLE_APPLICATION_CREDENTIALS:', parseError)
      return NextResponse.json(
        { error: '文字起こし機能の設定が完了していません', details: `GOOGLE_APPLICATION_CREDENTIALSのパースに失敗しました: ${parseError instanceof Error ? parseError.message : '不明なエラー'}` },
        { status: 500 }
      )
    }

    // 認証情報の検証
    if (!credentials || credentials.type !== 'service_account') {
      console.error('[INTERVIEW] Invalid credentials type:', credentials?.type)
      return NextResponse.json(
        { error: '文字起こし機能の設定が完了していません', details: 'GOOGLE_APPLICATION_CREDENTIALSの形式が正しくありません。サービスアカウントキーのJSONである必要があります。' },
        { status: 500 }
      )
    }

    // SpeechClientを認証情報と共に初期化
    const speechClientConfig: any = {
      projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID,
    }
    
    if (credentials) {
      speechClientConfig.credentials = credentials
    }
    
    const speechClient = new SpeechClient(speechClientConfig)
    console.log('[INTERVIEW] SpeechClient initialized successfully with credentials')

    // ファイルサイズをチェック
    // Google Cloud Speech-to-Textの制限: 最大60分の音声、または1GBのファイル
    const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
    const MAX_AUDIO_DURATION = 60 * 60 * 1000 // 60分（ミリ秒）
    
    if (material.fileSize && material.fileSize > MAX_FILE_SIZE) {
      const fileSizeMB = (material.fileSize / 1024 / 1024).toFixed(2)
      const maxSizeGB = (MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(0)
      console.warn(`[INTERVIEW] File size (${fileSizeMB} MB) exceeds limit (${maxSizeGB} GB)`)
      return NextResponse.json(
        { 
          error: 'ファイルサイズが大きすぎます',
          details: `文字起こし機能は最大${maxSizeGB}GB（または60分の音声）のファイルに対応しています。\n現在のファイルサイズ: ${fileSizeMB} MB\n\n対処方法:\n1. ファイルを分割してアップロードしてください（推奨: 60分以下）\n2. 動画ファイルの場合は、音声のみを抽出してください\n3. 音声ファイルの場合は、圧縮してからアップロードしてください`
        },
        { status: 413 }
      )
    }

    // Google Cloud Speech-to-Textで文字起こし
    // GCS上のファイルの場合は直接GCS URIを使用（効率的）
    // ローカルファイルの場合はbase64エンコードして送信
    let gcsUri: string | null = null
    let audioContent: Buffer | null = null
    let encoding: string | null = null
    
    try {
      // ファイルがGCS上にある場合は直接URIを使用
      if (material.fileUrl && material.fileUrl.includes('storage.googleapis.com')) {
        // GCS URLからURIを抽出（gs://bucket/path 形式に変換）
        const urlPattern = /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/
        const match = material.fileUrl.match(urlPattern)
        if (match && match[1] && match[2]) {
          gcsUri = `gs://${match[1]}/${decodeURIComponent(match[2])}`
          console.log(`[INTERVIEW] Using GCS URI for transcription: ${gcsUri}`)
        } else {
          // GCS URLの解析に失敗した場合、ファイルをダウンロード
          console.warn(`[INTERVIEW] Failed to parse GCS URL, downloading file: ${material.fileUrl}`)
          audioContent = await getFileFromGCS(material.fileUrl)
          console.log(`[INTERVIEW] File downloaded: ${audioContent.length} bytes`)
        }
      } else if (material.filePath && !material.filePath.startsWith('http://') && !material.filePath.startsWith('https://') && !material.filePath.startsWith('/')) {
        // filePathがGCS pathnameの場合、URIを構築
        const bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
        gcsUri = `gs://${bucketName}/${material.filePath}`
        console.log(`[INTERVIEW] Using GCS URI for transcription: ${gcsUri}`)
      } else {
        // ローカルファイルまたはその他のURLの場合は、ファイルをダウンロード
        console.log(`[INTERVIEW] Downloading file for transcription`)
        if (material.fileUrl) {
          const response = await fetch(material.fileUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch file from URL: ${response.status} ${response.statusText}`)
          }
          const arrayBuffer = await response.arrayBuffer()
          audioContent = Buffer.from(arrayBuffer)
        } else if (material.filePath) {
          const baseDir = getUploadBaseDir()
          const filePath = material.filePath.startsWith('/') 
            ? material.filePath 
            : join(baseDir, material.filePath)
          
          if (!existsSync(filePath)) {
            throw new Error(`ファイルが見つかりません: ${filePath}`)
          }
          
          audioContent = await readFile(filePath)
        } else {
          throw new Error('ファイルのURLまたはパスが設定されていません')
        }
        console.log(`[INTERVIEW] File downloaded: ${audioContent.length} bytes`)
      }

      // エンコーディングをMIMEタイプから判定
      if (material.mimeType) {
        if (material.mimeType.includes('mp3') || material.mimeType.includes('mpeg')) {
          encoding = 'MP3'
        } else if (material.mimeType.includes('wav')) {
          encoding = 'LINEAR16'
        } else if (material.mimeType.includes('m4a') || material.mimeType.includes('aac')) {
          encoding = 'AAC'
        } else if (material.mimeType.includes('ogg')) {
          encoding = 'OGG_OPUS'
        } else if (material.mimeType.includes('flac')) {
          encoding = 'FLAC'
        } else if (material.mimeType.includes('webm')) {
          encoding = 'WEBM_OPUS'
        } else if (material.mimeType.includes('mp4') || material.mimeType.includes('video')) {
          encoding = 'MP3' // 動画ファイルの場合はMP3として処理
        }
      }
      
      // エンコーディングが判定できない場合は、ファイル拡張子から判定
      if (!encoding && material.fileName) {
        const ext = material.fileName.toLowerCase().split('.').pop()
        if (ext === 'mp3') encoding = 'MP3'
        else if (ext === 'wav') encoding = 'LINEAR16'
        else if (ext === 'm4a' || ext === 'aac') encoding = 'AAC'
        else if (ext === 'ogg') encoding = 'OGG_OPUS'
        else if (ext === 'flac') encoding = 'FLAC'
        else if (ext === 'webm') encoding = 'WEBM_OPUS'
        else if (ext === 'mp4') encoding = 'MP3'
      }
      
      // デフォルトはMP3
      if (!encoding) {
        encoding = 'MP3'
        console.warn(`[INTERVIEW] Encoding not detected, using MP3 as default`)
      }
      
      console.log(`[INTERVIEW] Detected encoding: ${encoding}`)
    } catch (fileError) {
      console.error('[INTERVIEW] Failed to prepare file for transcription:', fileError)
      const errorMessage = fileError instanceof Error ? fileError.message : '不明なエラー'
      return NextResponse.json(
        { 
          error: 'ファイルの準備に失敗しました', 
          details: errorMessage 
        },
        { status: 500 }
      )
    }

    // Google Cloud Speech-to-Textで文字起こし
    let transcriptionText: string
    try {
      const fileSizeMB = audioContent ? (audioContent.length / 1024 / 1024).toFixed(2) : (material.fileSize ? (material.fileSize / 1024 / 1024).toFixed(2) : '0')
      console.log(`[INTERVIEW] Calling Google Cloud Speech-to-Text API... (file size: ${fileSizeMB} MB, encoding: ${encoding})`)
      
      // リクエスト設定
      // 注意: MP3、AAC、OGG_OPUS、WEBM_OPUSはコンテナ形式で、encodingを指定しない（自動検出）
      // LINEAR16、FLAC、MULAW、AMR、AMR_WBはsampleRateHertzが必要
      const request: any = {
        config: {
          languageCode: 'ja-JP',
          alternativeLanguageCodes: ['en-US'], // 日本語が認識できない場合のフォールバック
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false, // 単語のタイムスタンプは不要
          model: 'latest_long', // 長い音声に最適化されたモデル（60分まで対応）
        },
      }
      
      // エンコーディング設定
      // MP3、AAC、OGG_OPUS、WEBM_OPUSの場合はencodingを設定しない（自動検出）
      if (encoding && !['MP3', 'AAC', 'OGG_OPUS', 'WEBM_OPUS'].includes(encoding)) {
        request.config.encoding = encoding as any
        // LINEAR16、FLAC、MULAW、AMR、AMR_WBの場合はsampleRateHertzが必要
        if (['LINEAR16', 'FLAC', 'MULAW', 'AMR', 'AMR_WB'].includes(encoding)) {
          request.config.sampleRateHertz = 16000 // デフォルトサンプルレート
        }
      }
      
      // GCS URIが利用可能な場合はそれを使用、そうでない場合はbase64エンコード
      if (gcsUri) {
        request.audio = { uri: gcsUri }
        console.log(`[INTERVIEW] Using GCS URI: ${gcsUri}`)
      } else if (audioContent) {
        request.audio = { content: audioContent.toString('base64') }
        console.log(`[INTERVIEW] Using base64 encoded audio content: ${audioContent.length} bytes`)
      } else {
        throw new Error('音声データが取得できませんでした')
      }
      
      // タイムアウト設定（大きなファイルの場合、処理に時間がかかる）
      const SPEECH_API_TIMEOUT = Math.max(600000, (audioContent?.length || material.fileSize || 0) / 1024 / 1024 * 20000) // 最低10分、1MBあたり20秒
      
      console.log(`[INTERVIEW] Starting transcription (timeout: ${(SPEECH_API_TIMEOUT / 1000 / 60).toFixed(1)} minutes)`)
      
      const transcriptionPromise = speechClient.recognize(request)
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Google Cloud Speech-to-Text API呼び出しがタイムアウトしました（${(SPEECH_API_TIMEOUT / 1000 / 60).toFixed(1)}分）`))
        }, SPEECH_API_TIMEOUT)
      })
      
      const [response] = await Promise.race([
        transcriptionPromise,
        timeoutPromise,
      ])
      
      // レスポンスからテキストを抽出
      if (!response || !response.results || response.results.length === 0) {
        throw new Error('文字起こし結果が空です')
      }
      
      // 複数の結果がある場合は結合
      transcriptionText = response.results
        .map((result: any) => result.alternatives?.[0]?.transcript || '')
        .filter((text: string) => text.trim().length > 0)
        .join(' ')
      
      if (!transcriptionText || transcriptionText.trim().length === 0) {
        throw new Error('文字起こし結果が空です')
      }
      
      console.log(`[INTERVIEW] Transcription completed: ${transcriptionText.length} characters`)
    } catch (speechError: any) {
      console.error('[INTERVIEW] Google Cloud Speech-to-Text API error:', speechError)
      
      let errorMessage = '文字起こしに失敗しました'
      let errorDetails = ''

      if (speechError?.code === 7) {
        errorMessage = '認証エラーが発生しました'
        errorDetails = 'Google Cloud Storageの認証情報を確認してください'
      } else if (speechError?.code === 3) {
        errorMessage = '無効なリクエストです'
        errorDetails = 'ファイル形式がサポートされていない可能性があります'
      } else if (speechError?.code === 8) {
        errorMessage = 'リソースが不足しています'
        errorDetails = 'しばらく待ってから再度お試しください'
      } else if (speechError?.code === 13) {
        errorMessage = '内部エラーが発生しました'
        errorDetails = 'Google Cloud Speech-to-Textサービスでエラーが発生しました'
      } else if (speechError?.message) {
        errorDetails = speechError.message
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
            provider: 'google-cloud-speech',
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

