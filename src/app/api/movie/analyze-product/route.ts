import { NextRequest, NextResponse } from 'next/server'
import { analyzeProduct } from '@/lib/movie/gemini'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, url, description, features, target, usp, industry } = body

    const productInfo = await analyzeProduct({ name, url, description, features, target, usp, industry })
    return NextResponse.json({ productInfo })
  } catch (error) {
    console.error('[POST /api/movie/analyze-product]', error)
    return NextResponse.json({ error: '商品情報の解析に失敗しました' }, { status: 500 })
  }
}
