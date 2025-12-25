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
    // テスト段階のため、SEO記事作成の日次上限チェックは一旦無効化する。
    // 既存の上限ロジックは将来戻せるように残す（pricing側に実装あり）。
    // const userPlan = String((session.user as any).plan || 'FREE')
    // const dailyLimit = getSeoDailyLimitByUserPlan(userPlan)

    // NOTE: 日次上限チェックは停止中（テスト用）

    const body = await req.json()
    const input = SeoCreateArticleInputSchema.parse(body)

    const seoArticle = (prisma as any).seoArticle as any
    const seoJob = (prisma as any).seoJob as any

    const article = await seoArticle.create({
      data: {
        status: 'RUNNING',
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

    // 50,000字〜の安定生成のため、分割生成ジョブを作って記事ページ側でadvanceする
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


