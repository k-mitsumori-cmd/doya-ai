// ============================================
// GET /api/interviewx/public/[token]/status
// ============================================
// プロジェクトの回答状況チェック（認証不要）
// 回答者が自分の回答状況を確認するために使用

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
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

    const project = await prisma.interviewXProject.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        status: true,
        title: true,
        companyName: true,
        companyLogo: true,
        brandColor: true,
        _count: {
          select: {
            responses: true,
          },
        },
        // フィードバック・レビュー用に最新ドラフトも返す
        drafts: {
          orderBy: { version: 'desc' },
          take: 1,
          select: {
            id: true,
            version: true,
            title: true,
            lead: true,
            content: true,
            wordCount: true,
            readingTime: true,
            status: true,
            createdAt: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const latestDraft = project.drafts[0] || null

    return NextResponse.json({
      success: true,
      status: project.status,
      hasResponse: project._count.responses > 0,
      responseCount: project._count.responses,
      project: {
        title: project.title,
        companyName: project.companyName,
        companyLogo: project.companyLogo,
        brandColor: project.brandColor || '#3B82F6',
      },
      // REVIEW または FEEDBACK ステータスの場合のみドラフト情報を返す
      draft: ['REVIEW', 'FEEDBACK'].includes(project.status) ? latestDraft : null,
    })
  } catch (e: any) {
    console.error('[interviewx] status GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
