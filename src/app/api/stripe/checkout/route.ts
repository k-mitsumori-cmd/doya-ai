import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCheckoutSession, STRIPE_PRICE_IDS } from '@/lib/stripe'

// ========================================
// Checkout Session作成API
// ========================================
// POST /api/stripe/checkout
// Body: { planId: string, billingPeriod: 'monthly' | 'yearly' }

export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'ログインが必要です' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { planId, billingPeriod = 'monthly' } = body

    // プランIDからStripe価格IDを取得
    const priceId = getPriceId(planId, billingPeriod)
    if (!priceId) {
      return NextResponse.json(
        { error: '無効なプランIDです' },
        { status: 400 }
      )
    }

    // ベースURL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.vercel.app'
    
    // サービスに応じたリダイレクトURL
    const service = planId.split('-')[0] // 'seo-pro' -> 'seo'
    const successPath =
      service === 'seo'
        ? '/seo'
        : service === 'banner'
          ? '/banner/dashboard'
          : '/'
    const cancelPath =
      service === 'seo'
        ? '/pricing?payment=cancelled'
        : service === 'banner'
          ? '/banner/pricing?payment=cancelled'
          : '/pricing?payment=cancelled'

    const successUrl = `${baseUrl}${successPath}?payment=success`
    const cancelUrl = `${baseUrl}${cancelPath}`

    // Checkout Session作成
    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: (session.user as any).id || session.user.email,
      userEmail: session.user.email,
      successUrl,
      cancelUrl,
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })

  } catch (error: any) {
    console.error('Checkout session error:', error)
    return NextResponse.json(
      { error: error.message || '決済セッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}

// プランIDからStripe価格IDを取得
function getPriceId(planId: string, billingPeriod: 'monthly' | 'yearly'): string | null {
  const priceMap: Record<string, { monthly: string; yearly: string }> = {
    // ドヤSEO
    'seo-pro': STRIPE_PRICE_IDS.seo.pro,
    'seo-business': STRIPE_PRICE_IDS.seo.business,
    // ドヤバナーAI
    'banner-starter': STRIPE_PRICE_IDS.banner.starter,
    'banner-pro': STRIPE_PRICE_IDS.banner.pro,
    'banner-business': STRIPE_PRICE_IDS.banner.business,
    // セットプラン
    'bundle': STRIPE_PRICE_IDS.bundle,
  }

  const prices = priceMap[planId]
  if (!prices) return null

  return prices[billingPeriod]
}
