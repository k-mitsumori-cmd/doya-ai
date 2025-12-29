import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import {
  ensureGuestId,
  getGuestIdFromRequest,
  isTrialActive,
  jstDayRange,
  normalizeSeoPlan,
  seoDailyArticleLimit,
  seoGuestTotalArticleLimit,
  setGuestCookie,
} from '@/lib/seoAccess'
import { getSeoCharLimitByUserPlan } from '@/lib/pricing'

export async function GET(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const seoArticle = (prisma as any).seoArticle as any
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const guestId = !userId ? getGuestIdFromRequest(req) : null
    // 生成記事は3ヶ月（約90日）まで保持
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

    // 古い記事は削除（RUNNINGは除外して安全側）
    try {
      await seoArticle.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          status: { not: 'RUNNING' },
        },
      })
    } catch {
      // 失敗しても一覧表示自体は止めない
    }

    const where: any = { createdAt: { gte: cutoff } }
    if (userId) where.userId = userId
    else if (guestId) where.guestId = guestId
    else where.id = '__none__'

    const articles = await seoArticle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
        // 一覧サムネ用（最新バナー1枚だけ）
        images: {
          where: { kind: 'BANNER' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    const res = NextResponse.json({ success: true, articles })
    if (!userId && !guestId) {
      const newGuest = ensureGuestId()
      setGuestCookie(res, newGuest)
    }
    return res
  } catch (e: any) {
    // DB未反映/接続不可でも画面側が404にならないよう、明示的にJSONエラーを返す
    return NextResponse.json(
      { success: false, error: e?.message || 'DBエラー（スキーマ未反映の可能性）', articles: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeoSchema()
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || (userId ? 'FREE' : 'GUEST'))
    const trial = isTrialActive(user?.firstLoginAt || null)
    const trialActive = !!userId && trial.active

    let guestId = !userId ? getGuestIdFromRequest(req) : null
    if (!userId && !guestId) guestId = ensureGuestId()

    // 使用制限（トライアル中は無制限）
    if (!trialActive) {
      if (userId) {
        const limit = seoDailyArticleLimit(plan)
        if (limit >= 0) {
          const { start, end } = jstDayRange(new Date())
          const used = await (prisma as any).seoArticle.count({
            where: { userId, createdAt: { gte: start, lt: end } },
          })
          if (used >= limit) {
            return NextResponse.json(
              { success: false, error: `本日の生成回数の上限に達しました（${limit}回/日）。プランをアップグレードすると増やせます。` },
              { status: 429 }
            )
          }
        }
      } else {
        const limit = seoGuestTotalArticleLimit()
        const used = guestId ? await (prisma as any).seoArticle.count({ where: { guestId } }) : 0
        if (used >= limit) {
          const res = NextResponse.json(
            { success: false, error: `ゲストは${limit}回まで作成できます。ログインすると継続して使えます。` },
            { status: 429 }
          )
          if (guestId) setGuestCookie(res, guestId)
          return res
        }
      }
    }

    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)
    const createJob = body?.createJob !== false

    // 文字数制限チェック（トライアル中はPRO相当）
    const isGuest = !userId
    const effectivePlan = trialActive ? 'PRO' : plan
    const charLimit = getSeoCharLimitByUserPlan(effectivePlan, isGuest && !trialActive)
    const requestedChars = Number(input.targetChars || 10000)
    
    if (requestedChars > charLimit) {
      const planLabel = isGuest ? 'ゲスト' : (plan === 'PRO' ? 'プロ' : plan === 'ENTERPRISE' ? 'エンタープライズ' : 'フリー')
      return NextResponse.json(
        { 
          success: false, 
          error: `${planLabel}プランでは${charLimit.toLocaleString()}字までの記事を作成できます。${requestedChars.toLocaleString()}字を作成するにはプランのアップグレードが必要です。`,
          charLimit,
          requestedChars,
        },
        { status: 403 }
      )
    }

    const seoArticle = (prisma as any).seoArticle as any
    const seoJob = (prisma as any).seoJob as any

    const article = await seoArticle.create({
      data: {
        status: createJob ? 'RUNNING' : 'DRAFT',
        userId: userId || null,
        guestId: userId ? null : guestId,
        title: input.title,
        keywords: input.keywords as any,
        persona: input.persona || null,
        searchIntent: input.searchIntent || null,
        targetChars: input.targetChars,
        tone: input.tone,
        forbidden: input.forbidden as any,
        referenceUrls: input.referenceUrls as any,
        llmoOptions: (input.llmoOptions ?? undefined) as any,
        // 新機能：依頼テキストと参考画像
        requestText: input.requestText || null,
        referenceImages: input.referenceImages || null,
        autoBundle: (body.autoBundle ?? true) as boolean, // 追加
        // 比較記事（調査型）
        mode: (input.mode ?? 'standard') as any,
        comparisonConfig: (input.comparisonConfig ?? null) as any,
        comparisonCandidates: (input.comparisonCandidates ?? null) as any,
        referenceInputs: (input.referenceInputs ?? null) as any,
      },
    })

    if (!createJob) {
      const res = NextResponse.json({ success: true, articleId: article.id, jobId: null })
      if (!userId && guestId) setGuestCookie(res, guestId)
      return res
    }

    // 分割生成ジョブを作って記事ページ側でadvanceする
    const job = await seoJob.create({ data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 } })
    const res = NextResponse.json({ success: true, articleId: article.id, jobId: job.id })
    if (!userId && guestId) setGuestCookie(res, guestId)
    return res
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}

