import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LpGenerationResult } from '@/lib/lp-site/types'
import { v4 as uuidv4 } from 'uuid'

// 簡易的な公開ストア（本番環境ではDBを使用）
const publishStore = new Map<string, { lpData: LpGenerationResult; userId: string; createdAt: Date }>()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id || 'anonymous'

    const body = await request.json()
    const { lp_data } = body as { lp_data: LpGenerationResult }

    if (!lp_data) {
      return NextResponse.json(
        { error: 'LPデータが必須です' },
        { status: 400 }
      )
    }

    // 公開IDを生成
    const publishId = uuidv4()
    
    // 公開データを保存
    publishStore.set(publishId, {
      lpData: lp_data,
      userId,
      createdAt: new Date(),
    })

    const publishedUrl = `${request.nextUrl.origin}/lp-site/publish/${publishId}`

    return NextResponse.json({
      success: true,
      publish_id: publishId,
      published_url: publishedUrl,
    })
  } catch (error: any) {
    console.error('[LP-SITE] Publish error:', error)
    return NextResponse.json(
      {
        error: '公開に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const publishId = searchParams.get('id')

    if (!publishId) {
      return NextResponse.json(
        { error: '公開IDが必須です' },
        { status: 400 }
      )
    }

    const publishedData = publishStore.get(publishId)

    if (!publishedData) {
      return NextResponse.json(
        { error: '公開されたLPが見つかりませんでした' },
        { status: 404 }
      )
    }

    return NextResponse.json(publishedData.lpData)
  } catch (error: any) {
    console.error('[LP-SITE] Published LP load error:', error)
    return NextResponse.json(
      {
        error: '公開LPの読み込みに失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}


