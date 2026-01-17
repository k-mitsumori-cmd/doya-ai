import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * 最終確認後、記事を生成するAPI
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const { sessionId, finalData, answers } = body

    if (!sessionId || !finalData || !answers) {
      return NextResponse.json({ error: 'sessionId, finalData, and answers are required' }, { status: 400 })
    }

    // セッションを取得
    const swipeSession = await prisma.swipeSession.findUnique({
      where: { sessionId },
    })

    if (!swipeSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // 回答から記事の種類などを推測
    const yesAnswers = answers.filter((a: any) => a.answer === 'yes')
    const articleType = yesAnswers.some((a: any) => a.question.includes('比較'))
      ? 'comparison'
      : yesAnswers.some((a: any) => a.question.includes('解説') || a.question.includes('説明'))
      ? 'explanation'
      : yesAnswers.some((a: any) => a.question.includes('HowTo') || a.question.includes('使い方'))
      ? 'howto'
      : 'list'

    // キーワードを抽出
    const keywords = swipeSession.mainKeyword.split(',').map((k: string) => k.trim())

    // 記事を作成
    const article = await prisma.seoArticle.create({
      data: {
        title: finalData.title,
        keywords,
        targetChars: finalData.targetChars,
        mode: articleType === 'comparison' ? 'comparison_research' : 'standard',
        userId: session?.user?.id || null,
        guestId: session?.user?.id ? null : swipeSession.guestId || null,
        status: 'DRAFT',
      },
    })

    // ジョブを作成
    const job = await prisma.seoJob.create({
      data: {
        articleId: article.id,
        status: 'queued',
        step: 'init',
        progress: 0,
      },
    })

    // セッションを更新
    await prisma.swipeSession.update({
      where: { sessionId },
      data: {
        finalConditions: { targetChars: finalData.targetChars, articleType },
        generatedArticleId: article.id,
        swipes: answers.map((a: any) => ({
          questionId: a.questionId,
          question: a.question,
          answer: a.answer,
          category: 'test',
        })),
      },
    })

    return NextResponse.json({
      success: true,
      jobId: job.id,
      articleId: article.id,
    })
  } catch (error: any) {
    console.error('[swipe/test/finalize] error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
