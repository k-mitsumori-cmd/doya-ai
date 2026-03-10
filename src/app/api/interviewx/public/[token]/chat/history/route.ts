// ============================================
// GET /api/interviewx/public/[token]/chat/history
// ============================================
// チャット履歴取得（ページリロード時の復元用）
// 認証不要（トークンベース）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteParams = { params: Promise<{ token: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params
    const responseId = req.nextUrl.searchParams.get('responseId')

    if (!responseId) {
      return NextResponse.json({ success: false, error: 'responseIdが必要です' }, { status: 400 })
    }

    // プロジェクト確認
    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        questions: { orderBy: { order: 'asc' }, select: { id: true } },
      },
    })

    if (!project) {
      return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })
    }

    // レスポンス + メッセージ取得
    const response = await prisma.interviewXResponse.findUnique({
      where: { id: responseId },
      include: {
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            topicIndex: true,
            messageType: true,
            createdAt: true,
          },
        },
      },
    })

    if (!response || response.projectId !== project.id) {
      return NextResponse.json({ success: false, error: 'セッションが見つかりません' }, { status: 404 })
    }

    // カバー済みトピック数
    const coveredTopics = new Set(
      response.chatMessages
        .filter(m => m.role === 'respondent')
        .map(m => m.topicIndex)
        .filter((i): i is number => i != null)
    )

    return NextResponse.json({
      success: true,
      messages: response.chatMessages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        topicIndex: m.topicIndex,
        createdAt: m.createdAt,
      })),
      topicsTotal: project.questions.length,
      topicsCovered: coveredTopics.size,
      isComplete: response.status === 'COMPLETED',
    })
  } catch (e: any) {
    console.error('[interviewx-chat] history error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
