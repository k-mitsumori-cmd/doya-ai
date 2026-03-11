// ============================================
// POST /api/interviewx/projects/[id]/finalize
// ============================================
// ヒヤリング完了 → COMPLETED に更新

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(
  _req: NextRequest,
  { params }: RouteParams
) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const { userId } = await getInterviewXUser()
  const authErr = requireAuth(userId)
  if (authErr) return authErr

  try {
    const { id } = await params

    const project = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    // ステータスバリデーション（ANSWERED または SUMMARIZED のみ完了可能）
    if (!['ANSWERED', 'SUMMARIZED'].includes(project.status)) {
      return NextResponse.json(
        { success: false, error: `現在のステータス（${project.status}）では完了にできません` },
        { status: 400 }
      )
    }

    // 最新ドラフト（要約）を取得
    const latestDraft = await prisma.interviewXDraft.findFirst({
      where: { projectId: id },
      orderBy: { version: 'desc' },
    })
    if (latestDraft) {
      await prisma.interviewXDraft.update({
        where: { id: latestDraft.id },
        data: { status: 'PUBLISHED' },
      })
    }

    // プロジェクトを COMPLETED に更新
    await prisma.interviewXProject.update({
      where: { id },
      data: { status: 'COMPLETED' },
    })

    return NextResponse.json({
      success: true,
      message: 'ヒヤリングが完了しました',
      draftId: latestDraft?.id,
    })
  } catch (e) {
    console.error('[InterviewX] finalize error:', e)
    return NextResponse.json({ success: false, error: '完了処理に失敗しました' }, { status: 500 })
  }
}
