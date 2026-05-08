export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { generateImageWithFallback } from '@/lib/image-generator'

// ========================================
// テスト用: 統一画像ディスパッチャ疎通確認
// メイン: gpt-image-2 / フォールバック: nano-banana-pro-preview
// 入力画像あり → nano-banana-pro-preview 直行
// 認証: x-test-token ヘッダーが OPENAI_TEST_TOKEN と一致する必要あり
//
// curl 例:
//   curl -X POST http://localhost:3000/api/test/openai-image \
//     -H "Content-Type: application/json" \
//     -H "x-test-token: ${OPENAI_TEST_TOKEN}" \
//     -d '{"prompt":"a cute purple cat hugging a banana","quality":"low"}'
// ========================================

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-test-token')
  const expected = process.env.OPENAI_TEST_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: 'OPENAI_TEST_TOKEN が未設定です（.env.local に追加してください）' },
      { status: 500 }
    )
  }
  if (!token || token !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized: x-test-token ヘッダーが必要です' },
      { status: 401 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const prompt = String(body?.prompt || '').trim()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt が必要です' }, { status: 400 })
    }

    const size = String(body?.size || '1024x1024')
    const quality = (body?.quality as 'low' | 'medium' | 'high' | 'auto') || 'low'
    const inputImages = Array.isArray(body?.inputImages) ? body.inputImages : []

    const t0 = Date.now()
    const result = await generateImageWithFallback({
      prompt,
      size,
      quality,
      inputImages,
    })
    const elapsedMs = Date.now() - t0

    return NextResponse.json({
      success: true,
      model: result.model,
      fallbackUsed: result.fallbackUsed,
      primaryError: result.primaryError,
      mimeType: result.mimeType,
      size,
      quality,
      elapsedMs,
      dataUrl: `data:${result.mimeType};base64,${result.base64}`,
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'unknown error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: '/api/test/openai-image',
    method: 'POST',
    auth: 'x-test-token ヘッダー (OPENAI_TEST_TOKEN と一致)',
    body: {
      prompt: 'string (必須)',
      size: '1024x1024 | 1024x1536 | 1536x1024 | auto',
      quality: 'low | medium | high | auto',
      inputImages: '{ mimeType, base64 }[] (省略可、ありなら nano-banana-pro-preview 直行)',
    },
  })
}
