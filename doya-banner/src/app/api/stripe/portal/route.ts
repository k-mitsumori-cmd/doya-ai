import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    
    // サブスクリプション情報を取得
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    })
    
    if (!subscription?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'サブスクリプション情報が見つかりません' },
        { status: 404 }
      )
    }
    
    // Stripe Customer Portal セッションを作成
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/app/billing`,
    })
    
    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    console.error('Portal error:', error)
    return NextResponse.json(
      { error: 'ポータルセッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}

