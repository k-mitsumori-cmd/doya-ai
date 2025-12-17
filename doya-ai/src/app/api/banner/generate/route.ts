import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured } from '@/lib/nanobanner'

// レート制限用（簡易的な実装）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX_GUEST = 3 // ゲストは1分あたり3リクエストまで
const RATE_LIMIT_MAX_USER = 10 // ログインユーザーは1分あたり10リクエストまで

function checkRateLimit(ip: string, isGuest: boolean): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  const maxRequests = isGuest ? RATE_LIMIT_MAX_GUEST : RATE_LIMIT_MAX_USER
  
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // セッションチェック
    const session = await getServerSession(authOptions)
    const isGuest = !session

    // IPアドレスを取得
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // レート制限チェック
    if (!checkRateLimit(ip, isGuest)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。1分ほど待ってから再試行してください。' },
        { status: 429 }
      )
    }

    // リクエストボディを取得
    const body = await request.json()
    const { category, keyword, size } = body

    // バリデーション
    if (!category || typeof category !== 'string') {
      return NextResponse.json(
        { error: 'カテゴリを選択してください' },
        { status: 400 }
      )
    }

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: '訴求内容を入力してください' },
        { status: 400 }
      )
    }

    if (keyword.length > 200) {
      return NextResponse.json(
        { error: '訴求内容は200文字以内で入力してください' },
        { status: 400 }
      )
    }

    // API設定チェック
    if (!isNanobannerConfigured()) {
      console.warn('Nanobanner API is not configured')
      return NextResponse.json(
        { error: 'バナー生成APIが設定されていません。管理者にお問い合わせください。' },
        { status: 503 }
      )
    }

    console.log(`Banner generation request - Category: ${category}, Size: ${size}, Guest: ${isGuest}`)

    // バナー生成
    const result = await generateBanners(
      category,
      keyword.trim(),
      size || '1080x1080'
    )

    if (result.error && result.banners.length === 0) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      banners: result.banners,
      isGuest,
      warning: result.error, // 一部失敗した場合の警告
    })

  } catch (error: any) {
    console.error('Banner generation API error:', error)
    
    return NextResponse.json(
      { error: 'バナー生成中にエラーが発生しました。しばらく待ってから再試行してください。' },
      { status: 500 }
    )
  }
}

// GETメソッドは許可しない
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}
