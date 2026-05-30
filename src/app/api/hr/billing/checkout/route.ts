export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { getHrContext, hasMinRole } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'

// HR用Stripe価格IDマッピング（統一課金のSTRIPE_PRICE_IDSから取得）
const HR_PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: STRIPE_PRICE_IDS.hr.starter,
  pro: STRIPE_PRICE_IDS.hr.pro,
  enterprise: STRIPE_PRICE_IDS.hr.enterprise,
}

// POST /api/hr/billing/checkout
// Stripe Checkoutセッションを作成（統一課金パターン）
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
    const { plan, interval = 'monthly' } = body // plan: 'starter' | 'pro' | 'enterprise', interval: 'monthly' | 'yearly'

    if (!plan || !HR_PLAN_PRICES[plan]) {
      return NextResponse.json(
        { error: `無効なプランです: ${plan}` },
        { status: 400 }
      )
    }

    const priceId = HR_PLAN_PRICES[plan][interval === 'yearly' ? 'yearly' : 'monthly']
    if (!priceId) {
      return NextResponse.json(
        { error: `無効な課金間隔です: ${interval}` },
        { status: 400 }
      )
    }

    // User.stripeCustomerIdを使用（組織ではなくユーザーレベル）
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    })
    if (!dbUser) {
      return NextResponse.json({ error: 'ユーザーが見つかりません' }, { status: 404 })
    }

    let stripeCustomerId = dbUser.stripeCustomerId

    // 保存済み顧客IDが現在のStripeモード(本番/テスト)に存在するか検証。
    // 別モードで作られたID等は resource_missing になるためクリアして作り直す（自己修復）
    if (stripeCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(stripeCustomerId)
        if ((existing as any)?.deleted) stripeCustomerId = null
      } catch (err: any) {
        if (err?.code === 'resource_missing' || err?.statusCode === 404) {
          stripeCustomerId = null
        } else {
          throw err
        }
      }
    }

    // StripeCustomerがない場合は作成してUser.stripeCustomerIdに保存
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email || user.email,
        name: dbUser.name || user.name,
        metadata: {
          userId: user.id,
        },
      })
      stripeCustomerId = customer.id

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      })
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/hr/settings/billing?success=true`,
      cancel_url: `${baseUrl}/hr/settings/billing`,
      locale: 'ja',
      subscription_data: {
        metadata: {
          userId: user.id,
          serviceId: 'hr',
          planId: `hr-${plan}`,
        },
      },
      metadata: {
        userId: user.id,
        serviceId: 'hr',
        planId: `hr-${plan}`,
      },
      client_reference_id: user.id,
    })

    // 監査ログ
    logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: user.name,
      action: 'BILLING_CHECKOUT',
      target: 'billing',
      details: { plan, interval, priceId, checkoutSessionId: checkoutSession.id },
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
