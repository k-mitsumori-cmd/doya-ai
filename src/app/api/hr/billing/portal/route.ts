export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe, resolveBillingCustomerId } from '@/lib/stripe'
import { getHrContext } from '@/lib/hr/access'
import { HrMemberRole } from '@/lib/hr/types'
import { logAudit } from '@/lib/hr/audit'

// POST /api/hr/billing/portal
// Stripeカスタマーポータルセッションを作成（本人の契約・請求履歴を検証）
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

    // 組織の契約は OWNER のユーザーに紐づく。別メンバーの顧客ポータルを開かない。
    if (ctx.role !== HrMemberRole.OWNER || ctx.userId !== user.id) {
      return NextResponse.json({ error: 'この組織のプランはオーナーのみ変更できます。', code: 'HR_BILLING_OWNER_REQUIRED' }, { status: 403 })
    }

    // 保存済み顧客IDだけでは本人性を証明できない。共通ポータルと同じ検証を通す。
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, stripeCustomerId: true },
    })

    if (!dbUser?.email) {
      return NextResponse.json({ error: 'ユーザー情報を確認できませんでした。' }, { status: 404 })
    }
    const customerId = await resolveBillingCustomerId({
      userId: dbUser.id,
      email: dbUser.email,
      stripeCustomerId: dbUser.stripeCustomerId,
    })
    if (!customerId) {
      return NextResponse.json({ error: '本人の契約情報を確認できませんでした。時間をおいて再試行してください。' }, { status: 409 })
    }

    const baseUrl = (process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://doya-ai.surisuta.jp').replace(/\/+$/, '')

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
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
    console.error('[hr/billing/portal] unexpected error')
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
