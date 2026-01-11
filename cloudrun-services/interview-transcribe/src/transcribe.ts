import { SpeechClient } from '@google-cloud/speech'

interface TranscribeOptions {
  gcsUri: string
  mimeType?: string
  fileName?: string
  isVideoFile: boolean
  fileSize: number
}

// SpeechClientの初期化
let speechClient: SpeechClient | null = null

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    // 認証情報の取得
    const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credsEnvVar) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is not set')
    }

    let credentials: any
    try {
      const credsStr = credsEnvVar.trim()
      if (credsStr.startsWith('{')) {
        credentials = JSON.parse(credsStr)
      } else {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS must be a JSON string')
      }
    } catch (parseError: any) {
      throw new Error(`Failed to parse credentials: ${parseError.message}`)
    }

    // SpeechClientを初期化
    speechClient = new SpeechClient({
      projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials,
    })

    console.log('[TRANSCRIBE] SpeechClient initialized')
  }
  return speechClient
}

export async function transcribeAudio(options: TranscribeOptions): Promise<string> {
  const { gcsUri, mimeType, fileName, isVideoFile, fileSize } = options

  const speechClient = getSpeechClient()

  // ファイルサイズチェック（1GB制限）
  const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds limit (max ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB)`)
  }

  // リクエスト設定の準備
  const isMP4File = fileName?.toLowerCase().endsWith('.mp4') || mimeType?.includes('mp4')
  const isLargeFile = fileSize > 10 * 1024 * 1024 // 10MB以上

  // 設定パターンの準備
  const configPatterns: any[] = []

  if (isVideoFile && isMP4File) {
    // MP4ファイルの場合、複数の設定パターンを準備
    configPatterns.push(
      { languageCode: 'ja-JP' }, // パターン1: 最小限
      { languageCode: 'ja-JP', enableAutomaticPunctuation: true }, // パターン2
      { languageCode: 'ja-JP', model: 'video' }, // パターン3: 公式ドキュメント推奨
    )
    console.log('[TRANSCRIBE] MP4 video file: will try multiple config patterns')
  } else if (isVideoFile) {
    // MP4以外のビデオファイルの場合
    configPatterns.push({ languageCode: 'ja-JP', model: 'video' })
    console.log('[TRANSCRIBE] Video file (non-MP4): using model "video"')
  } else {
    // 音声ファイルの場合
    configPatterns.push({
      languageCode: 'ja-JP',
      model: 'latest_long',
      enableAutomaticPunctuation: true,
    })
    console.log('[TRANSCRIBE] Audio file: using model "latest_long"')
  }

  // 設定パターンを試す
  let transcriptionText: string = ''
  let lastError: any = null

  for (let patternIndex = 0; patternIndex < configPatterns.length; patternIndex++) {
    const currentConfig = configPatterns[patternIndex]
    const speechRequest = {
      config: currentConfig,
      audio: {
        uri: gcsUri,
      },
    }

    console.log(
      `[TRANSCRIBE] Trying config pattern ${patternIndex + 1}/${configPatterns.length}:`,
      JSON.stringify(currentConfig, null, 2)
    )

    if (isVideoFile || isLargeFile) {
      // ビデオファイルや大きなファイルの場合はlongRunningRecognizeを使用
      console.log('[TRANSCRIBE] Calling longRunningRecognize...')
      const startTime = Date.now()

      try {
        const [operation] = await speechClient.longRunningRecognize(speechRequest)
        console.log('[TRANSCRIBE] Long-running operation started')
        console.log('[TRANSCRIBE] Operation Name:', operation.name)
        console.log('[TRANSCRIBE] Waiting for operation to complete...')

        const [operationResult] = await operation.promise()
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log('[TRANSCRIBE] Operation completed')
        console.log('[TRANSCRIBE] Elapsed Time:', `${elapsedTime} seconds`)

        if (!operationResult.results || operationResult.results.length === 0) {
          console.error('[TRANSCRIBE] Empty transcription results')
          throw new Error('Transcription result is empty. No speech detected.')
        }

        console.log('[TRANSCRIBE] Transcription results received')
        console.log('[TRANSCRIBE] Results Count:', operationResult.results.length)

        transcriptionText = operationResult.results
          .map((result: any) => result.alternatives?.[0]?.transcript || '')
          .filter((text: string) => text.trim().length > 0)
          .join(' ')

        console.log('[TRANSCRIBE] Transcription text extracted')
        console.log('[TRANSCRIBE] Text Length:', `${transcriptionText.length} characters`)
        console.log(
          '[TRANSCRIBE] Preview:',
          transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : '')
        )
        console.log(`[TRANSCRIBE] Success with config pattern ${patternIndex + 1}`)
        break // 成功したらループを抜ける
      } catch (apiError: any) {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
        console.error(`[TRANSCRIBE] Config pattern ${patternIndex + 1} failed`)
        console.error('[TRANSCRIBE] Elapsed Time:', `${elapsedTime} seconds`)
        console.error('[TRANSCRIBE] Error Code:', apiError?.code || 'N/A')
        console.error('[TRANSCRIBE] Error Message:', apiError?.message || 'N/A')
        console.error('[TRANSCRIBE] Error Details:', apiError?.details || 'N/A')

        lastError = apiError

        // bad encodingエラーの場合、次のパターンを試す
        if (apiError?.code === 3 && apiError?.details?.includes('bad encoding')) {
          if (patternIndex < configPatterns.length - 1) {
            console.log('[TRANSCRIBE] Bad encoding error - trying next config pattern...')
            continue
          }
        }

        // 最後のパターンでも失敗した場合、MP4ファイルの場合は特別なエラーメッセージを返す
        if (patternIndex === configPatterns.length - 1) {
          if (isMP4File) {
            console.error('[TRANSCRIBE] All config patterns failed for MP4 file')
            throw new Error(
              'MP4 video files cannot be processed directly. Please extract audio from the MP4 file first.'
            )
          }
          throw apiError
        }
      }
    } else {
      // 短い音声ファイルの場合はrecognizeを使用
      console.log('[TRANSCRIBE] Calling recognize...')
      const startTime = Date.now()

      try {
        const [response] = await speechClient.recognize(speechRequest)
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log('[TRANSCRIBE] Recognize completed')
        console.log('[TRANSCRIBE] Elapsed Time:', `${elapsedTime} seconds`)

        if (!response.results || response.results.length === 0) {
          console.error('[TRANSCRIBE] Empty transcription results')
          throw new Error('Transcription result is empty. No speech detected.')
        }

        console.log('[TRANSCRIBE] Transcription results received')
        console.log('[TRANSCRIBE] Results Count:', response.results.length)

        transcriptionText = response.results
          .map((result: any) => result.alternatives?.[0]?.transcript || '')
          .filter((text: string) => text.trim().length > 0)
          .join(' ')

        console.log('[TRANSCRIBE] Transcription text extracted')
        console.log('[TRANSCRIBE] Text Length:', `${transcriptionText.length} characters`)
        console.log(
          '[TRANSCRIBE] Preview:',
          transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : '')
        )
        console.log(`[TRANSCRIBE] Success with config pattern ${patternIndex + 1}`)
        break // 成功したらループを抜ける
      } catch (apiError: any) {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
        console.error(`[TRANSCRIBE] Config pattern ${patternIndex + 1} failed`)
        console.error('[TRANSCRIBE] Elapsed Time:', `${elapsedTime} seconds`)
        console.error('[TRANSCRIBE] Error Code:', apiError?.code || 'N/A')
        console.error('[TRANSCRIBE] Error Message:', apiError?.message || 'N/A')
        console.error('[TRANSCRIBE] Error Details:', apiError?.details || 'N/A')

        lastError = apiError

        // bad encodingエラーの場合、次のパターンを試す
        if (apiError?.code === 3 && apiError?.details?.includes('bad encoding')) {
          if (patternIndex < configPatterns.length - 1) {
            console.log('[TRANSCRIBE] Bad encoding error - trying next config pattern...')
            continue
          }
        }

        // 最後のパターンでも失敗した場合、MP4ファイルの場合は特別なエラーメッセージを返す
        if (patternIndex === configPatterns.length - 1) {
          if (isMP4File) {
            console.error('[TRANSCRIBE] All config patterns failed for MP4 file')
            throw new Error(
              'MP4 video files cannot be processed directly. Please extract audio from the MP4 file first.'
            )
          }
          throw apiError
        }
      }
    }
  }

  // 全てのパターンが失敗した場合
  if (!transcriptionText && lastError) {
    throw lastError
  }

  if (!transcriptionText || transcriptionText.trim().length === 0) {
    throw new Error('Transcription result is empty')
  }

  return transcriptionText
}

