// ============================================
// GET /api/interviewx/projects/[id]/drafts/[draftId]
// ============================================
// ドラフト詳細取得（フィードバック・チェック付き）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

type RouteParams = { params: Promise<{ id: string; draftId: string }> }

// --------------------------------------------------
// GET — ドラフト詳細
// --------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id, draftId } = await params

    // プロジェクトの所有者確認
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

    // ドラフト取得
    const draft = await prisma.interviewXDraft.findUnique({
      where: { id: draftId },
    })

    if (!draft) {
      return NextResponse.json(
        { success: false, error: 'ドラフトが見つかりません' },
        { status: 404 }
      )
    }

    // ドラフトが該当プロジェクトのものか確認
    if (draft.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'ドラフトが見つかりません' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, draft })
  } catch (e: any) {
    console.error('[interviewx/drafts/[draftId]] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'ドラフト取得に失敗しました' },
      { status: 500 }
    )
  }
}
