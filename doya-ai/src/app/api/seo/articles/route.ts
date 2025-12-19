import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { getSeoDailyLimitByUserPlan } from '@/lib/pricing'

export async function GET() {
  try {
    await ensureSeoSchema()
    const seoArticle = (prisma as any).seoArticle as any
    const articles = await seoArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        jobs: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    return NextResponse.json({ success: true, articles })
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
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'ログインが必要です（無料プラン: 1日1回まで）' },
        { status: 401 }
      )
    }

    const userId = String((session.user as any).id || '')
    const userPlan = String((session.user as any).plan || 'FREE')
    const dailyLimit = getSeoDailyLimitByUserPlan(userPlan)

    // 日次上限チェック（今日作成したSEO記事数で判定）
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const usedToday = await (prisma as any).seoArticle.count({
      where: { userId, createdAt: { gte: start, lt: end } },
    })
    if (dailyLimit >= 0 && usedToday >= dailyLimit) {
      return NextResponse.json(
        {
          success: false,
          error: `本日の生成上限に達しました（${usedToday}/${dailyLimit}回）。プランをアップグレードしてください。`,
        },
        { status: 429 }
      )
    }

    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)

    const seoArticle = (prisma as any).seoArticle as any
    const seoJob = (prisma as any).seoJob as any

    const article = await seoArticle.create({
      data: {
        status: 'DRAFT',
        userId,
        title: input.title,
        keywords: input.keywords as any,
        persona: input.persona || null,
        searchIntent: input.searchIntent || null,
        targetChars: input.targetChars,
        tone: input.tone,
        forbidden: input.forbidden as any,
        referenceUrls: input.referenceUrls as any,
        llmoOptions: (input.llmoOptions ?? undefined) as any,
      },
    })

    const job = await seoJob.create({
      data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 },
    })

    return NextResponse.json({ success: true, articleId: article.id, jobId: job.id })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 400 }
    )
  }
}


