import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateBanners, isNanobannerConfigured } from '@/lib/nanobanner'

// レート制限用（簡易的な実装）
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1分
const RATE_LIMIT_MAX = 5 // 1分あたり5リクエストまで

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || record.resetTime < now) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    // IPアドレスを取得
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // レート制限チェック
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'リクエストが多すぎます。しばらく待ってから再試行してください。' },
        { status: 429 }
      )
    }

    // API設定チェック
    if (!isNanobannerConfigured()) {
      console.warn('Nanobanner API is not configured, using mock data')
      // モックデータを返す（API未設定時）
      const { category, size } = await request.json()
      const mockBanners = [
        `https://via.placeholder.com/${size?.replace('x', '/') || '1080/1080'}/8B5CF6/FFFFFF?text=A`,
        `https://via.placeholder.com/${size?.replace('x', '/') || '1080/1080'}/EC4899/FFFFFF?text=B`,
        `https://via.placeholder.com/${size?.replace('x', '/') || '1080/1080'}/10B981/FFFFFF?text=C`,
      ]
      return NextResponse.json({ 
        banners: mockBanners,
        isMock: true,
        message: 'API未設定のためモックデータを返しています'
      })
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

    // セッションチェック（ゲストも許可、ただしログインユーザーは優先）
    const session = await getServerSession(authOptions)
    const isGuest = !session

    // ゲストの場合のチェック（フロントエンドでも制御しているが念のため）
    if (isGuest) {
      // 本番環境ではここでゲストの使用回数をサーバーサイドでも管理することを推奨
      console.log(`Guest banner generation request from IP: ${ip}`)
    }

    // バナー生成
    const result = await generateBanners(
      category,
      keyword.trim(),
      size || '1080x1080'
    )

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      banners: result.banners,
      isGuest,
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

