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
  jstMonthRange,
  normalizeSeoPlan,
  seoMonthlyArticleLimit,
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

    const { start, end } = jstMonthRange(new Date())

    // 生成回数（記事）: GUEST=累計1、ログイン=月次上限（トライアル中は無制限）
    let usedArticlesThisMonth = 0
    let usedArticlesTotal = 0
    let articleLimit = 0
    let remainingArticles = 0

    const guestId = !isLoggedIn ? getGuestIdFromRequest(_req) : null

    if (trialActive) {
      articleLimit = -1
      remainingArticles = -1
    } else if (isLoggedIn) {
      articleLimit = seoMonthlyArticleLimit(plan)
      usedArticlesThisMonth = await (prisma as any).seoArticle.count({
        where: { userId: String(user.id), createdAt: { gte: start, lt: end } },
      })
      remainingArticles = Math.max(0, articleLimit - usedArticlesThisMonth)
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
        articlesPerMonth: isLoggedIn ? articleLimit : 0,
        articlesTotalGuest: !isLoggedIn ? articleLimit : 0,
        imagesAllowed,
      },
      usage: {
        articlesThisMonth: usedArticlesThisMonth,
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
        articlesPerMonth: 0,
        articlesTotalGuest: 0,
        imagesAllowed: false,
      },
      usage: {
        articlesThisMonth: 0,
        articlesTotalGuest: 0,
      },
      remaining: {
        articles: 0,
      },
    })
  }
}
