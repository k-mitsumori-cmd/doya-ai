import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
import { sendArticleReadyEmail } from '@/lib/interviewx/email'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  const { userId } = await getInterviewXUser()
  const authErr = requireAuth(userId)
  if (authErr) return authErr

  try {
    const project = await prisma.interviewXProject.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { email: true, name: true } },
      },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    // 最新ドラフトを取得
    const latestDraft = await prisma.interviewXDraft.findFirst({
      where: { projectId: params.id },
      orderBy: { version: 'desc' },
    })
    if (!latestDraft) {
      return NextResponse.json({ success: false, error: 'ドラフトがありません' }, { status: 400 })
    }

    // ドラフトを PUBLISHED に更新
    await prisma.interviewXDraft.update({
      where: { id: latestDraft.id },
      data: { status: 'PUBLISHED' },
    })

    // プロジェクトを COMPLETED に更新
    await prisma.interviewXProject.update({
      where: { id: params.id },
      data: { status: 'COMPLETED' },
    })

    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'

    // 企業ユーザーに完了通知
    if (project.user?.email) {
      sendArticleReadyEmail({
        to: project.user.email,
        recipientName: project.user.name || undefined,
        projectTitle: project.title,
        articleTitle: latestDraft.title || undefined,
        actionUrl: `${BASE_URL}/interviewx/projects/${params.id}/draft`,
        actionLabel: '完成記事を確認',
      }).catch(() => {})
    }

    // 回答者にも通知
    if (project.respondentEmail) {
      sendArticleReadyEmail({
        to: project.respondentEmail,
        recipientName: project.respondentName || undefined,
        projectTitle: project.title,
        articleTitle: latestDraft.title || undefined,
        actionUrl: `${BASE_URL}/interviewx/respond/${project.shareToken}/feedback`,
        actionLabel: '完成記事を確認',
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      message: '記事が最終確定されました',
      draftId: latestDraft.id,
    })
  } catch (e) {
    console.error('[InterviewX] finalize error:', e)
    return NextResponse.json({ success: false, error: '最終確定に失敗しました' }, { status: 500 })
  }
}
