import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SpeechClient } from '@google-cloud/speech'

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

    // GCS URIを構築
    let gcsUri: string
    if (material.fileUrl && material.fileUrl.includes('storage.googleapis.com')) {
      const urlPattern = /https:\/\/storage\.googleapis\.com\/([^/]+)\/(.+)$/
      const match = material.fileUrl.match(urlPattern)
      if (match && match[1] && match[2]) {
        gcsUri = `gs://${match[1]}/${decodeURIComponent(match[2])}`
      } else {
        return NextResponse.json(
          { error: 'GCS URIの構築に失敗しました' },
          { status: 500 }
        )
      }
    } else if (material.filePath) {
      const bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
      gcsUri = `gs://${bucketName}/${material.filePath}`
    } else {
      return NextResponse.json(
        { error: 'ファイルのURLまたはパスが見つかりません' },
        { status: 400 }
      )
    }

    // ファイルサイズチェック（1GB制限）
    const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB
    if (material.fileSize && material.fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます（最大1GB）' },
        { status: 413 }
      )
    }

    // リクエスト設定
    // 重要: GCS URIを使用する場合、encodingは設定しない（APIが自動検出）
    const isVideoFile = material.type === 'video' || material.mimeType?.includes('video')
    const isLargeFile = (material.fileSize || 0) > 10 * 1024 * 1024 // 10MB以上

    // MP4ビデオファイルの場合、languageCodeのみを使用（最小限の設定）
    // alternativeLanguageCodesやenableAutomaticPunctuationが"bad encoding"エラーを引き起こす可能性がある
    const requestConfig: any = {
      languageCode: 'ja-JP',
    }

    // 音声ファイルの場合のみ、追加のパラメータを設定
    if (!isVideoFile) {
      requestConfig.alternativeLanguageCodes = ['en-US']
      requestConfig.enableAutomaticPunctuation = true
      requestConfig.model = 'latest_long'
    }

    const speechRequest = {
      config: requestConfig,
      audio: {
        uri: gcsUri,
      },
    }

    console.log(`[INTERVIEW] Starting transcription - File: ${material.fileName}, Type: ${isVideoFile ? 'video' : 'audio'}, Size: ${((material.fileSize || 0) / 1024 / 1024).toFixed(2)} MB, GCS URI: ${gcsUri}`)

    // 文字起こしを実行
    let transcriptionText: string
    if (isVideoFile || isLargeFile) {
      // ビデオファイルや大きなファイルの場合はlongRunningRecognizeを使用
      const [operation] = await speechClient.longRunningRecognize(speechRequest)
      const [operationResult] = await operation.promise()
      
      if (!operationResult.results || operationResult.results.length === 0) {
        return NextResponse.json(
          { error: '文字起こし結果が空です' },
          { status: 400 }
        )
      }

      transcriptionText = operationResult.results
        .map((result: any) => result.alternatives?.[0]?.transcript || '')
        .filter((text: string) => text.trim().length > 0)
        .join(' ')
      
      console.log(`[INTERVIEW] Transcription completed (longRunningRecognize) - ${transcriptionText.length} characters`)
    } else {
      // 短い音声ファイルの場合はrecognizeを使用
      const [response] = await speechClient.recognize(speechRequest)
      
      if (!response.results || response.results.length === 0) {
        return NextResponse.json(
          { error: '文字起こし結果が空です' },
          { status: 400 }
        )
      }

      transcriptionText = response.results
        .map((result: any) => result.alternatives?.[0]?.transcript || '')
        .filter((text: string) => text.trim().length > 0)
        .join(' ')
      
      console.log(`[INTERVIEW] Transcription completed (recognize) - ${transcriptionText.length} characters`)
    }

    if (!transcriptionText || transcriptionText.trim().length === 0) {
      return NextResponse.json(
        { error: '文字起こし結果が空です' },
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
    console.error('[INTERVIEW] Transcription error:', error)
    
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
