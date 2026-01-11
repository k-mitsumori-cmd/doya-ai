import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleAuth } from 'google-auth-library'
import { getUserPlan, getMaxFileSize, getEffectivePlan, isFileSizeWithinLimit, type InterviewPlan } from '@/lib/interview/planLimits'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60 // ジョブ開始のみなので短時間で完了

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || null
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

    // プラン別のファイルサイズ制限を取得
    let plan: InterviewPlan = 'GUEST'
    let guestFirstAccessAt: Date | null = null

    if (userId) {
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
      const guestSession = await (prisma as any).guestSession.findUnique({
        where: { guestId },
      })
      if (guestSession) {
        guestFirstAccessAt = guestSession.firstAccessAt
      }
      plan = 'GUEST'
    }

    const effectivePlan = getEffectivePlan(plan, guestFirstAccessAt)
    const isVideoFile = material.type === 'video' || material.mimeType?.includes('video')
    const maxFileSize = getMaxFileSize(effectivePlan, isVideoFile)

    // 動画ファイルが許可されていないプランの場合
    if (isVideoFile && maxFileSize === 0) {
      return NextResponse.json(
        {
          error: '動画ファイルはアップロードできません',
          details: `現在のプラン（${effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan}）では動画ファイルのアップロードはできません。PROプランまたはEnterpriseプランにアップグレードしてください。`,
          errorCode: 'VIDEO_NOT_ALLOWED',
        },
        { status: 403 }
      )
    }

    // ファイルサイズチェック
    if (material.fileSize && !isFileSizeWithinLimit(material.fileSize, effectivePlan, isVideoFile)) {
      const maxSizeMB = (maxFileSize / 1024 / 1024).toFixed(0)
      const maxSizeGB = (maxFileSize / 1024 / 1024 / 1024).toFixed(2)
      const planName = effectivePlan === 'GUEST' ? 'ゲスト' : effectivePlan === 'FREE' ? '無料' : effectivePlan
      
      return NextResponse.json(
        {
          error: 'ファイルサイズが大きすぎます',
          details: `現在のプラン（${planName}）の最大ファイルサイズ: ${maxSizeGB}GB（${maxSizeMB}MB）を超えています。`,
          errorCode: 'FILE_SIZE_EXCEEDED',
        },
        { status: 413 }
      )
    }

    // GCS URIを構築
    const fileUrl = material.fileUrl
    if (!fileUrl) {
      return NextResponse.json(
        { error: 'ファイルURLが見つかりません' },
        { status: 400 }
      )
    }

    const gcsUri = fileUrl.replace('https://storage.googleapis.com/', 'gs://')

    // 文字起こしジョブを作成
    const jobId = uuidv4()
    const transcription = await prisma.interviewTranscription.create({
      data: {
        projectId,
        materialId,
        text: '', // 空文字列で初期化
        provider: 'google-cloud-speech-cloudrun',
        status: 'PROCESSING', // 処理中
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'PROCESSING' },
    })

    // バックグラウンドで処理を開始（非同期）
    // 注意: この処理は即座に完了し、実際の文字起こしはバックグラウンドで実行される
    processTranscriptionInBackground({
      transcriptionId: transcription.id,
      materialId,
      projectId,
      gcsUri,
      mimeType: material.mimeType,
      fileName: material.fileName,
      isVideoFile,
      fileSize: material.fileSize || 0,
      credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      cloudRunServiceUrl: process.env.CLOUDRUN_TRANSCRIBE_SERVICE_URL || process.env.NEXT_PUBLIC_CLOUDRUN_TRANSCRIBE_SERVICE_URL || process.env.CLOUDRUN_SERVICE_URL,
    }).catch((error) => {
      console.error('[INTERVIEW] Background transcription error:', error)
      // エラー時はステータスを更新
      prisma.interviewTranscription.update({
        where: { id: transcription.id },
        data: {
          status: 'ERROR',
          text: `エラー: ${error.message || 'Unknown error'}`,
        },
      }).catch(console.error)
      prisma.interviewMaterial.update({
        where: { id: materialId },
        data: { status: 'ERROR', error: error.message || 'Unknown error' },
      }).catch(console.error)
    })

    return NextResponse.json({
      jobId,
      transcriptionId: transcription.id,
      status: 'PROCESSING',
      message: '文字起こし処理を開始しました',
    })
  } catch (error: any) {
    console.error('[INTERVIEW] Start transcription error:', error)
    return NextResponse.json(
      {
        error: '文字起こし処理の開始に失敗しました',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// バックグラウンドで文字起こし処理を実行
async function processTranscriptionInBackground({
  transcriptionId,
  materialId,
  projectId,
  gcsUri,
  mimeType,
  fileName,
  isVideoFile,
  fileSize,
  credentials,
  cloudRunServiceUrl,
}: {
  transcriptionId: string
  materialId: string
  projectId: string
  gcsUri: string
  mimeType: string | null
  fileName: string
  isVideoFile: boolean
  fileSize: number
  credentials: string | undefined
  cloudRunServiceUrl: string | undefined
}) {
  try {
    if (!cloudRunServiceUrl) {
      throw new Error('Cloud RunサービスURLが設定されていません')
    }

    if (!credentials) {
      throw new Error('Google Cloud認証情報が設定されていません')
    }

    let creds: any
    try {
      const credsStr = credentials.trim()
      if (credsStr.startsWith('{')) {
        creds = JSON.parse(credsStr)
      } else {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALSはJSON文字列である必要があります')
      }
    } catch (parseError) {
      throw new Error(`認証情報のパースに失敗しました: ${parseError}`)
    }

    // Google Identity Tokenを取得
    const auth = new GoogleAuth({ credentials: creds })
    const client = await auth.getIdTokenClient(cloudRunServiceUrl)

    console.log('[INTERVIEW] Starting background transcription:', transcriptionId)

    // Cloud Runサービスを呼び出し
    const response = await client.request({
      url: `${cloudRunServiceUrl}/transcribe`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        gcsUri,
        mimeType,
        fileName,
        isVideoFile,
        fileSize,
      },
    })

    if (response.status < 200 || response.status >= 300) {
      const errorData = (response.data as any) || { error: 'Unknown error' }
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const cloudRunResult = response.data as any
    if (!cloudRunResult.success || !cloudRunResult.transcription) {
      throw new Error('Cloud Runサービスからの応答が無効です')
    }

    const transcriptionText = cloudRunResult.transcription

    // データベースに保存
    await prisma.interviewTranscription.update({
      where: { id: transcriptionId },
      data: {
        text: transcriptionText,
        status: 'COMPLETED',
      },
    })

    // 素材のステータスを更新
    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: { status: 'COMPLETED' },
    })

    console.log('[INTERVIEW] Background transcription completed:', transcriptionId)
  } catch (error: any) {
    console.error('[INTERVIEW] Background transcription error:', error)
    
    // エラーをデータベースに記録
    await prisma.interviewTranscription.update({
      where: { id: transcriptionId },
      data: {
        status: 'ERROR',
        text: `エラー: ${error.message || 'Unknown error'}`,
      },
    }).catch(console.error)

    await prisma.interviewMaterial.update({
      where: { id: materialId },
      data: {
        status: 'ERROR',
        error: error.message || 'Unknown error',
      },
    }).catch(console.error)

    throw error
  }
}

