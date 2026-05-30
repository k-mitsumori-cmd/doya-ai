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

// POST /api/hr/billing/portal
// Stripeカスタマーポータルセッションを作成（User.stripeCustomerIdを使用）
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

    // ADMIN以上のみ
    if (!hasMinRole(ctx.role, HrMemberRole.ADMIN)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // User.stripeCustomerIdを使用（組織ではなくユーザーレベル）
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    })

    if (!dbUser?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Stripe顧客情報がまだ登録されていません。先にプランをご購入ください。' },
        { status: 400 }
      )
    }

    // 顧客IDが現モードに存在するか検証（テスト/本番不整合での500を防ぐ）
    try {
      const c = await stripe.customers.retrieve(dbUser.stripeCustomerId)
      if ((c as any)?.deleted) throw Object.assign(new Error('deleted'), { code: 'resource_missing' })
    } catch (err: any) {
      if (err?.code === 'resource_missing' || err?.statusCode === 404) {
        await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: null } }).catch(() => {})
        return NextResponse.json(
          { error: '有効なサブスクリプションが見つかりません。アップグレードからお手続きください。' },
          { status: 400 }
        )
      }
      throw err
    }

    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: dbUser.stripeCustomerId,
      return_url: `${baseUrl}/hr/settings/billing`,
      locale: 'ja',
    })

    // 監査ログ
    logAudit({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      userName: user.name,
      action: 'BILLING_PORTAL',
      target: 'billing',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
