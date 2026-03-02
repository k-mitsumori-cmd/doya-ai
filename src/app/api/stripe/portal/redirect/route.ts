import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerPortalSession } from '@/lib/stripe'
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL(`/auth/doyamarke/signin?callbackUrl=${encodeURIComponent('/banner/dashboard/plan')}`, request.url))
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      // ポータルを開けないケースも「画面遷移」させて気づけるようにする
      const u = new URL('/banner/dashboard/plan', request.url)
      u.searchParams.set('portal', 'missing')
      return NextResponse.redirect(u)
    }

    const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin)
      .trim()
      .replace(/\/+$/, '')
    const returnTo = safeReturnPath(request.nextUrl.searchParams.get('returnTo'))

    const portalSession = await createCustomerPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${baseUrl}${returnTo}`,
    })

    return NextResponse.redirect(portalSession.url)
  } catch (e: any) {
    const u = new URL('/banner/dashboard/plan', request.url)
    u.searchParams.set('portal', 'error')
    return NextResponse.redirect(u)
  }
}


