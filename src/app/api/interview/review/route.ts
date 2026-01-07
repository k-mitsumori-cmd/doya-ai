import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateReview } from '@/lib/interview/prompts'

// 校閲実行
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { projectId, draftId } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    // ドラフト取得
    const draft = draftId
      ? await prisma.interviewDraft.findFirst({
          where: {
            id: draftId,
            projectId,
          },
        })
      : await prisma.interviewDraft.findFirst({
          where: {
            projectId,
          },
          orderBy: { version: 'desc' },
        })

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    // 校閲レポート生成
    const reviewReport = await generateReview(draft.content)

    // 校閲結果保存
    const review = await prisma.interviewReview.create({
      data: {
        projectId,
        draftId: draft.id,
        report: reviewReport,
        score: 85, // TODO: 実際のスコア計算
        readabilityScore: 80, // TODO: 実際の読みやすさスコア計算
      },
    })

    return NextResponse.json({ review })
  } catch (error) {
    console.error('[INTERVIEW] Review error:', error)
    return NextResponse.json({ error: 'Failed to review' }, { status: 500 })
  }
}

