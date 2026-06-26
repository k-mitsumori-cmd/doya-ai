import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCheckoutSession, STRIPE_PRICE_IDS, stripe } from '@/lib/stripe'
import { UNIFIED_TRIAL_DAYS } from '@/lib/unified-plan'
import { prisma } from '@/lib/prisma'

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

    // セッションの user.id が欠ける/揺れる環境でも確実に userId を取得する
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    })
    if (!dbUser?.id) {
      return NextResponse.json({ error: 'ユーザー情報の取得に失敗しました' }, { status: 404 })
    }

    // プランIDからStripe価格IDを取得
    const priceId = getPriceId(planId, billingPeriod)
    if (!priceId) {
      return NextResponse.json(
        { error: '無効なプランIDです' },
        { status: 400 }
      )
    }

    // ベースURL（環境変数が未設定でも現ドメインで成立させる）
    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin)
      .trim()
      .replace(/\/+$/, '')
    
    // サービスに応じたリダイレクトURL
    const service = planId.split('-')[0] // 'seo-pro' -> 'seo'
    const successPath =
      service === 'seo'
        ? '/seo'
        : service === 'banner'
          ? '/banner'
          : service === 'interview'
            ? '/interview/projects'
            : '/'
    const cancelPath =
      service === 'seo'
        ? '/seo/pricing?payment=cancelled'
        : service === 'banner'
          ? '/banner?payment=cancelled'
          : service === 'interview'
            ? '/interview/projects?payment=cancelled'
            : '/pricing?payment=cancelled'

    // 成功URLにプラン情報/Checkout Session IDを追加（決済直後にアプリ側で同期して即反映させる）
    // NOTE: {CHECKOUT_SESSION_ID} はStripeが自動で実IDに置換する
    const planLabel = planId.includes('enterprise') ? 'enterprise' : planId.includes('light') ? 'light' : 'pro'
    const successUrl = `${baseUrl}${successPath}?success=true&plan=${planLabel}&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}${cancelPath}`

    // 初月無料（30日トライアル）は全サブスクプランで訴求するが、実際の付与は
    // 「過去にサブスク履歴の無い新規顧客のみ」に限定する（解約→再契約での無料月の繰り返し取得=trial cyclingを防止）。
    // Stripe の顧客サブスク履歴(canceled含む全件)を真実として参照する。DBの解約フラグは
    // 解約時にnull化されるため当てにせず、Stripeを直接照会する。
    let trialDays: number | undefined = UNIFIED_TRIAL_DAYS
    if (dbUser.stripeCustomerId) {
      try {
        const prior = await stripe.subscriptions.list({
          customer: dbUser.stripeCustomerId,
          status: 'all',
          limit: 1,
        })
        // 既存顧客（過去に1件でもサブスク履歴あり）にはトライアルを付けない
        if (prior.data.length > 0) trialDays = undefined
      } catch (e: any) {
        // 履歴照会に失敗したら安全側（トライアル無し）に倒す。新規顧客はcustomerId自体が無く
        // この分岐に入らないため、ここで弾かれるのは既存顧客のみ＝過剰付与を防げる。
        console.error('[stripe/checkout] trial eligibility check failed:', e?.message)
        trialDays = undefined
      }
    }

    // Checkout Session作成
    const checkoutSession = await createCheckoutSession({
      priceId,
      userId: dbUser.id,
      userEmail: session.user.email,
      successUrl,
      cancelUrl,
      trialDays,
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
    // --- ライトプラン（全サービス共通 ¥2,980/月） ---
    'seo-light': STRIPE_PRICE_IDS.seo.light,
    'banner-light': STRIPE_PRICE_IDS.banner.light,
    'interview-light': STRIPE_PRICE_IDS.interview.light,
    'copy-light': STRIPE_PRICE_IDS.copy.light,
    'lp-light': STRIPE_PRICE_IDS.lp.light,
    'voice-light': STRIPE_PRICE_IDS.voice.light,
    'movie-light': STRIPE_PRICE_IDS.movie.light,
    'adsim-light': STRIPE_PRICE_IDS.adsim.light,
    // --- プロプラン ---
    // ドヤSEO
    'seo-pro': STRIPE_PRICE_IDS.seo.pro,
    'seo-enterprise': STRIPE_PRICE_IDS.seo.enterprise,
    // ドヤバナーAI
    'banner-basic': STRIPE_PRICE_IDS.banner.basic,
    'banner-pro': STRIPE_PRICE_IDS.banner.pro,
    'banner-enterprise': STRIPE_PRICE_IDS.banner.enterprise,
    // ドヤインタビューAI（統一課金）
    'interview-pro': STRIPE_PRICE_IDS.interview.pro,
    'interview-enterprise': STRIPE_PRICE_IDS.interview.enterprise,
    // ドヤコピーAI（統一課金）
    'copy-pro': STRIPE_PRICE_IDS.copy.pro,
    'copy-enterprise': STRIPE_PRICE_IDS.copy.enterprise,
    // ドヤLP AI（統一課金）
    'lp-pro': STRIPE_PRICE_IDS.lp.pro,
    'lp-enterprise': STRIPE_PRICE_IDS.lp.enterprise,
    // ドヤボイスAI（統一課金）
    'voice-pro': STRIPE_PRICE_IDS.voice.pro,
    'voice-enterprise': STRIPE_PRICE_IDS.voice.enterprise,
    // ドヤムービーAI（統一課金）
    'movie-pro': STRIPE_PRICE_IDS.movie.pro,
    'movie-enterprise': STRIPE_PRICE_IDS.movie.enterprise,
    // ドヤ広告シミュレーションAI（統一課金）
    'adsim-pro': STRIPE_PRICE_IDS.adsim.pro,
    'adsim-enterprise': STRIPE_PRICE_IDS.adsim.enterprise,
    // セットプラン
    'bundle': STRIPE_PRICE_IDS.bundle,
  }

  const prices = priceMap[planId]
  if (!prices) return null

  return prices[billingPeriod]
}
