import { NextRequest, NextResponse } from 'next/server'

// 簡易的なメモリストア（本番環境ではDBを使用）
const previewStore = new Map<string, any>()

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 14/15互換性のため、Promiseの場合はawait
    const resolvedParams = context.params instanceof Promise ? await context.params : context.params
    const previewId = resolvedParams.id
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
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Next.js 14/15互換性のため、Promiseの場合はawait
    const resolvedParams = context.params instanceof Promise ? await context.params : context.params
    const previewId = resolvedParams.id
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

