import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Google Cloud Run音声変換サービスを呼び出すエンドポイント
 * 
 * このエンドポイントは既存の /api/interview/transcribe/route.ts に影響を与えません。
 * 大きなファイルや長時間の音声ファイルを効率的に処理するためにCloud Runサービスを使用します。
 */
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

    // Cloud RunサービスのURLを取得
    const cloudRunServiceUrl = process.env.CLOUDRUN_TRANSCRIBE_SERVICE_URL
    if (!cloudRunServiceUrl) {
      console.error('[INTERVIEW-CLOUDRUN] CLOUDRUN_TRANSCRIBE_SERVICE_URL is not set')
      return NextResponse.json(
        {
          error: 'Cloud RunサービスのURLが設定されていません',
          details: '環境変数 CLOUDRUN_TRANSCRIBE_SERVICE_URL を設定してください',
        },
        { status: 500 }
      )
    }

    // GCS URIを構築
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
        console.log('[INTERVIEW-CLOUDRUN] ✓ GCS URI built from fileUrl')
        console.log('[INTERVIEW-CLOUDRUN]   Bucket:', bucketName)
        console.log('[INTERVIEW-CLOUDRUN]   File Path:', filePath)
        console.log('[INTERVIEW-CLOUDRUN]   GCS URI:', gcsUri)
      } else {
        console.error('[INTERVIEW-CLOUDRUN] ✗ Failed to parse fileUrl:', material.fileUrl)
        return NextResponse.json(
          { error: 'GCS URIの構築に失敗しました', details: `fileUrlの解析に失敗しました: ${material.fileUrl}` },
          { status: 500 }
        )
      }
    } else if (material.filePath) {
      bucketName = process.env.GCS_BUCKET_NAME || 'doya-interview-storage'
      filePath = material.filePath
      gcsUri = `gs://${bucketName}/${filePath}`
      console.log('[INTERVIEW-CLOUDRUN] ✓ GCS URI built from filePath')
      console.log('[INTERVIEW-CLOUDRUN]   Bucket:', bucketName)
      console.log('[INTERVIEW-CLOUDRUN]   File Path:', filePath)
      console.log('[INTERVIEW-CLOUDRUN]   GCS URI:', gcsUri)
    } else {
      console.error('[INTERVIEW-CLOUDRUN] ✗ No fileUrl or filePath found')
      return NextResponse.json(
        { error: 'ファイルのURLまたはパスが見つかりません', details: 'material.fileUrlとmaterial.filePathの両方が設定されていません' },
        { status: 400 }
      )
    }

    // Cloud Runサービスにリクエストを送信
    console.log('[INTERVIEW-CLOUDRUN] Sending request to Cloud Run service')
    console.log('[INTERVIEW-CLOUDRUN] Service URL:', cloudRunServiceUrl)
    console.log('[INTERVIEW-CLOUDRUN] GCS URI:', gcsUri)

    const isVideoFile = material.type === 'video' || material.mimeType?.includes('video')

    const cloudRunResponse = await fetch(`${cloudRunServiceUrl}/transcribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        gcsUri,
        mimeType: material.mimeType,
        fileName: material.fileName,
        isVideoFile,
        fileSize: material.fileSize ? Number(material.fileSize) : 0,
      }),
    })

    if (!cloudRunResponse.ok) {
      const errorData = await cloudRunResponse.json().catch(() => ({}))
      console.error('[INTERVIEW-CLOUDRUN] Cloud Run service error:', errorData)
      
      let errorMessage = '音声変換に失敗しました'
      let errorDetails = errorData.details || errorData.error || 'Unknown error'
      let statusCode = cloudRunResponse.status

      // Cloud Runサービスのエラーを適切に変換
      if (errorData.code === 3) {
        errorMessage = '無効なリクエストです'
        if (errorDetails.includes('bad encoding')) {
          errorDetails = 'エンコーディングエラーが発生しました。ファイル形式を確認してください。'
        }
      } else if (errorData.code === 7) {
        errorMessage = '認証エラーが発生しました'
        if (errorData.reason === 'SERVICE_DISABLED') {
          errorMessage = 'Google Cloud Speech-to-Text APIが有効化されていません'
          errorDetails = 'Google Cloud ConsoleでAPIを有効化してください。'
        } else {
          errorDetails = 'Google Cloud Speech-to-Text APIへのアクセス権限がありません。'
        }
      } else if (errorData.code === 8) {
        errorMessage = 'リソースが不足しています'
        errorDetails = 'しばらく待ってから再度お試しください。'
        statusCode = 503
      } else if (errorData.code === 13) {
        errorMessage = '内部エラーが発生しました'
        errorDetails = 'Google Cloud Speech-to-Textサービスでエラーが発生しました。'
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: errorDetails,
          code: errorData.code,
        },
        { status: statusCode }
      )
    }

    const cloudRunData = await cloudRunResponse.json()
    console.log('[INTERVIEW-CLOUDRUN] ✓ Transcription completed')
    console.log('[INTERVIEW-CLOUDRUN]   Text Length:', cloudRunData.transcription?.length || 0)

    if (!cloudRunData.transcription || cloudRunData.transcription.trim().length === 0) {
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
        text: cloudRunData.transcription,
        provider: 'google-cloud-speech-cloudrun',
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'COMPLETED' },
    })

    console.log(`[INTERVIEW-CLOUDRUN] Transcription saved - ID: ${transcription.id}`)

    return NextResponse.json({ transcription })
  } catch (error: any) {
    console.error('[INTERVIEW-CLOUDRUN] ========== ERROR OCCURRED ==========')
    console.error('[INTERVIEW-CLOUDRUN] Error Type:', error?.constructor?.name || typeof error)
    console.error('[INTERVIEW-CLOUDRUN] Error Code:', error?.code || 'N/A')
    console.error('[INTERVIEW-CLOUDRUN] Error Message:', error?.message || 'N/A')
    console.error('[INTERVIEW-CLOUDRUN] Error Details:', error?.details || 'N/A')
    console.error('[INTERVIEW-CLOUDRUN] Error Stack:', error?.stack || 'N/A')
    console.error('[INTERVIEW-CLOUDRUN] ===================================')

    // ネットワークエラーの処理
    if (error?.code === 'ECONNREFUSED' || error?.message?.includes('fetch failed')) {
      return NextResponse.json(
        {
          error: 'Cloud Runサービスに接続できませんでした',
          details: 'サービスが起動しているか、URLが正しいか確認してください。',
        },
        { status: 503 }
      )
    }

    return NextResponse.json(
      {
        error: '文字起こしに失敗しました',
        details: error?.message || '不明なエラー',
      },
      { status: 500 }
    )
  }
}

