// ============================================
// GET /api/interviewx/projects/[id]/drafts
// ============================================
// ドラフト一覧取得（バージョン降順）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

type RouteParams = { params: Promise<{ id: string }> }

// --------------------------------------------------
// GET — ドラフト一覧
// --------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id } = await params

    const project = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    const drafts = await prisma.interviewXDraft.findMany({
      where: { projectId: id },
      orderBy: { version: 'desc' },
      select: {
        id: true,
        version: true,
        title: true,
        wordCount: true,
        readingTime: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            feedbacks: true,
            checks: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, drafts })
  } catch (e: any) {
    console.error('[interviewx/drafts] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'ドラフト一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}
