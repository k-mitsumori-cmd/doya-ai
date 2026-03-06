import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getGuestIdFromRequest } from '@/lib/movie/access'
import { analyzeProduct } from '@/lib/movie/gemini'

export async function POST(req: NextRequest) {
  try {
    // 認証チェック（ログインユーザー or ゲスト）
    const session = await getServerSession(authOptions)
    const guestId = getGuestIdFromRequest(req)

    if (!session?.user?.email && !guestId) {
      return NextResponse.json({ error: '認証が必要です。ログインするかゲストとしてプロジェクトを作成してください。' }, { status: 401 })
    }

    const body = await req.json()
    const { name, url, description, features, target, usp, industry } = body

    const productInfo = await analyzeProduct({ name, url, description, features, target, usp, industry })
    return NextResponse.json({ productInfo })
  } catch (error) {
    console.error('[POST /api/movie/analyze-product]', error)
    return NextResponse.json({ error: '商品情報の解析に失敗しました' }, { status: 500 })
  }
}
