// ============================================
// GET /api/interviewx/public/[token]
// ============================================
// 公開アンケートページ用 — プロジェクト情報 + 質問一覧取得
// shareToken によるアクセス制御（認証不要）
// status が SHARED または RESPONDING の場合のみ返却

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
        title: true,
        companyName: true,
        companyLogo: true,
        brandColor: true,
        status: true,
        purpose: true,
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            description: true,
            type: true,
            options: true,
            required: true,
            order: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'アンケートが見つかりません' },
        { status: 404 }
      )
    }

    // SHARED または RESPONDING のみ回答を受け付ける
    if (!['SHARED', 'RESPONDING'].includes(project.status)) {
      // 既に回答済みの場合
      if (project.status === 'ANSWERED' || project.status === 'GENERATING' || project.status === 'REVIEW' || project.status === 'FEEDBACK' || project.status === 'COMPLETED') {
        return NextResponse.json(
          { success: false, error: 'このアンケートは既に回答済みです', code: 'ALREADY_ANSWERED' },
          { status: 410 }
        )
      }
      return NextResponse.json(
        { success: false, error: 'このアンケートは現在利用できません' },
        { status: 404 }
      )
    }

    // ステータスを RESPONDING に更新（初回アクセス時）
    if (project.status === 'SHARED') {
      await prisma.interviewXProject.update({
        where: { shareToken: token },
        data: { status: 'RESPONDING' },
      })
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        companyName: project.companyName,
        companyLogo: project.companyLogo,
        brandColor: project.brandColor || '#3B82F6',
        purpose: project.purpose,
        questions: project.questions,
      },
    })
  } catch (e: any) {
    console.error('[interviewx] public GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'サーバーエラーが発生しました' },
      { status: 500 }
    )
  }
}
