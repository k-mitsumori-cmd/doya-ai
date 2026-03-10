import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; draftId: string } }
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

    const checks = await prisma.interviewXCheck.findMany({
      where: { draftId: params.draftId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, checks })
  } catch (e) {
    console.error('[InterviewX] checks GET error:', e)
    return NextResponse.json({ success: false, error: 'チェック結果の取得に失敗しました' }, { status: 500 })
  }
}
