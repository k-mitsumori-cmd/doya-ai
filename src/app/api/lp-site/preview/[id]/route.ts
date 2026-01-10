import { NextRequest, NextResponse } from 'next/server'

// 簡易的なメモリストア（本番環境ではDBを使用）
const previewStore = new Map<string, any>()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const previewId = params.id
    const lpData = previewStore.get(previewId)

    if (!lpData) {
      return NextResponse.json(
        { error: 'プレビューが見つかりませんでした' },
        { status: 404 }
      )
    }

    return NextResponse.json(lpData)
  } catch (error: any) {
    console.error('[LP-SITE] Preview load error:', error)
    return NextResponse.json(
      {
        error: 'プレビューの読み込みに失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

// プレビューデータを保存（POST）
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const previewId = params.id
    const body = await request.json()
    
    previewStore.set(previewId, body)

    return NextResponse.json({
      success: true,
      preview_id: previewId,
      preview_url: `/lp-site/preview/${previewId}`,
    })
  } catch (error: any) {
    console.error('[LP-SITE] Preview save error:', error)
    return NextResponse.json(
      {
        error: 'プレビューの保存に失敗しました',
        details: error.message,
      },
      { status: 500 }
    )
  }
}

