import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SpeechClient } from '@google-cloud/speech'
import { Storage } from '@google-cloud/storage'
import { GoogleAuth } from 'google-auth-library'
import { getUserPlan, getMaxFileSize, getEffectivePlan, isFileSizeWithinLimit, type InterviewPlan } from '@/lib/interview/planLimits'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    const guestId = request.headers.get('x-guest-id')

    if (!userId && !guestId) {
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // リクエストボディを取得
    const body = await request.json()
    const { materialId, projectId } = body

    if (!materialId || !projectId) {
      return NextResponse.json(
        { error: 'materialIdとprojectIdが必要です' },
        { status: 400 }
      )
    }

    // 素材を取得
    const material = await prisma.interviewMaterial.findFirst({
      where: {
        id: materialId,
        projectId,
        OR: [
          { project: { userId: userId || undefined } },
          { project: { guestId: guestId || undefined } },
        ],
      },
    })

    if (!material) {
      return NextResponse.json(
        { error: '素材が見つかりません' },
        { status: 404 }
      )
    }

    if (material.type !== 'audio' && material.type !== 'video') {
      return NextResponse.json(
        { error: '音声または動画ファイルのみ文字起こし可能です' },
        { status: 400 }
      )
    }



    // Google Cloud Speech-to-Text認証情報の取得
    const credsEnvVar = process.env.GOOGLE_APPLICATION_CREDENTIALS
    if (!credsEnvVar) {
      return NextResponse.json(
        { error: 'Google Cloud認証情報が設定されていません' },
        { status: 500 }
      )
    }

    let credentials: any
    try {
      const credsStr = credsEnvVar.trim()
      if (credsStr.startsWith('{')) {
        credentials = JSON.parse(credsStr)
      } else {
        return NextResponse.json(
          { error: 'GOOGLE_APPLICATION_CREDENTIALSはJSON文字列である必要があります' },
          { status: 500 }
        )
      }
    } catch (parseError) {
      return NextResponse.json(
        { error: '認証情報のパースに失敗しました' },
        { status: 500 }
      )
    }

    // SpeechClientを初期化
    const speechClient = new SpeechClient({
      projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials,
    })

    console.log('[INTERVIEW] SpeechClient initialized')

    // ========== ステップ1: データベースから素材情報を取得 ==========
    console.log('[INTERVIEW] ========== STEP 1: Material from Database ==========')
    console.log('[INTERVIEW] Material ID:', material.id)
    console.log('[INTERVIEW] Material Type:', material.type)
    console.log('[INTERVIEW] Material File Name:', material.fileName)
    console.log('[INTERVIEW] Material MIME Type:', material.mimeType)
    console.log('[INTERVIEW] Material File Size:', material.fileSize ? `${(material.fileSize / 1024 / 1024).toFixed(2)} MB` : 'N/A')
    console.log('[INTERVIEW] Material File URL:', material.fileUrl || 'N/A')
    console.log('[INTERVIEW] Material File Path:', material.filePath || 'N/A')
    console.log('[INTERVIEW] Material Status:', material.status)
    console.log('[INTERVIEW] ====================================================')

    // ========== ステップ2: GCS URIを構築 ==========
    console.log('[INTERVIEW] ========== STEP 2: Building GCS URI ==========')
    let gcsUri: string
    let bucketName: string
    let filePath: string
    
    if (material.fileUrl && material.fileUrl.includes('storage.googleapis.com')) {
      const urlPattern = /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/
      const match = material.fileUrl.match(urlPattern)
      if (match && match[1] && match[2]) {
        bucketName = match[1]
        filePath = decodeURIComponent(match[2])
        gcsUri = `gs://${bucketName}/${filePath}`
        console.log('[INTERVIEW] ✓ GCS URI built from fileUrl')
        console.log('[INTERVIEW]   Bucket:', bucketName)
        console.log('[INTERVIEW]   File Path:', filePath)
        console.log('[INTERVIEW]   GCS URI:', gcsUri)
      } else {
        console.error('[INTERVIEW] ✗ Failed to parse fileUrl:', material.fileUrl)
        return NextResponse.json(
          { error: 'GCS URIの構築に失敗しました', details: `fileUrlの解析に失敗しました: ${material.fileUrl}` },
          { status: 500 }
        )
      }
    } else if (material.filePath) {
      bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
      filePath = material.filePath
      gcsUri = `gs://${bucketName}/${filePath}`
      console.log('[INTERVIEW] ✓ GCS URI built from filePath')
      console.log('[INTERVIEW]   Bucket:', bucketName)
      console.log('[INTERVIEW]   File Path:', filePath)
      console.log('[INTERVIEW]   GCS URI:', gcsUri)
    } else {
      console.error('[INTERVIEW] ✗ No fileUrl or filePath found')
      return NextResponse.json(
        { error: 'ファイルのURLまたはパスが見つかりません', details: 'material.fileUrlとmaterial.filePathの両方が設定されていません' },
        { status: 400 }
      )
    }
    console.log('[INTERVIEW] ================================================')

    // ========== ステップ3: Google Cloud Storageでファイルの存在確認 ==========
    console.log('[INTERVIEW] ========== STEP 3: Verifying File in GCS ==========')
    try {
      const storage = new Storage({
        projectId: credentials.project_id || process.env.GOOGLE_CLOUD_PROJECT_ID,
        credentials,
      })
      const bucket = storage.bucket(bucketName)
      const file = bucket.file(filePath)
      
      // ファイルの存在確認
      const [exists] = await file.exists()
      console.log('[INTERVIEW] File exists check:', exists ? '✓ YES' : '✗ NO')
      
      if (!exists) {
        console.error('[INTERVIEW] ✗ File does not exist in GCS')
        console.error('[INTERVIEW]   Bucket:', bucketName)
        console.error('[INTERVIEW]   File Path:', filePath)
        console.error('[INTERVIEW]   GCS URI:', gcsUri)
        return NextResponse.json(
          {
            error: 'ファイルがGoogle Cloud Storageに見つかりません',
            details: `ファイルがGCSに存在しません。\nバケット: ${bucketName}\nファイルパス: ${filePath}\n\n確認事項:\n1. ファイルが正しくアップロードされているか確認してください\n2. ファイルパスが正しいか確認してください`,
          },
          { status: 404 }
        )
      }
      
      // ファイルのメタデータを取得
      const [metadata] = await file.getMetadata()
      console.log('[INTERVIEW] ✓ File metadata retrieved')
      console.log('[INTERVIEW]   Content Type:', metadata.contentType || 'N/A')
      console.log('[INTERVIEW]   Size:', metadata.size ? `${(Number(metadata.size) / 1024 / 1024).toFixed(2)} MB` : 'N/A')
      console.log('[INTERVIEW]   Created:', metadata.timeCreated || 'N/A')
      console.log('[INTERVIEW]   Updated:', metadata.updated || 'N/A')
      
      // ファイルサイズの確認
      const fileSize = metadata.size ? Number(metadata.size) : 0
      if (fileSize === 0) {
        console.error('[INTERVIEW] ✗ File size is 0')
        return NextResponse.json(
          { error: 'ファイルサイズが0です', details: 'GCS上のファイルサイズが0バイトです。ファイルが正しくアップロードされていない可能性があります。' },
          { status: 400 }
        )
      }
      
      console.log('[INTERVIEW] ✓ File verification completed successfully')
    } catch (gcsError: any) {
      console.error('[INTERVIEW] ✗ GCS file verification failed')
      console.error('[INTERVIEW] Error:', gcsError?.message || 'Unknown error')
      console.error('[INTERVIEW] Error code:', gcsError?.code || 'N/A')
      
      if (gcsError?.code === 404 || gcsError?.message?.includes('Not found')) {
        return NextResponse.json(
          {
            error: 'ファイルがGoogle Cloud Storageに見つかりません',
            details: `ファイルがGCSに存在しません。\nバケット: ${bucketName}\nファイルパス: ${filePath}\n\n確認事項:\n1. ファイルが正しくアップロードされているか確認してください\n2. ファイルパスが正しいか確認してください`,
          },
          { status: 404 }
        )
      } else if (gcsError?.code === 403 || gcsError?.message?.includes('Forbidden')) {
        return NextResponse.json(
          {
            error: 'Google Cloud Storageへのアクセスが拒否されました',
            details: 'サービスアカウントにGoogle Cloud Storageへのアクセス権限がありません。',
          },
          { status: 403 }
        )
      } else {
        return NextResponse.json(
          {
            error: 'Google Cloud Storageの確認中にエラーが発生しました',
            details: gcsError?.message || '不明なエラー',
          },
          { status: 500 }
        )
      }
    }
    console.log('[INTERVIEW] ================================================')

    // プラン別のファイルサイズ制限を取得
    let plan: InterviewPlan = 'GUEST'
    let guestFirstAccessAt: Date | null = null

    if (userId) {
      // ログインユーザーの場合、サービス別サブスクリプションを取得
      const subscription = await prisma.userServiceSubscription.findUnique({
        where: {
          userId_serviceId: {
            userId,
            serviceId: 'interview',
          },
        },
      })

      plan = await getUserPlan(userId, null, subscription?.plan || null)
    } else if (guestId) {
      // ゲストユーザーの場合、ゲストセッションを取得
      const guestSession = await prisma.guestSession.findUnique({
        where: { guestId },
      })

      if (guestSession) {
        guestFirstAccessAt = guestSession.firstAccessAt
      }
      plan = 'GUEST'
    }

    // 有効なプランを取得（1時間使い放題機能を考慮）
    const effectivePlan = getEffectivePlan(plan, guestFirstAccessAt)

    // ファイルタイプを判定（後で使用するため、ここで定義）
    const isVideoFileCheck = material.type === 'video' || material.mimeType?.includes('video')
    const maxFileSize = getMaxFileSize(effectivePlan, isVideoFileCheck)

    // 動画ファイルが許可されていないプランの場合
    if (isVideoFileCheck && maxFileSize === 0) {
      return NextResponse.json(
        {
          error: '動画ファイルはアップロードできません',
          details: `現在のプラン（${effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan}）では動画ファイルのアップロードはできません。PROプランまたはEnterpriseプランにアップグレードしてください。`,
          errorCode: 'VIDEO_NOT_ALLOWED',
        },
        { status: 403 }
      )
    }

    // ファイルサイズチェック（プラン別の制限）
    if (material.fileSize && !isFileSizeWithinLimit(material.fileSize, effectivePlan, isVideoFileCheck)) {
      const maxSizeMB = (maxFileSize / 1024 / 1024).toFixed(0)
      const maxSizeGB = (maxFileSize / 1024 / 1024 / 1024).toFixed(2)
      const planName = effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan
      
      return NextResponse.json(
        {
          error: 'ファイルサイズが大きすぎます',
          details: `現在のプラン（${planName}）の最大ファイルサイズ: ${maxSizeGB}GB（${maxSizeMB}MB）を超えています。より大きなファイルをアップロードするには、プランをアップグレードしてください。`,
          errorCode: 'FILE_SIZE_EXCEEDED',
        },
        { status: 413 }
      )
    }

    // リクエスト設定 - MP4ファイルを処理できるように様々な設定を試す
    // GCS URIを使用する場合、encodingは設定しない（APIが自動検出）
    const isVideoFile = material.type === 'video' || material.mimeType?.includes('video')
    const isMP4File = material.fileName?.toLowerCase().endsWith('.mp4') || material.mimeType?.includes('mp4')
    const isLargeFile = (material.fileSize || 0) > 10 * 1024 * 1024 // 10MB以上

    // Cloud RunサービスURLをチェック（複数の環境変数名を試す）
    const cloudRunServiceUrl = 
      process.env.CLOUDRUN_TRANSCRIBE_SERVICE_URL ||
      process.env.NEXT_PUBLIC_CLOUDRUN_TRANSCRIBE_SERVICE_URL ||
      process.env.CLOUDRUN_SERVICE_URL
    
    console.log('[INTERVIEW] ========== Cloud Run Service Check ==========')
    console.log('[INTERVIEW] CLOUDRUN_TRANSCRIBE_SERVICE_URL:', cloudRunServiceUrl ? 'SET' : 'NOT SET')
    console.log('[INTERVIEW] Raw env check:', {
      CLOUDRUN_TRANSCRIBE_SERVICE_URL: process.env.CLOUDRUN_TRANSCRIBE_SERVICE_URL ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_CLOUDRUN_TRANSCRIBE_SERVICE_URL: process.env.NEXT_PUBLIC_CLOUDRUN_TRANSCRIBE_SERVICE_URL ? 'SET' : 'NOT SET',
      CLOUDRUN_SERVICE_URL: process.env.CLOUDRUN_SERVICE_URL ? 'SET' : 'NOT SET',
    })
    if (cloudRunServiceUrl) {
      console.log('[INTERVIEW] Service URL:', cloudRunServiceUrl)
    } else {
      console.error('[INTERVIEW] ⚠️ Cloud Run Service URL is NOT SET!')
      console.error('[INTERVIEW] This will cause MP4 files to fail with bad encoding errors.')
    }
    console.log('[INTERVIEW] ================================================')

    // MP4ファイルの場合は、Cloud Runサービスが必須
    if (isVideoFile && isMP4File && !cloudRunServiceUrl) {
      console.error('[INTERVIEW] ✗ MP4 file requires Cloud Run service, but CLOUDRUN_TRANSCRIBE_SERVICE_URL is not set')
      return NextResponse.json(
        {
          error: 'MP4ビデオファイルの処理にはCloud Runサービスが必要です',
          details: 'CLOUDRUN_TRANSCRIBE_SERVICE_URL環境変数が設定されていません。\n\n対処方法:\n1. Vercelダッシュボードで環境変数を設定してください\n2. 環境変数名: CLOUDRUN_TRANSCRIBE_SERVICE_URL\n3. 値: https://interview-transcribe-service-ww5nkbimya-an.a.run.app\n4. 環境変数を設定後、デプロイを実行してください',
          errorCode: 'CLOUDRUN_SERVICE_NOT_CONFIGURED',
        },
        { status: 500 }
      )
    }

    // Cloud Runサービスが設定されている場合、それを使用する（すべてのファイル）
    if (cloudRunServiceUrl) {
      console.log('[INTERVIEW] ========== STEP 4: Calling Cloud Run Service ==========')
      console.log('[INTERVIEW] Cloud Run Service URL:', cloudRunServiceUrl)
      console.log('[INTERVIEW] Request Audio:')
      console.log('[INTERVIEW]   URI:', gcsUri)
      console.log('[INTERVIEW]   Type:', isVideoFile ? 'video' : 'audio')
      console.log('[INTERVIEW]   File Name:', material.fileName)
      console.log('[INTERVIEW]   File Size:', `${((material.fileSize || 0) / 1024 / 1024).toFixed(2)} MB`)
      console.log('[INTERVIEW]   MIME Type:', material.mimeType || 'N/A')
      console.log('[INTERVIEW] ================================================')

      try {
        // Google Identity Tokenを取得
        const auth = new GoogleAuth({
          credentials,
        })
        
        console.log('[INTERVIEW] Getting ID token for Cloud Run service...')
        console.log('[INTERVIEW]   Target URL:', cloudRunServiceUrl)
        console.log('[INTERVIEW]   Service Account:', credentials.client_email || 'N/A')
        
        // IDトークンを取得（Cloud Runサービス用）
        // getIdTokenClientは自動的にIDトークンを取得してリクエストに含める
        const client = await auth.getIdTokenClient(cloudRunServiceUrl)
        
        console.log('[INTERVIEW] ✓ ID token client obtained')
        
        // requestメソッドを使用して自動的にIDトークンを取得してリクエストを送信
        // この方法は、IDトークンを自動的に取得してAuthorizationヘッダーに追加します
        const response = await client.request({
          url: `${cloudRunServiceUrl}/transcribe`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            gcsUri,
            mimeType: material.mimeType,
            fileName: material.fileName,
            isVideoFile,
            fileSize: material.fileSize || 0,
          },
        })

        console.log('[INTERVIEW] ✓ Request sent to Cloud Run service')
        console.log('[INTERVIEW]   Status:', response.status)
        console.log('[INTERVIEW]   Status Text:', response.statusText || 'N/A')

        if (response.status < 200 || response.status >= 300) {
          const errorData = (response.data as any) || { error: 'Unknown error' }
          console.error('[INTERVIEW] ✗ Cloud Run service error')
          console.error('[INTERVIEW]   Status:', response.status)
          console.error('[INTERVIEW]   Error:', errorData)
          console.error('[INTERVIEW]   Response headers:', response.headers)

          // 403エラーの場合、認証の問題である可能性が高い
          if (response.status === 403) {
            return NextResponse.json(
              {
                error: 'Cloud Runサービスへのアクセスが拒否されました',
                details: '認証に失敗しました。サービスアカウントの権限を確認してください。\n\nエラー詳細: ' + (errorData.error || JSON.stringify(errorData)),
                errorCode: 'AUTHENTICATION_FAILED',
              },
              { status: 403 }
            )
          }

          return NextResponse.json(
            {
              error: errorData.error || 'Cloud Runサービスの呼び出しに失敗しました',
              details: errorData.details || `HTTP ${response.status}`,
            },
            { status: response.status }
          )
        }

        const cloudRunResult = response.data as any
        console.log('[INTERVIEW] ✓ Cloud Run service response received')
        console.log('[INTERVIEW]   Success:', cloudRunResult.success)

        if (!cloudRunResult.success || !cloudRunResult.transcription) {
          console.error('[INTERVIEW] ✗ Invalid response from Cloud Run service')
          return NextResponse.json(
            {
              error: 'Cloud Runサービスからの応答が無効です',
              details: '文字起こし結果が含まれていません',
            },
            { status: 500 }
          )
        }

        const transcriptionText = cloudRunResult.transcription
        console.log('[INTERVIEW] ✓ Transcription text extracted')
        console.log('[INTERVIEW]   Text Length:', `${transcriptionText.length} characters`)
        console.log('[INTERVIEW]   Preview:', transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : ''))
        console.log('[INTERVIEW] ================================================')

        // データベースに保存
        const transcription = await prisma.interviewTranscription.create({
          data: {
            projectId,
            materialId,
            text: transcriptionText,
            provider: 'google-cloud-speech',
          },
        })

        // 素材のステータスを更新
        await prisma.interviewMaterial.update({
          where: { id: materialId },
          data: { status: 'COMPLETED' },
        })

        console.log(`[INTERVIEW] Transcription saved - ID: ${transcription.id}`)

        return NextResponse.json({ transcription })
      } catch (cloudRunError: any) {
        console.error('[INTERVIEW] ✗ Cloud Run service call failed')
        console.error('[INTERVIEW]   Error Type:', cloudRunError?.constructor?.name || typeof cloudRunError)
        console.error('[INTERVIEW]   Error Message:', cloudRunError?.message || cloudRunError)
        console.error('[INTERVIEW]   Error Code:', cloudRunError?.code || 'N/A')
        console.error('[INTERVIEW]   Error Response:', cloudRunError?.response?.data || cloudRunError?.response || 'N/A')
        console.error('[INTERVIEW]   Error Status:', cloudRunError?.response?.status || 'N/A')
        console.error('[INTERVIEW]   Error Status Text:', cloudRunError?.response?.statusText || 'N/A')
        console.error('[INTERVIEW]   Stack:', cloudRunError?.stack || 'N/A')

        // エラーレスポンスから詳細を取得
        let errorDetails = cloudRunError?.message || '不明なエラー'
        let errorCode = cloudRunError?.code || 'UNKNOWN_ERROR'
        let statusCode = 500

        if (cloudRunError?.response) {
          const responseData = cloudRunError.response.data || cloudRunError.response
          if (typeof responseData === 'string') {
            errorDetails = responseData
          } else if (responseData && typeof responseData === 'object') {
            errorDetails = responseData.error || responseData.details || JSON.stringify(responseData)
            errorCode = responseData.errorCode || errorCode
          }
          statusCode = cloudRunError.response.status || statusCode
        }

        return NextResponse.json(
          {
            error: 'Cloud Runサービスの呼び出しに失敗しました',
            details: errorDetails,
            errorCode: errorCode,
          },
          { status: statusCode }
        )
      }
    }

    // Cloud Runサービスが設定されていない場合、直接APIを呼び出す（既存の処理）
    // 注意: MP4ファイルの場合は上記でエラーを返すため、ここには到達しません
    // MP4ファイルの場合は上記でエラーを返すため、ここには到達しません
    // MP4以外のビデオファイルまたは音声ファイルの場合のみ実行
    const configPatterns: any[] = []

    if (isVideoFile && isMP4File) {
      // このコードには到達しないはずですが、念のため残しておきます
      // MP4ファイルの場合、複数の設定パターンを準備
      configPatterns.push(
        { languageCode: 'ja-JP' }, // パターン1: 最小限
        { languageCode: 'ja-JP', enableAutomaticPunctuation: true }, // パターン2
        { languageCode: 'ja-JP', model: 'video' }, // パターン3: 公式ドキュメント推奨
      )
      console.log('[INTERVIEW] MP4 video file: will try multiple config patterns')
    } else if (isVideoFile) {
      // MP4以外のビデオファイルの場合
      configPatterns.push({ languageCode: 'ja-JP', model: 'video' })
      console.log('[INTERVIEW] Video file (non-MP4): using model "video"')
    } else {
      // 音声ファイルの場合
      configPatterns.push({
        languageCode: 'ja-JP',
        model: 'latest_long',
        enableAutomaticPunctuation: true,
      })
      console.log('[INTERVIEW] Audio file: using model "latest_long"')
    }

    // ========== ステップ4: APIリクエストの準備 ==========
    console.log('[INTERVIEW] ========== STEP 4: Preparing API Request ==========')
    console.log(`[INTERVIEW] Config patterns prepared: ${configPatterns.length} pattern(s)`)
    console.log('[INTERVIEW] Request Audio:')
    console.log('[INTERVIEW]   URI:', gcsUri)
    console.log('[INTERVIEW]   Type:', isVideoFile ? 'video' : 'audio')
    console.log('[INTERVIEW]   File Name:', material.fileName)
    console.log('[INTERVIEW]   File Size:', `${((material.fileSize || 0) / 1024 / 1024).toFixed(2)} MB`)
    console.log('[INTERVIEW]   MIME Type:', material.mimeType || 'N/A')
    console.log('[INTERVIEW] ================================================')

    // ========== ステップ5: Google Cloud Speech-to-Text API呼び出し ==========
    console.log('[INTERVIEW] ========== STEP 5: Calling Speech-to-Text API ==========')
    console.log('[INTERVIEW] Method:', isVideoFile || isLargeFile ? 'longRunningRecognize' : 'recognize')
    console.log('[INTERVIEW] Reason:', isVideoFile ? 'Video file' : isLargeFile ? 'Large file (>10MB)' : 'Short audio file')
    
    // MP4ファイルの場合、複数の設定パターンを試す
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
      
      console.log(`[INTERVIEW] Trying config pattern ${patternIndex + 1}/${configPatterns.length}:`, JSON.stringify(currentConfig, null, 2))
      
      if (isVideoFile || isLargeFile) {
        // ビデオファイルや大きなファイルの場合はlongRunningRecognizeを使用
        console.log('[INTERVIEW] Calling longRunningRecognize...')
        const startTime = Date.now()
        
        try {
          const [operation] = await speechClient.longRunningRecognize(speechRequest)
          console.log('[INTERVIEW] ✓ Long-running operation started')
          console.log('[INTERVIEW]   Operation Name:', operation.name)
          console.log('[INTERVIEW]   Waiting for operation to complete...')
          
          const [operationResult] = await operation.promise()
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
          console.log('[INTERVIEW] ✓ Operation completed')
          console.log('[INTERVIEW]   Elapsed Time:', `${elapsedTime} seconds`)
          
          if (!operationResult.results || operationResult.results.length === 0) {
            console.error('[INTERVIEW] ✗ Empty transcription results')
            console.error('[INTERVIEW]   Operation Result:', JSON.stringify(operationResult, null, 2))
            return NextResponse.json(
              { error: '文字起こし結果が空です', details: 'APIは成功しましたが、文字起こし結果が空でした。音声が検出されなかった可能性があります。' },
              { status: 400 }
            )
          }

          console.log('[INTERVIEW] ✓ Transcription results received')
          console.log('[INTERVIEW]   Results Count:', operationResult.results.length)
          
          transcriptionText = operationResult.results
            .map((result: any) => result.alternatives?.[0]?.transcript || '')
            .filter((text: string) => text.trim().length > 0)
            .join(' ')
          
          console.log('[INTERVIEW] ✓ Transcription text extracted')
          console.log('[INTERVIEW]   Text Length:', `${transcriptionText.length} characters`)
          console.log('[INTERVIEW]   Preview:', transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : ''))
          console.log(`[INTERVIEW] ✓ Success with config pattern ${patternIndex + 1}`)
          break // 成功したらループを抜ける
        } catch (apiError: any) {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
          console.error(`[INTERVIEW] ✗ Config pattern ${patternIndex + 1} failed`)
          console.error('[INTERVIEW]   Elapsed Time:', `${elapsedTime} seconds`)
          console.error('[INTERVIEW]   Error Code:', apiError?.code || 'N/A')
          console.error('[INTERVIEW]   Error Message:', apiError?.message || 'N/A')
          console.error('[INTERVIEW]   Error Details:', apiError?.details || 'N/A')
          
          lastError = apiError
          
          // MP4ファイルで最後のパターンの場合、特別なエラーメッセージを返す
          if (patternIndex === configPatterns.length - 1) {
            if (isMP4File) {
              // MP4ファイルの場合、すべてのパターンで失敗した場合は特別なエラーメッセージを返す
              console.error('[INTERVIEW] All config patterns failed for MP4 file')
              return NextResponse.json(
                {
                  error: 'MP4ビデオファイルは直接処理できません',
                  details: 'Google Cloud Speech-to-Text APIはMP4ファイルを直接処理できません。\n\n対処方法:\n1. MP4ファイルから音声を抽出してください（FFmpegなどのツールを使用）\n2. 抽出した音声ファイル（MP3、WAV、FLACなど）をアップロードしてください\n\n参考: https://docs.cloud.google.com/speech-to-text/docs/v1/transcribe-audio-from-video-speech-to-text?hl=ja',
                  errorCode: 'MP4_NOT_SUPPORTED',
                },
                { status: 400 }
              )
            }
            throw apiError
          }
          
          // bad encodingエラーの場合、次のパターンを試す（最後のパターンでない場合のみ）
          if (apiError?.code === 3 && apiError?.details?.includes('bad encoding')) {
            if (patternIndex < configPatterns.length - 1) {
              console.log(`[INTERVIEW] Bad encoding error - trying next config pattern...`)
              continue
            }
          }
        }
      } else {
        // 短い音声ファイルの場合はrecognizeを使用
        console.log('[INTERVIEW] Calling recognize...')
        const startTime = Date.now()
        
        try {
          const [response] = await speechClient.recognize(speechRequest)
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
          console.log('[INTERVIEW] ✓ Recognize completed')
          console.log('[INTERVIEW]   Elapsed Time:', `${elapsedTime} seconds`)
        
          if (!response.results || response.results.length === 0) {
            console.error('[INTERVIEW] ✗ Empty transcription results')
            console.error('[INTERVIEW]   Response:', JSON.stringify(response, null, 2))
            return NextResponse.json(
              { error: '文字起こし結果が空です', details: 'APIは成功しましたが、文字起こし結果が空でした。音声が検出されなかった可能性があります。' },
              { status: 400 }
            )
          }

          console.log('[INTERVIEW] ✓ Transcription results received')
          console.log('[INTERVIEW]   Results Count:', response.results.length)
          
          transcriptionText = response.results
            .map((result: any) => result.alternatives?.[0]?.transcript || '')
            .filter((text: string) => text.trim().length > 0)
            .join(' ')
          
          console.log('[INTERVIEW] ✓ Transcription text extracted')
          console.log('[INTERVIEW]   Text Length:', `${transcriptionText.length} characters`)
          console.log('[INTERVIEW]   Preview:', transcriptionText.substring(0, 100) + (transcriptionText.length > 100 ? '...' : ''))
          console.log(`[INTERVIEW] ✓ Success with config pattern ${patternIndex + 1}`)
          break // 成功したらループを抜ける
        } catch (apiError: any) {
          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1)
          console.error(`[INTERVIEW] ✗ Config pattern ${patternIndex + 1} failed`)
          console.error('[INTERVIEW]   Elapsed Time:', `${elapsedTime} seconds`)
          console.error('[INTERVIEW]   Error Code:', apiError?.code || 'N/A')
          console.error('[INTERVIEW]   Error Message:', apiError?.message || 'N/A')
          console.error('[INTERVIEW]   Error Details:', apiError?.details || 'N/A')
          
          lastError = apiError
          
          // MP4ファイルで最後のパターンの場合、特別なエラーメッセージを返す
          if (patternIndex === configPatterns.length - 1) {
            if (isMP4File) {
              // MP4ファイルの場合、すべてのパターンで失敗した場合は特別なエラーメッセージを返す
              console.error('[INTERVIEW] All config patterns failed for MP4 file')
              return NextResponse.json(
                {
                  error: 'MP4ビデオファイルは直接処理できません',
                  details: 'Google Cloud Speech-to-Text APIはMP4ファイルを直接処理できません。\n\n対処方法:\n1. MP4ファイルから音声を抽出してください（FFmpegなどのツールを使用）\n2. 抽出した音声ファイル（MP3、WAV、FLACなど）をアップロードしてください\n\n参考: https://docs.cloud.google.com/speech-to-text/docs/v1/transcribe-audio-from-video-speech-to-text?hl=ja',
                  errorCode: 'MP4_NOT_SUPPORTED',
                },
                { status: 400 }
              )
            }
            throw apiError
          }
          
          // bad encodingエラーの場合、次のパターンを試す（最後のパターンでない場合のみ）
          if (apiError?.code === 3 && apiError?.details?.includes('bad encoding')) {
            if (patternIndex < configPatterns.length - 1) {
              console.log(`[INTERVIEW] Bad encoding error - trying next config pattern...`)
              continue
            }
          }
        }
      }
    }
    console.log('[INTERVIEW] ================================================')

    // MP4ファイルの場合、すべてのパターンが失敗した時に特別なエラーメッセージを返す
    if (!transcriptionText || transcriptionText.trim().length === 0) {
      if (isMP4File && lastError) {
        console.error('[INTERVIEW] All config patterns failed for MP4 file')
        return NextResponse.json(
          {
            error: 'MP4ビデオファイルは直接処理できません',
            details: 'Google Cloud Speech-to-Text APIはMP4ファイルを直接処理できません。\n\n対処方法:\n1. MP4ファイルから音声を抽出してください（FFmpegなどのツールを使用）\n2. 抽出した音声ファイル（MP3、WAV、FLACなど）をアップロードしてください\n\n参考: https://docs.cloud.google.com/speech-to-text/docs/v1/transcribe-audio-from-video-speech-to-text?hl=ja',
            errorCode: 'MP4_NOT_SUPPORTED',
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json(
        { error: '文字起こし結果が空です', details: lastError?.message || 'すべての設定パターンで失敗しました' },
        { status: 400 }
      )
    }

    // データベースに保存
    const transcription = await prisma.interviewTranscription.create({
      data: {
        projectId,
        materialId,
        text: transcriptionText,
        provider: 'google-cloud-speech',
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'COMPLETED' },
    })

    console.log(`[INTERVIEW] Transcription saved - ID: ${transcription.id}`)

    return NextResponse.json({ transcription })
  } catch (error: any) {
    console.error('[INTERVIEW] ========== ERROR OCCURRED ==========')
    console.error('[INTERVIEW] Error Type:', error?.constructor?.name || typeof error)
    console.error('[INTERVIEW] Error Code:', error?.code || 'N/A')
    console.error('[INTERVIEW] Error Message:', error?.message || 'N/A')
    console.error('[INTERVIEW] Error Details:', error?.details || 'N/A')
    console.error('[INTERVIEW] Error Stack:', error?.stack || 'N/A')
    
    // エラーが発生した段階を特定
    if (error?.message?.includes('GCS') || error?.message?.includes('Storage') || error?.code === 404) {
      console.error('[INTERVIEW] Error Location: STEP 3 (GCS File Verification)')
    } else if (error?.code === 3 || error?.details?.includes('bad encoding')) {
      console.error('[INTERVIEW] Error Location: STEP 5 (Speech-to-Text API Call)')
      console.error('[INTERVIEW] Error Type: Invalid Request / Bad Encoding')
    } else if (error?.code === 7) {
      console.error('[INTERVIEW] Error Location: STEP 5 (Speech-to-Text API Call)')
      console.error('[INTERVIEW] Error Type: Authentication / Permission')
    } else {
      console.error('[INTERVIEW] Error Location: Unknown (check logs above)')
    }
    console.error('[INTERVIEW] ===================================')
    
    let errorMessage = '文字起こしに失敗しました'
    let errorDetails = error?.message || '不明なエラー'

    // エラーコード別の処理
    if (error?.code === 3) {
      errorMessage = '無効なリクエストです'
      if (error?.details?.includes('bad encoding')) {
        errorDetails = 'エンコーディングエラーが発生しました。ファイル形式を確認してください。'
      }
    } else if (error?.code === 7) {
      errorMessage = '認証エラーが発生しました'
      if (error?.reason === 'SERVICE_DISABLED') {
        errorMessage = 'Google Cloud Speech-to-Text APIが有効化されていません'
        errorDetails = 'Google Cloud ConsoleでAPIを有効化してください。'
      } else {
        errorDetails = 'Google Cloud Speech-to-Text APIへのアクセス権限がありません。'
      }
    } else if (error?.code === 8) {
      errorMessage = 'リソースが不足しています'
      errorDetails = 'しばらく待ってから再度お試しください。'
    } else if (error?.code === 13) {
      errorMessage = '内部エラーが発生しました'
      errorDetails = 'Google Cloud Speech-to-Textサービスでエラーが発生しました。'
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
      },
      { status: 500 }
    )
  }
}
