import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
import { sendFeedbackNotificationEmail } from '@/lib/interviewx/email'

export async function GET(
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
      select: { userId: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const feedbacks = await prisma.interviewXFeedback.findMany({
      where: { projectId: params.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, feedbacks })
  } catch (e) {
    console.error('[InterviewX] feedbacks GET error:', e)
    return NextResponse.json({ success: false, error: 'フィードバック取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
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
      select: { userId: true, title: true, respondentEmail: true, respondentName: true, status: true },
    })
    if (!project) return NextResponse.json({ success: false, error: 'プロジェクトが見つかりません' }, { status: 404 })

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const { content, section, category, draftId } = body

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: 'フィードバック内容を入力してください' }, { status: 400 })
    }

    const feedback = await prisma.interviewXFeedback.create({
      data: {
        projectId: params.id,
        draftId: draftId || null,
        authorType: 'COMPANY',
        authorName: null,
        content: content.trim(),
        section: section || null,
        category: category || 'GENERAL',
      },
    })

    // ステータスをFEEDBACKに更新
    if (project.status === 'REVIEW') {
      await prisma.interviewXProject.update({
        where: { id: params.id },
        data: { status: 'FEEDBACK' },
      })
    }

    // 回答者にフィードバック通知メール（回答者のメールがある場合）
    if (project.respondentEmail) {
      const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'
      sendFeedbackNotificationEmail({
        to: project.respondentEmail,
        recipientName: project.respondentName || undefined,
        projectTitle: project.title,
        feedbackAuthor: '企業担当者',
        feedbackPreview: content.trim(),
        actionUrl: `${BASE_URL}/interviewx/respond/${params.id}/feedback`,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, feedback })
  } catch (e) {
    console.error('[InterviewX] feedbacks POST error:', e)
    return NextResponse.json({ success: false, error: 'フィードバック追加に失敗しました' }, { status: 500 })
  }
}
