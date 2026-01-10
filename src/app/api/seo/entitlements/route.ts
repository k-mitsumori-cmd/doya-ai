import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import {
  SEO_GUEST_COOKIE,
  canUseSeoImages,
  getGuestIdFromRequest,
  isTrialActive,
  jstDayRange,
  maxSeoPlan,
  normalizeSeoPlan,
  seoDailyArticleLimit,
  seoGuestTotalArticleLimit,
} from '@/lib/seoAccess'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const isLoggedIn = !!user?.id

    // ⚠️ セッションの plan は古い/欠損することがあるため、権限判定は必ずDBの最新値を参照する
    // - これにより「EnterpriseなのにFREE表示」などの不整合を防ぐ
    let dbUser: any = null
    if (isLoggedIn) {
      dbUser = await (prisma as any).user.findUnique({
        where: { id: String(user.id) },
        select: {
          id: true,
          plan: true,
          firstLoginAt: true,
          serviceSubscriptions: {
            select: { serviceId: true, plan: true },
          },
        },
      })
    }

    // サービス別プラン（writing/seo）優先 → なければ全体プラン(plan)
    const byService: Record<string, string> = dbUser?.serviceSubscriptions
      ? Object.fromEntries((dbUser.serviceSubscriptions as any[]).map((s) => [String(s.serviceId || ''), String(s.plan || '')]))
      : {}
    const servicePlanRaw = byService['writing'] || byService['seo'] || null
    const globalPlanRaw = dbUser?.plan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST')

    // 追加: Stripe Subscription テーブルから active なものがあればプランを補強（webhook 遅延や DB 不整合対策）
    // ※ Subscription テーブルが無い環境や、クエリエラー時は無視して続行
    let subscriptionPlanRaw: string | null = null
    if (isLoggedIn && dbUser?.id) {
      try {
        // テーブル存在チェック（Prisma が findFirst を持っていない場合は skip）
        const subModel = (prisma as any).subscription
        if (subModel && typeof subModel.findFirst === 'function') {
          const activeSub = await subModel.findFirst({
            where: {
              userId: String(dbUser.id),
              status: 'active',
            },
            orderBy: { currentPeriodEnd: 'desc' },
            select: { planId: true, priceId: true },
          })
          if (activeSub) {
            // planId/priceId から判定（seo-pro, seo-enterprise, pro, enterprise 等）
            const pid = String(activeSub.planId || activeSub.priceId || '').toLowerCase()
            if (pid.includes('enterprise') || pid.includes('business') || pid.includes('bundle')) {
              subscriptionPlanRaw = 'ENTERPRISE'
            } else if (pid.includes('pro')) {
              subscriptionPlanRaw = 'PRO'
            }
          }
        }
      } catch (subErr: any) {
        // Subscriptionテーブルが無い/クエリ失敗しても全体は続行（ログだけ出す）
        console.warn('[seo entitlements] subscription query skipped:', subErr?.message || subErr)
      }
    }

    // サービス別/グローバル/Stripeサブスク、すべてで「強い方」を採用（EnterpriseなのにFREE判定を防止）
    const plan = maxSeoPlan(servicePlanRaw, globalPlanRaw, subscriptionPlanRaw)

    const firstLoginAtIso =
      dbUser?.firstLoginAt?.toISOString?.() || (dbUser?.firstLoginAt ? String(dbUser.firstLoginAt) : null) || user?.firstLoginAt || null
    const trial = isTrialActive(firstLoginAtIso)
    const trialActive = isLoggedIn && trial.active

    const { start, end } = jstDayRange(new Date())

    // 生成回数（記事）: GUEST=累計3、ログイン=日次上限（トライアル中は無制限）
    let usedArticlesToday = 0
    let usedArticlesTotal = 0
    let articleLimit = 0
    let remainingArticles = 0

    const guestId = !isLoggedIn ? getGuestIdFromRequest(_req) : null

    if (trialActive) {
      articleLimit = -1
      remainingArticles = -1
    } else if (isLoggedIn) {
      articleLimit = seoDailyArticleLimit(plan)
      usedArticlesToday = await (prisma as any).seoArticle.count({
        where: { userId: String(dbUser?.id || user.id), createdAt: { gte: start, lt: end } },
      })
      remainingArticles = Math.max(0, articleLimit - usedArticlesToday)
    } else {
      articleLimit = seoGuestTotalArticleLimit()
      if (guestId) {
        usedArticlesTotal = await (prisma as any).seoArticle.count({
          where: { guestId, createdAt: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
        })
      } else {
        usedArticlesTotal = 0
      }
      remainingArticles = Math.max(0, articleLimit - usedArticlesTotal)
    }

    const imagesAllowed = canUseSeoImages({ isLoggedIn, plan, trialActive })

    return NextResponse.json({
      success: true,
      isLoggedIn,
      plan,
      // デバッグ用（画面には出さない想定）：不整合が起きた時に原因追跡できるようにする
      _debug: isLoggedIn
        ? {
            servicePlanRaw: servicePlanRaw || null,
            globalPlanRaw: String(globalPlanRaw || ''),
          pickedPlan: plan,
          servicePlan: normalizeSeoPlan(servicePlanRaw),
          globalPlan: normalizeSeoPlan(globalPlanRaw),
          }
        : undefined,
      guestCookieKey: SEO_GUEST_COOKIE,
      trial: {
        active: trialActive,
        remainingSeconds: Math.floor(trial.remainingMs / 1000),
      },
      limits: {
        // -1 = unlimited
        articlesPerDay: isLoggedIn ? articleLimit : 0,
        articlesTotalGuest: !isLoggedIn ? articleLimit : 0,
        imagesAllowed,
      },
      usage: {
        articlesToday: usedArticlesToday,
        articlesTotalGuest: usedArticlesTotal,
      },
      remaining: {
        articles: remainingArticles,
      },
      // チャット修正は当面「画像と同じ条件」に揃える（=PRO/ENT or trial）
      canUseChatEdit: imagesAllowed,
      canUseSeoImages: imagesAllowed,
    })
  } catch (e: any) {
    // 失敗時でも可能な限りセッション情報から判定を試みる（完全な UNKNOWN を避ける）
    const msg = e?.message || 'entitlements failed'
    console.error('[seo entitlements] failed', msg, e)

    // セッションから最低限の情報を取得
    let fallbackPlan = 'UNKNOWN'
    let fallbackLoggedIn = false
    try {
      const session = await getServerSession(authOptions)
      const u: any = session?.user || null
      fallbackLoggedIn = !!u?.id
      if (u?.plan) {
        const p = String(u.plan).toUpperCase()
        if (p === 'ENTERPRISE' || p === 'BUSINESS' || p === 'BUNDLE') fallbackPlan = 'ENTERPRISE'
        else if (p === 'PRO') fallbackPlan = 'PRO'
        else if (p === 'FREE' || p === 'STARTER') fallbackPlan = 'FREE'
        else if (fallbackLoggedIn) fallbackPlan = 'FREE'
      } else if (fallbackLoggedIn) {
        fallbackPlan = 'FREE'
      } else {
        fallbackPlan = 'GUEST'
      }
    } catch {
      // ignore
    }

    const canUse = fallbackPlan === 'PRO' || fallbackPlan === 'ENTERPRISE'
    return NextResponse.json(
      {
        success: false,
        error: msg,
        isLoggedIn: fallbackLoggedIn,
        plan: fallbackPlan,
        canUseChatEdit: canUse,
        canUseSeoImages: canUse,
      },
      { status: 500 }
    )
  }
}


