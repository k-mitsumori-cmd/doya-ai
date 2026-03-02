// ============================================
// POST /api/copy/generate-persona
// ============================================
// productInfoからターゲットペルソナを自動生成

import { NextRequest, NextResponse } from 'next/server'
import { generatePersonaFromProduct } from '@/lib/copy/gemini'
import type { ProductInfo } from '@/lib/copy/gemini'

export async function POST(req: NextRequest) {
  try {
    const { productInfo } = await req.json() as { productInfo: ProductInfo }

    if (!productInfo?.productName) {
      return NextResponse.json({ error: '商品情報が必要です' }, { status: 400 })
    }

    const persona = await generatePersonaFromProduct(productInfo)

    return NextResponse.json({ success: true, persona })
  } catch (error: any) {
    console.error('Copy generate-persona error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
