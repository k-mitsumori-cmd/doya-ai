import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createCustomerPortalSession } from '@/lib/stripe'
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
      select: { stripeCustomerId: true },
    })

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'サブスクリプションが見つかりません' },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const body = await request.json().catch(() => ({}))
    const returnTo = safeReturnPath(body?.returnTo)

    // カスタマーポータルセッション作成
    const portalSession = await createCustomerPortalSession({
      customerId: user.stripeCustomerId,
      returnUrl: `${baseUrl}${returnTo}`,
    })

    return NextResponse.json({
      url: portalSession.url,
    })

  } catch (error: any) {
    console.error('Portal session error:', error)
    return NextResponse.json(
      { error: error.message || 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}
