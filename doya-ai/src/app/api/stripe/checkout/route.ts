import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCheckoutSession, STRIPE_PRICE_IDS } from '@/lib/stripe'

function getStripeKeyMode(): 'test' | 'live' | 'unknown' {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim()
  if (key.startsWith('sk_test_')) return 'test'
  if (key.startsWith('sk_live_')) return 'live'
  return 'unknown'
}

function looksLikeStripeModeMismatch(err: any): boolean {
  const msg = String(err?.message || err?.raw?.message || '').toLowerCase()
  return (
    msg.includes('a similar object exists in live mode') ||
    msg.includes('a similar object exists in test mode') ||
    (msg.includes('no such price') && msg.includes('live mode') && msg.includes('test mode'))
  )
}

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
          ? '/banner'
          : '/'
    const cancelPath =
      service === 'seo'
        ? '/pricing?payment=cancelled'
        : service === 'banner'
          ? '/banner?payment=cancelled'
          : '/pricing?payment=cancelled'

    // 成功URLにプラン情報を追加（お祝いモーダル表示用）
    const planLabel = planId.includes('enterprise') ? 'enterprise' : 'pro'
    const successUrl = `${baseUrl}${successPath}?success=true&plan=${planLabel}`
    const cancelUrl = `${baseUrl}${cancelPath}`

    // Checkout Session作成
    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: (session.user as any).id || session.user.email,
      userEmail: session.user.email,
      successUrl,
      cancelUrl,
      metadata: {
        planId,
        serviceId: service,
      },
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    })

  } catch (error: any) {
    console.error('Checkout session error:', error)

    // Stripeの「test/liveモード不一致」をユーザーが復旧できる形で案内
    if (looksLikeStripeModeMismatch(error)) {
      const mode = getStripeKeyMode()
      return NextResponse.json(
        {
          code: 'STRIPE_MODE_MISMATCH',
          error:
            '決済設定エラー（Stripeのモード不一致）です。' +
            'このPrice IDはライブモード側に存在しますが、サーバーがテスト用Stripeキーでリクエストしています。' +
            'Vercel環境変数の STRIPE_SECRET_KEY / NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY / STRIPE_WEBHOOK_SECRET を同じモード（ライブ or テスト）に揃えてください。' +
            '（例：本番なら sk_live_ / pk_live_ / liveのwebhook secret を設定）',
          stripeKeyMode: mode,
        },
        { status: 400 }
      )
    }

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
    'banner-basic': STRIPE_PRICE_IDS.banner.basic,
    'banner-pro': STRIPE_PRICE_IDS.banner.pro,
    'banner-enterprise': STRIPE_PRICE_IDS.banner.enterprise,
    // セットプラン
    'bundle': STRIPE_PRICE_IDS.bundle,
  }

  const prices = priceMap[planId]
  if (!prices) return null

  return prices[billingPeriod]
}
