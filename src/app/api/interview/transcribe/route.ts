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

      // エンコーディングをMIMEタイプとファイル拡張子から判定
      // 重要: Google Cloud Speech-to-Text APIの仕様:
      // - GCS URIを使用する場合: encodingは絶対に設定しない（APIが自動検出）
      // - base64コンテンツを使用する場合:
      //   - コンテナ形式（MP3、AAC、OGG_OPUS、WEBM_OPUS、MP4、MOV、AVIなど）: encodingを設定しない（自動検出）
      //   - 生オーディオ形式（LINEAR16、FLAC、MULAW、AMR、AMR_WB）のみ: encodingとsampleRateHertzを設定
      // 重要: GCS URI使用時は、encoding判定を行っても、最終的にはencodingをnullにする
      const containerFormatsMime = ['mp3', 'mpeg', 'm4a', 'aac', 'ogg', 'webm', 'mp4', 'mov', 'avi', 'quicktime', 'x-msvideo']
      const containerFormatsExt = ['mp3', 'mpeg', 'm4a', 'aac', 'ogg', 'webm', 'mp4', 'mov', 'avi']
      const rawAudioFormatsMime = ['wav', 'flac']
      const rawAudioFormatsExt = ['wav', 'flac']
      
      // まず、コンテナ形式かどうかを判定
      let isContainerFormat = false
      
      // MIMEタイプから判定
      if (material.mimeType) {
        const mimeTypeLower = material.mimeType.toLowerCase()
        if (rawAudioFormatsMime.some(format => mimeTypeLower.includes(format))) {
          // 生オーディオ形式の判定（base64コンテンツの場合のみ有効）
          if (!gcsUri) {
            if (mimeTypeLower.includes('wav')) {
              encoding = 'LINEAR16'
              console.log(`[INTERVIEW] WAV format detected from MIME type: ${material.mimeType} -> LINEAR16`)
            } else if (mimeTypeLower.includes('flac')) {
              encoding = 'FLAC'
              console.log(`[INTERVIEW] FLAC format detected from MIME type: ${material.mimeType} -> FLAC`)
            }
          } else {
            // GCS URI使用時は、生オーディオ形式でもencodingを設定しない
            encoding = null
            console.log(`[INTERVIEW] GCS URI mode: WAV/FLAC detected but encoding will be auto-detected`)
          }
        } else if (containerFormatsMime.some(format => mimeTypeLower.includes(format))) {
          // コンテナ形式の場合はencodingをnullに設定（自動検出）
          isContainerFormat = true
          encoding = null
          console.log(`[INTERVIEW] Container format detected from MIME type: ${material.mimeType} -> encoding will be auto-detected`)
        }
      }
      
      // エンコーディングが判定できない場合は、ファイル拡張子から判定
      if (encoding === null && !isContainerFormat && material.fileName) {
        const ext = (material.fileName.toLowerCase().split('.').pop() || '').toLowerCase()
        if (rawAudioFormatsExt.includes(ext)) {
          // 生オーディオ形式の判定（base64コンテンツの場合のみ有効）
          if (!gcsUri) {
            if (ext === 'wav') {
              encoding = 'LINEAR16'
              console.log(`[INTERVIEW] WAV format detected from extension: ${ext} -> LINEAR16`)
            } else if (ext === 'flac') {
              encoding = 'FLAC'
              console.log(`[INTERVIEW] FLAC format detected from extension: ${ext} -> FLAC`)
            }
          } else {
            // GCS URI使用時は、生オーディオ形式でもencodingを設定しない
            encoding = null
            console.log(`[INTERVIEW] GCS URI mode: WAV/FLAC detected from extension but encoding will be auto-detected`)
          }
        } else if (containerFormatsExt.includes(ext)) {
          // コンテナ形式の場合はencodingをnullに設定（自動検出）
          isContainerFormat = true
          encoding = null
          console.log(`[INTERVIEW] Container format detected from extension: ${ext} -> encoding will be auto-detected`)
        }
      }
      
      // GCS URI使用時は、常にencodingをnullにする（APIが自動検出）
      if (gcsUri) {
        encoding = null
        console.log(`[INTERVIEW] GCS URI mode: encoding will always be auto-detected by API (not setting in config)`)
      }
      
      // encodingが未設定の場合は、APIに自動検出を任せる（コンテナ形式として扱う）
      // 注意: GCS URIを使用する場合、encodingは絶対に設定しない
      if (encoding === null || encoding === undefined) {
        console.log(`[INTERVIEW] Encoding not specified or container format detected, will be auto-detected by API`)
      } else {
        console.log(`[INTERVIEW] Detected encoding: ${encoding} (raw audio format, base64 content only)`)
      }
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
      // GCS URI使用時は、encodingをログに出力しない（常にauto-detect）
      const encodingLog = gcsUri ? 'none (GCS URI mode - auto-detect)' : (encoding || 'none (auto-detect)')
      console.log(`[INTERVIEW] Calling Google Cloud Speech-to-Text API... (file size: ${fileSizeMB} MB, encoding: ${encodingLog})`)
      
      // リクエスト設定のベース（encodingは含めない）
      // 重要: GCS URIを使用する場合、encodingは絶対に設定しない
      // base64コンテンツを使用する場合でも、コンテナ形式の場合はencodingを設定しない
      const baseConfig: any = {
        languageCode: 'ja-JP',
        alternativeLanguageCodes: ['en-US'], // 日本語が認識できない場合のフォールバック
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false, // 単語のタイムスタンプは不要
        model: 'latest_long', // 長い音声に最適化されたモデル（60分まで対応）
      }
      
      // リクエストオブジェクトを初期化（encodingプロパティは含めない）
      const request: any = {
        config: { ...baseConfig },
      }
      
      // GCS URIが利用可能な場合はそれを使用（encodingは自動検出、絶対に設定しない）
      if (gcsUri) {
        request.audio = { uri: gcsUri }
        // GCS URIを使用する場合、encodingは絶対に設定しない（Google Cloud Speech-to-Text APIの仕様）
        // APIが自動的に音声トラックを抽出し、エンコーディングを検出します
        console.log(`[INTERVIEW] Using GCS URI: ${gcsUri}`)
        console.log(`[INTERVIEW] GCS URI mode: encoding will be auto-detected by API (encoding not set in config)`)
      } else if (audioContent) {
        // base64エンコードされたコンテンツを使用する場合
        request.audio = { content: audioContent.toString('base64') }
        console.log(`[INTERVIEW] Using base64 encoded audio content: ${audioContent.length} bytes`)
        
        // エンコーディング設定（base64コンテンツの場合のみ）
        // Google Cloud Speech-to-Text APIの仕様:
        // - コンテナ形式（MP3、AAC、OGG_OPUS、WEBM_OPUS、MP4、MOV、AVIなど）: encodingを設定しない（APIが自動検出）
        // - 生オーディオ形式（LINEAR16、FLAC、MULAW、AMR、AMR_WB）のみ: encodingとsampleRateHertzを設定
        const rawAudioFormats = ['LINEAR16', 'FLAC', 'MULAW', 'AMR', 'AMR_WB']
        
        if (encoding && rawAudioFormats.includes(encoding)) {
          // 生オーディオ形式の場合はencodingとsampleRateHertzを設定
          request.config.encoding = encoding as any
          request.config.sampleRateHertz = 16000 // デフォルトサンプルレート（実際の値はファイルから取得する必要があるが、デフォルト値を使用）
          console.log(`[INTERVIEW] Raw audio format detected (${encoding}), setting encoding: ${encoding}, sampleRateHertz: 16000`)
        } else {
          // コンテナ形式、またはencodingが未設定の場合、encodingを設定しない（自動検出に任せる）
          // 注意: request.configにはencodingプロパティを追加しない
          console.log(`[INTERVIEW] Container format or encoding not specified (${encoding || 'none'}), will be auto-detected by API (encoding not set in config)`)
        }
      } else {
        throw new Error('音声データが取得できませんでした')
      }
      
      // リクエスト設定の最終確認とクリーンアップ
      // 重要: GCS URIを使用する場合、encodingは絶対に設定しない
      // base64コンテンツを使用する場合でも、コンテナ形式の場合はencodingを設定しない
      const rawAudioFormats = ['LINEAR16', 'FLAC', 'MULAW', 'AMR', 'AMR_WB']
      const shouldHaveEncoding = !gcsUri && encoding && rawAudioFormats.includes(encoding)
      
      // encodingが設定されている場合、適切な場合のみ残し、それ以外は削除
      if ('encoding' in request.config) {
        if (shouldHaveEncoding) {
          // 生オーディオ形式でbase64コンテンツの場合、encodingは正しく設定されている
          console.log(`[INTERVIEW] Encoding correctly set for raw audio format: ${request.config.encoding}`)
        } else {
          // GCS URI使用時、またはコンテナ形式の場合、encodingを削除
          console.error(`[INTERVIEW] WARNING: encoding property found but should not be set. Removing...`)
          delete request.config.encoding
          if ('sampleRateHertz' in request.config) {
            delete request.config.sampleRateHertz
          }
          console.log(`[INTERVIEW] Removed encoding from config (${gcsUri ? 'GCS URI mode' : 'container format or unknown format'})`)
        }
      }
      
      // 最終確認: encodingプロパティが適切に設定されていることを確認
      const finalConfigKeys = Object.keys(request.config)
      const hasEncoding = finalConfigKeys.includes('encoding')
      
      if (hasEncoding && !shouldHaveEncoding) {
        // encodingが設定されているが、設定すべきでない場合、削除
        console.error(`[INTERVIEW] CRITICAL: encoding property still exists after cleanup. Force removing...`)
        delete request.config.encoding
        if ('sampleRateHertz' in request.config) {
          delete request.config.sampleRateHertz
        }
        console.log(`[INTERVIEW] Force removed encoding from config`)
      } else if (!hasEncoding && shouldHaveEncoding) {
        // encodingが設定されていないが、設定すべき場合、設定
        console.error(`[INTERVIEW] CRITICAL: encoding should be set but is missing. Setting...`)
        request.config.encoding = encoding as any
        request.config.sampleRateHertz = 16000
        console.log(`[INTERVIEW] Set encoding: ${encoding}, sampleRateHertz: 16000`)
      }
      
      // デバッグログ: 最終的なリクエスト設定を出力（再確認）
      const finalConfigKeysAfterCheck = Object.keys(request.config)
      const finalHasEncoding = finalConfigKeysAfterCheck.includes('encoding')
      console.log(`[INTERVIEW] Final request config keys:`, finalConfigKeysAfterCheck.join(', '))
      console.log(`[INTERVIEW] Request config (without audio):`, JSON.stringify(request.config, null, 2))
      console.log(`[INTERVIEW] Audio source:`, gcsUri ? `GCS URI: ${gcsUri}` : audioContent ? `base64 content: ${audioContent.length} bytes` : 'none')
      console.log(`[INTERVIEW] Encoding detection:`, encoding || 'none (auto-detect)')
      console.log(`[INTERVIEW] Encoding in config:`, finalHasEncoding ? request.config.encoding : 'none (auto-detect)')
      console.log(`[INTERVIEW] Should have encoding:`, shouldHaveEncoding)
      
      // 最終的なバリデーション: encodingが適切に設定されていることを確認
      // このチェックで、bad encodingエラーを防ぐ
      if (finalHasEncoding && !shouldHaveEncoding) {
        console.error(`[INTERVIEW] FATAL ERROR: encoding is still in config but should not be! This will cause bad encoding error.`)
        console.error(`[INTERVIEW] Config keys:`, finalConfigKeysAfterCheck.join(', '))
        console.error(`[INTERVIEW] Config JSON:`, JSON.stringify(request.config, null, 2))
        throw new Error(`Internal error: encoding property should not be in config for ${gcsUri ? 'GCS URI' : 'container format'}. This will cause bad encoding error.`)
      } else if (!finalHasEncoding && shouldHaveEncoding) {
        console.error(`[INTERVIEW] FATAL ERROR: encoding should be in config but is missing!`)
        throw new Error(`Internal error: encoding property should be in config for raw audio format: ${encoding}`)
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
      console.error('[INTERVIEW] Error code:', speechError?.code)
      console.error('[INTERVIEW] Error reason:', speechError?.reason)
      console.error('[INTERVIEW] Error details:', speechError?.details)
      console.error('[INTERVIEW] Error metadata:', speechError?.errorInfoMetadata)
      
      let errorMessage = '文字起こしに失敗しました'
      let errorDetails = ''
      let activationUrl: string | null = null

      if (speechError?.code === 7) {
        // エラーコード7はPERMISSION_DENIED、reasonがSERVICE_DISABLEDの場合はAPIが有効化されていない
        if (speechError?.reason === 'SERVICE_DISABLED' || speechError?.statusDetails?.[0]?.reason === 'SERVICE_DISABLED') {
          errorMessage = 'Google Cloud Speech-to-Text APIが有効化されていません'
          errorDetails = 'Google Cloud Speech-to-Text APIを有効化する必要があります。\n\n'
          errorDetails += '以下の手順でAPIを有効化してください:\n'
          errorDetails += '1. Google Cloud Consoleにアクセスします\n'
          errorDetails += '2. プロジェクトを選択します\n'
          errorDetails += '3. "APIとサービス" > "ライブラリ"に移動します\n'
          errorDetails += '4. "Cloud Speech-to-Text API"を検索します\n'
          errorDetails += '5. "有効にする"ボタンをクリックします\n'
          errorDetails += '6. 有効化後、数分待ってから再度お試しください\n\n'
          
          // エラーメッセージからアクティベーションURLを抽出
          if (speechError?.errorInfoMetadata?.activationUrl) {
            activationUrl = speechError.errorInfoMetadata.activationUrl
            errorDetails += `直接リンク: ${activationUrl}\n\n`
          } else if (speechError?.details?.includes('https://console.developers.google.com')) {
            const urlMatch = speechError.details.match(/https:\/\/console\.developers\.google\.com[^\s]+/)
            if (urlMatch) {
              activationUrl = urlMatch[0]
              errorDetails += `直接リンク: ${activationUrl}\n\n`
            }
          }
          
          const projectId = credentials?.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID || 'プロジェクトID'
          if (!activationUrl && projectId) {
            activationUrl = `https://console.developers.google.com/apis/api/speech.googleapis.com/overview?project=${projectId}`
            errorDetails += `直接リンク: ${activationUrl}\n\n`
          }
          
          errorDetails += '注意: APIを有効化した後、数分待ってから再度お試しください。反映に時間がかかる場合があります。'
        } else {
          // その他のPERMISSION_DENIEDエラー（認証エラーなど）
          errorMessage = '認証エラーが発生しました'
          errorDetails = 'Google Cloud Speech-to-Text APIへのアクセス権限がありません。\n\n'
          errorDetails += '確認事項:\n'
          errorDetails += '1. サービスアカウントに適切な権限が設定されているか確認してください\n'
          errorDetails += '2. GOOGLE_APPLICATION_CREDENTIALS環境変数が正しく設定されているか確認してください\n'
          errorDetails += '3. サービスアカウントに"Cloud Speech-to-Text API User"ロールが付与されているか確認してください'
        }
      } else if (speechError?.code === 3) {
        errorMessage = '無効なリクエストです'
        errorDetails = 'ファイル形式がサポートされていない可能性があります。\n\n'
        errorDetails += '確認事項:\n'
        errorDetails += '1. ファイル形式がサポートされているか確認してください（MP3, WAV, FLAC, M4A, OGG_OPUS, WEBM_OPUSなど）\n'
        errorDetails += '2. ファイルが破損していないか確認してください\n'
        if (speechError?.message) {
          errorDetails += `\nエラー詳細: ${speechError.message}`
        }
      } else if (speechError?.code === 8) {
        errorMessage = 'リソースが不足しています'
        errorDetails = 'Google Cloud Speech-to-Text APIのリソースが不足しています。\n\n'
        errorDetails += '対処方法:\n'
        errorDetails += '1. しばらく待ってから再度お試しください\n'
        errorDetails += '2. ファイルサイズが大きすぎる場合は、分割してから処理してください\n'
        if (speechError?.message) {
          errorDetails += `\nエラー詳細: ${speechError.message}`
        }
      } else if (speechError?.code === 13) {
        errorMessage = '内部エラーが発生しました'
        errorDetails = 'Google Cloud Speech-to-Textサービスでエラーが発生しました。\n\n'
        errorDetails += '対処方法:\n'
        errorDetails += '1. しばらく待ってから再度お試しください\n'
        errorDetails += '2. 問題が解決しない場合は、サポートにお問い合わせください\n'
        if (speechError?.message) {
          errorDetails += `\nエラー詳細: ${speechError.message}`
        }
      } else if (speechError?.message) {
        errorDetails = speechError.message
        // エラーメッセージにAPI有効化の情報が含まれている場合
        if (speechError.message.includes('has not been used') || speechError.message.includes('is disabled')) {
          errorMessage = 'Google Cloud Speech-to-Text APIが有効化されていません'
          if (speechError.message.includes('https://console.developers.google.com')) {
            const urlMatch = speechError.message.match(/https:\/\/console\.developers\.google\.com[^\s]+/)
            if (urlMatch) {
              activationUrl = urlMatch[0]
              errorDetails = `Google Cloud Speech-to-Text APIを有効化する必要があります。\n\n${speechError.message}\n\n直接リンク: ${activationUrl}`
            }
          }
        }
      }

      return NextResponse.json(
        { 
          error: errorMessage, 
          details: errorDetails,
          ...(activationUrl && { activationUrl }),
        },
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

