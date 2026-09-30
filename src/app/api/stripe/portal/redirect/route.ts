import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerPortalSession, resolveBillingCustomerId } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

// ========================================
// カスタマーポータル（リダイレクト）API
// ========================================
// GET /api/stripe/portal/redirect?returnTo=/banner/dashboard/plan
// クリックで確実に遷移させるため、POSTではなくGET→Stripeへリダイレクトする

function safeReturnPath(raw: string | null | undefined): string {
  const v = String(raw || '').trim()
  if (!v) return '/banner'
  // 同一オリジン内のパスのみ許可
  if (!v.startsWith('/')) return '/banner'
  if (v.startsWith('//')) return '/banner'
  return v
}

function portalFailureUrl(request: NextRequest, reason: 'missing' | 'error'): URL {
  const url = new URL('/billing/portal-unavailable', request.url)
  url.searchParams.set('reason', reason)
  url.searchParams.set('returnTo', safeReturnPath(request.nextUrl.searchParams.get('returnTo')))
  return url
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${encodeURIComponent('/banner/dashboard/plan')}`, request.url))
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, stripeCustomerId: true },
    })

    // ⚠️ 顧客分裂・customerId 未保存でもポータルへ到達させる（reference/11-billing-spec.md）
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
  } catch (e: any) {
    return NextResponse.redirect(portalFailureUrl(request, 'error'))
  }
}

