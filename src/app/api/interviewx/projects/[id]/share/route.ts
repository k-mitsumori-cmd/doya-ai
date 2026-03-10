// ============================================
// POST /api/interviewx/projects/[id]/share
// ============================================
// 共有URL生成 + メール送信（将来実装）
//
// リクエスト: { respondentEmail?, respondentName? }
// レスポンス: { shareUrl, shareToken }

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://doya-ai.surisuta.jp'

type RouteParams = { params: Promise<{ id: string }> }

// --------------------------------------------------
// POST — 共有URL生成
// --------------------------------------------------
export async function POST(req: NextRequest, { params }: RouteParams) {
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

    const body = await req.json().catch(() => ({}))
    const { respondentEmail, respondentName } = body as {
      respondentEmail?: string
      respondentName?: string
    }

    // 共有URLを構築
    const shareUrl = `${BASE_URL}/interviewx/respond/${project.shareToken}`

    // プロジェクトを更新（ステータス + 共有URL + 回答者情報）
    const updateData: Record<string, any> = {
      status: 'SHARED',
      shareUrl,
    }
    if (respondentEmail) {
      updateData.respondentEmail = respondentEmail
    }
    if (respondentName) {
      updateData.respondentName = respondentName
    }

    await prisma.interviewXProject.update({
      where: { id },
      data: updateData,
    })

    // TODO: メール送信を実装（respondentEmailが指定されている場合）
    // if (respondentEmail) {
    //   await sendSurveyInviteEmail({
    //     to: respondentEmail,
    //     respondentName,
    //     companyName: project.companyName || undefined,
    //     companyLogo: project.companyLogo || undefined,
    //     brandColor: project.brandColor || undefined,
    //     projectTitle: project.title,
    //     shareToken: project.shareToken,
    //   })
    // }

    return NextResponse.json({
      success: true,
      shareUrl,
      shareToken: project.shareToken,
    })
  } catch (e: any) {
    console.error('[interviewx/share] POST error:', e?.message)
    return NextResponse.json(
      { success: false, error: '共有URL生成に失敗しました' },
      { status: 500 }
    )
  }
}
