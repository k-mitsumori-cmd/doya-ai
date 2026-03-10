// ============================================
// POST /api/interviewx/public/[token]/feedback
// ============================================
// 回答者からのフィードバック送信（認証不要）
// 生成された記事に対するフィードバックを authorType='RESPONDENT' で保存

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface FeedbackBody {
  content: string
  section?: string
  category?: string
}

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    if (!token) {
      return NextResponse.json(
        { success: false, error: '無効なリンクです' },
        { status: 400 }
      )
    }

    // プロジェクト取得
    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        status: true,
        respondentName: true,
        drafts: {
          orderBy: { version: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    // REVIEW または FEEDBACK ステータスのみフィードバック受付
    if (!['REVIEW', 'FEEDBACK'].includes(project.status)) {
      return NextResponse.json(
        { success: false, error: '現在フィードバックを受け付けていません' },
        { status: 410 }
      )
    }

    const body: FeedbackBody = await req.json()
    const { content, section, category } = body

    if (!content?.trim()) {
      return NextResponse.json(
        { success: false, error: 'フィードバック内容を入力してください' },
        { status: 400 }
      )
    }

    const latestDraftId = project.drafts[0]?.id || null

    // フィードバック作成
    const feedback = await prisma.interviewXFeedback.create({
      data: {
        projectId: project.id,
        draftId: latestDraftId,
        authorType: 'RESPONDENT',
        authorName: project.respondentName || '回答者',
        content: content.trim(),
        section: section || null,
        category: category || 'GENERAL',
      },
    })

    // ステータスを FEEDBACK に更新（まだでなければ）
    if (project.status !== 'FEEDBACK') {
      await prisma.interviewXProject.update({
        where: { id: project.id },
        data: { status: 'FEEDBACK' },
      })
    }

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    })
  } catch (e: any) {
    console.error('[interviewx] feedback POST error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
