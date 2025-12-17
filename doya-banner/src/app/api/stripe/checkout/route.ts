import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }
    
    const userId = (session.user as any).id
    const email = session.user.email
    
    // 既存のサブスクリプションをチェック
    const existingSub = await prisma.subscription.findUnique({
      where: { userId },
    })
    
    if (existingSub?.status === 'active') {
      return NextResponse.json(
        { error: '既にプロプランに加入しています' },
        { status: 400 }
      )
    }
    
    // Stripe Customer を取得または作成
    let customerId = existingSub?.stripeCustomerId
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          userId,
        },
      })
      customerId = customer.id
      
      // Subscription レコードを作成（または更新）
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          status: 'incomplete',
        },
        update: {
          stripeCustomerId: customerId,
        },
      })
    }
    
    // Checkout Session を作成
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/app/billing?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/app/billing?canceled=true`,
      metadata: {
        userId,
      },
      subscription_data: {
        metadata: {
          userId,
        },
      },
      locale: 'ja',
      allow_promotion_codes: true,
    })
    
    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'チェックアウトセッションの作成に失敗しました' },
      { status: 500 }
    )
  }
}

