import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCheckoutSession, STRIPE_PRICE_IDS, findActiveLikeSubscriptions } from '@/lib/stripe'
import { UNIFIED_TRIAL_DAYS } from '@/lib/unified-plan'
import { isTrialEligible } from '@/lib/trial'
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

    // ------------------------------------------------------------------
    // 提供終了サービスのプランは受け付けない
    // ------------------------------------------------------------------
    // ⚠️ 統一課金のため、これらの planId は price env が未設定でも
    //    バナー（＝統一プロプラン）の**実在する価格IDにフォールバックする**。
    //    つまり `{ planId: 'movie-pro' }` を直接POSTすると決済が成立し、
    //    畳んだサービスの UserServiceSubscription が作られてしまう。
    //    価格は統一プランと同じなので過剰請求にはならないが、
    //    存在しないサービスの契約records が残るので入口で弾く。
    // ⚠️ 統一プランは 'banner-pro'（現役）なのでここには含めないこと。
    const retiredPlanPrefixes = ['copy', 'lp', 'voice', 'movie', 'adsim', 'tenkai', 'interviewx']
    if (retiredPlanPrefixes.includes(String(planId).split('-')[0])) {
      return NextResponse.json(
        { error: 'このプランは提供を終了しました。' },
        { status: 410 }
      )
    }

    // プランIDからStripe価格IDを取得
    const priceId = getPriceId(planId, billingPeriod)
    if (!priceId) {
      return NextResponse.json(
        { error: '無効なプランIDです' },
        { status: 400 }
      )
    }

    // ------------------------------------------------------------------
    // 二重契約ガード
    // ------------------------------------------------------------------
    // 反映が見えないと利用者は「申し込めていない」と思ってもう一度申し込む。
    // その2回目は「既存契約あり」と判定されてトライアルが付かず**即時に満額課金**される。
    // （2026-08 に実際に発生: 2分差で trialing と active の2契約・¥9,980 の誤課金）
    // 生きている契約がある場合は決済させず、409 で呼び出し側に再同期させる。
    try {
      const existing = await findActiveLikeSubscriptions({
        email: session.user.email,
        stripeCustomerId: dbUser.stripeCustomerId,
      })
      if (existing.length > 0) {
        const s = existing[0]!
        return NextResponse.json(
          {
            code: 'ALREADY_SUBSCRIBED',
            error:
              'すでにご契約が有効です。二重のご請求を防ぐため決済を中断しました。プランの反映が見えない場合は画面を再読み込みしてください。',
            status: s.status,
            subscriptionId: s.id,
          },
          { status: 409 }
        )
      }
    } catch (e: any) {
      // 照会失敗で決済を止めない（機会損失を作らない）。二重契約の検知は日次監査で拾う。
      console.error('[Checkout] duplicate-subscription check failed:', e?.message)
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

    // 初月無料（30日トライアル）の付与条件:
    //  (a) 月額プランのみ（年額や enterprise/bundle には付けない＝「初月無料」訴求の範囲に一致）
    //  (b) 新規顧客のみ（メール横断で実サブスク履歴を照会。trial cycling防止）
    const trialablePlan =
      billingPeriod === 'monthly' && !planId.includes('enterprise') && planId !== 'bundle'
    const trialDays =
      trialablePlan && (await isTrialEligible({ email: session.user.email, stripeCustomerId: dbUser.stripeCustomerId }))
        ? UNIFIED_TRIAL_DAYS
        : undefined

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
