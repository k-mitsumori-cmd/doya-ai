export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'

// ドヤHR用のStripe価格ID
const HR_STRIPE_PRICES: Record<string, string> = {
  'hr-starter-monthly': process.env.STRIPE_PRICE_HR_STARTER_MONTHLY || 'price_hr_starter_monthly',
  'hr-starter-yearly': process.env.STRIPE_PRICE_HR_STARTER_YEARLY || 'price_hr_starter_yearly',
  'hr-pro-monthly': process.env.STRIPE_PRICE_HR_PRO_MONTHLY || 'price_hr_pro_monthly',
  'hr-pro-yearly': process.env.STRIPE_PRICE_HR_PRO_YEARLY || 'price_hr_pro_yearly',
}

// POST /api/hr/billing/checkout
// Stripe Checkoutセッションを作成
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user = session?.user as any
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ctx = await getHrContext()
    if (!ctx) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ADMIN以上のみ課金操作可能
    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { planId } = body

    if (!planId || !HR_STRIPE_PRICES[planId]) {
      return NextResponse.json(
        { error: `無効なプランIDです: ${planId}` },
        { status: 400 }
      )
    }

    const priceId = HR_STRIPE_PRICES[planId]

    // 組織情報取得
    const org = await prisma.hrOrganization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, stripeCustomerId: true },
    })
    if (!org) {
      return NextResponse.json({ error: '組織が見つかりません' }, { status: 404 })
    }

    // Stripe Customer取得or作成
    let customerId = org.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          hrOrganizationId: org.id,
          userId: user.id,
        },
      })
      customerId = customer.id

      await prisma.hrOrganization.update({
        where: { id: org.id },
        data: { stripeCustomerId: customerId },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/hr/settings?tab=billing&checkout=success`,
      cancel_url: `${baseUrl}/hr/settings?tab=billing&checkout=cancelled`,
      locale: 'ja',
      subscription_data: {
        metadata: {
          hrOrganizationId: org.id,
          planId,
          userId: user.id,
        },
      },
      metadata: {
        hrOrganizationId: org.id,
        planId,
        userId: user.id,
      },
    })

    // 監査ログ
    logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: user.name,
      action: 'BILLING_CHECKOUT',
      target: 'billing',
      details: { planId, checkoutSessionId: checkoutSession.id },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
