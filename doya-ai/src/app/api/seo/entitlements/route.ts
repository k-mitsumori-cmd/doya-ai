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

    // サービス別プラン（seoPlan）優先 → なければ全体プラン(plan)
    const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || (isLoggedIn ? 'FREE' : 'GUEST'))
    const trial = isTrialActive(user?.firstLoginAt || null)
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
        where: { userId: String(user.id), createdAt: { gte: start, lt: end } },
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
    console.error('[seo entitlements] failed', { error: e?.message || 'unknown error', stack: e?.stack })
    // エラー時は安全なデフォルト値を返す
    return NextResponse.json({
      success: true,
      isLoggedIn: false,
      plan: 'FREE',
      canUseChatEdit: false,
      canUseSeoImages: false,
      limits: {
        articlesPerDay: 0,
        articlesTotalGuest: 3,
        imagesAllowed: false,
      },
      usage: {
        articlesToday: 0,
        articlesTotalGuest: 0,
      },
      remaining: {
        articles: 3,
      },
    })
  }
}


