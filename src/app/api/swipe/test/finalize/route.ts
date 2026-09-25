import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isTrialActive, normalizeSeoPlan } from '@/lib/seoAccess'
import { createSeoArticleWithinLimit, SeoArticleQuotaError } from '@/lib/seo-article-admission'
import { getSeoCharLimitByUserPlan } from '@/lib/pricing'
import { SwipeQuestionSchema } from '@/lib/swipe-request'
import { SeoCreateArticleInputSchema } from '@seo/lib/types'

const FinalizeSchema = SwipeQuestionSchema.extend({
  finalData: z.object({
    title: z.string().trim().min(1).max(200),
    targetChars: z.number().int().min(1000).max(50000),
    summary: z.string().max(10000).optional(),
    titleCandidates: z.array(z.string().max(200)).max(10).optional(),
  }),
  primaryInfoText: z.string().max(20000).optional(),
})

/** Create one article per owned swipe session through the shared monthly quota. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const user: any = session?.user || null
    const userId = String(user?.id || '').trim()
    if (!userId) return NextResponse.json({ code: 'LOGIN_REQUIRED', error: '記事を生成するにはログインしてください。' }, { status: 401 })

    const parsed = FinalizeSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: '入力内容を確認してください。' }, { status: 400 })
    const { sessionId, finalData, answers, primaryInfoText } = parsed.data
    const swipeSession = await prisma.swipeSession.findUnique({ where: { sessionId } })
    if (!swipeSession) return NextResponse.json({ error: 'セッションが見つかりません。' }, { status: 404 })
    if (swipeSession.userId !== userId) return NextResponse.json({ error: 'このセッションにはアクセスできません。' }, { status: 403 })

    // A retry after a lost response must return the original job, not charge another article.
    if (swipeSession.generatedArticleId) {
      const job = await prisma.seoJob.findFirst({ where: { articleId: swipeSession.generatedArticleId, article: { userId } }, orderBy: { id: 'asc' } })
      if (job) return NextResponse.json({ success: true, jobId: job.id, articleId: job.articleId })
      return NextResponse.json({ error: '既存の記事の状態を確認できません。' }, { status: 409 })
    }

    const plan = normalizeSeoPlan(user?.seoPlan || user?.plan || 'FREE')
    const trialActive = isTrialActive(user?.firstLoginAt || null).active
    const charLimit = getSeoCharLimitByUserPlan(trialActive ? 'PRO' : plan)
    if (finalData.targetChars > charLimit) {
      return NextResponse.json({ code: 'SEO_CHAR_LIMIT', error: `文字数上限（${charLimit.toLocaleString()}字）を超えています。プランをアップグレードしてください。` }, { status: 400 })
    }

    const keywords = swipeSession.mainKeyword.split(',').map(k => k.trim()).filter(Boolean)
    const currentYear = new Date().getFullYear()
    const title = finalData.title.replace(/【20\d{2}年(最新|最新版)】/g, `【${currentYear}年最新版】`).replace(/20\d{2}年(最新|最新版)/g, `${currentYear}年最新版`).replace(/20\d{2}年/g, `${currentYear}年`)
    const yesAnswers = answers.filter(a => a.answer === 'yes')
    const comparison = yesAnswers.some(a => a.question.includes('比較'))
    const byCategory = new Map<string, string[]>()
    for (const answer of answers) {
      const category = answer.category || '一般'
      byCategory.set(category, [...(byCategory.get(category) || []), `${answer.question}: ${answer.answer === 'yes' ? 'はい' : 'いいえ'}`])
    }
    const answersText = [...byCategory].map(([category, items]) => `【${category}】\n${items.join('\n')}`).join('\n\n')
    const requestText = [
      primaryInfoText?.trim() ? `【一次情報（必ず反映）】\n${primaryInfoText.trim()}` : '',
      finalData.summary?.trim() ? `【質問回答から得た方向性】\n${finalData.summary.trim()}` : '',
      answersText ? `【スワイプ回答詳細】\n${answersText}` : '',
    ].filter(Boolean).join('\n\n')
    const articleInput = SeoCreateArticleInputSchema.safeParse({ title, keywords, targetChars: finalData.targetChars, mode: comparison ? 'comparison_research' : 'standard', requestText: requestText || null })
    if (!articleInput.success) return NextResponse.json({ error: 'キーワードまたは記事条件を確認してください。' }, { status: 400 })

    const { article, job } = await createSeoArticleWithinLimit({
      userId, guestId: null, plan, trialActive, createJob: true,
      articleData: { ...articleInput.data, referenceImages: articleInput.data.referenceImages ?? undefined },
      afterCreate: async (tx, created) => {
        // Extended unique where makes this an atomic one-time claim. A losing
        // concurrent request rolls back its article, job, and usage ledger.
        await tx.swipeSession.update({
          where: { sessionId, userId, generatedArticleId: null },
          data: {
            finalConditions: { targetChars: finalData.targetChars, articleType: comparison ? 'comparison' : 'standard', selectedTitle: finalData.title, titleCandidates: finalData.titleCandidates || [] },
            primaryInfo: primaryInfoText?.trim() ? { experience: primaryInfoText.trim() } : undefined,
            generatedArticleId: created.id,
            swipes: answers.map(a => ({ questionId: a.questionId || '', question: a.question, answer: a.answer, category: a.category || '一般' })),
          },
        })
      },
    })
    return NextResponse.json({ success: true, jobId: job!.id, articleId: article.id })
  } catch (error: unknown) {
    if (error instanceof SeoArticleQuotaError) return NextResponse.json({ code: 'SEO_ARTICLE_LIMIT', error: `今月の生成回数の上限に達しました（${error.limit}回/月）。プランをアップグレードすると増やせます。`, upgradeUrl: '/seo/dashboard/plan' }, { status: 429 })
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') return NextResponse.json({ error: 'この記事はすでに生成されています。画面を更新して確認してください。' }, { status: 409 })
    console.error('[swipe/test/finalize] error:', error)
    return NextResponse.json({ error: '記事の作成に失敗しました。時間をおいて再試行してください。' }, { status: 503 })
  }
}
