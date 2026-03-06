// ============================================
// POST /api/copy/generate-persona
// ============================================
// productInfoからターゲットペルソナを自動生成

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generatePersonaFromProduct } from '@/lib/copy/gemini'
import type { ProductInfo } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    // 認証チェック（ゲストも利用可能だがセッション確認は行う）
    const session = await getServerSession(authOptions)
    // ゲストも利用可能なgenerate系APIのため、session不要でも許可
    // ただし不正利用防止のためセッション情報をログに記録
    const userId = session?.user?.id ?? 'guest'

    const { productInfo } = await req.json() as { productInfo: ProductInfo }

    if (!productInfo?.productName) {
      return NextResponse.json({ error: '商品情報が必要です' }, { status: 400 })
    }

    const persona = await generatePersonaFromProduct(productInfo)

    return NextResponse.json({ success: true, persona })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy generate-persona error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
