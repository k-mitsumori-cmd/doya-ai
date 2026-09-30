import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerPortalSession, resolveBillingCustomerId } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// ========================================
// カスタマーポータルAPI
// ========================================
// POST /api/stripe/portal
// サブスクリプション管理画面へのリンクを生成
// body: { returnTo?: string }

function safeReturnPath(raw: string | null | undefined): string {
  const v = String(raw || '').trim()
  if (!v) return '/banner/dashboard/plan'
  // 同一オリジン内のパスのみ許可
  if (!v.startsWith('/')) return '/banner/dashboard/plan'
  if (v.startsWith('//')) return '/banner/dashboard/plan'
  return v
}

function portalFailureUrl(request: NextRequest, reason: 'missing' | 'error'): URL {
  const url = new URL('/billing/portal-unavailable', request.url)
  url.searchParams.set('reason', reason)
  url.searchParams.set('returnTo', safeReturnPath(request.nextUrl.searchParams.get('returnTo')))
  return url
}

function portalSignInUrl(request: NextRequest): URL {
  const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'))
  const callbackUrl = `/api/stripe/portal?returnTo=${encodeURIComponent(returnTo)}`
  const url = new URL('/auth/signin', request.url)
  url.searchParams.set('callbackUrl', callbackUrl)
  return url
}

// GET /api/stripe/portal?returnTo=/banner/dashboard/plan
// 互換用（リンク遷移で確実に開きたいケース向け）
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.redirect(portalSignInUrl(request))
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    })

    // ⚠️ DBの顧客IDだけを見ない。顧客が分裂していると「契約はあるのにポータルが空」になり、
    //    null のままだとポータル自体が開けない（reference/11-billing-spec.md）。
    const customerId = await resolveBillingCustomerId({
      email: session.user.email,
      stripeCustomerId: user?.stripeCustomerId,
    })

    if (!customerId) {
      return NextResponse.redirect(portalFailureUrl(request, 'missing'))
    }
    if (user?.id && customerId !== user.stripeCustomerId) {
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } }).catch(() => {})
    }

    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin)
      .trim()
      .replace(/\/+$/, '')
    const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'))

    const portalSession = await createCustomerPortalSession({
      customerId,
      returnUrl: `${baseUrl}${returnTo}`,
    })

    return NextResponse.redirect(portalSession.url)
  } catch {
    return NextResponse.redirect(portalFailureUrl(request, 'error'))
  }
}

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

    // ユーザーのStripe Customer IDを取得
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    })

    const customerId = await resolveBillingCustomerId({
      email: session.user.email,
      stripeCustomerId: user?.stripeCustomerId,
    })

    if (!customerId) {
      return NextResponse.json(
        { error: 'サブスクリプションが見つかりません' },
        { status: 404 }
      )
    }
    if (user?.id && customerId !== user.stripeCustomerId) {
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } }).catch(() => {})
    }

    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin)
      .trim()
      .replace(/\/+$/, '')
    const body = await request.json().catch(() => ({}))
    const returnTo = safeReturnPath(body?.returnTo)

    // カスタマーポータルセッション作成
    const portalSession = await createCustomerPortalSession({
      customerId,
      returnUrl: `${baseUrl}${returnTo}`,
    })

    return NextResponse.json({
      url: portalSession.url,
    })

  } catch (error: any) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
