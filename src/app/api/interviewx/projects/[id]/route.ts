// ============================================
// GET/PUT/DELETE /api/interviewx/projects/[id]
// ============================================
// プロジェクト詳細取得・更新・削除
//
// GET: 全リレーション付きのプロジェクト詳細
// PUT: プロジェクトフィールドの更新
// DELETE: プロジェクト削除（カスケード）

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'

type RouteParams = { params: Promise<{ id: string }> }

// --------------------------------------------------
// GET — プロジェクト詳細
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
      include: {
        template: true,
        questions: {
          orderBy: { order: 'asc' },
        },
        responses: {
          include: {
            answers: {
              include: {
                question: {
                  select: { id: true, text: true, type: true, order: true },
                },
              },
            },
          },
          orderBy: { startedAt: 'desc' },
        },
        drafts: {
          orderBy: { version: 'desc' },
          take: 1,
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
        checks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    return NextResponse.json({ success: true, project })
  } catch (e: any) {
    console.error('[interviewx/projects/[id]] GET error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'プロジェクト取得に失敗しました' },
      { status: 500 }
    )
  }
}

// --------------------------------------------------
// PUT — プロジェクト更新
// --------------------------------------------------
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id } = await params

    const existing = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(existing, userId)
    if (ownerErr) return ownerErr

    const body = await req.json()

    // 更新可能なフィールドのみ抽出
    const allowedFields = [
      'title', 'templateId', 'companyName', 'companyUrl', 'companyLogo',
      'brandColor', 'purpose', 'targetAudience', 'tone', 'articleType',
      'wordCountTarget', 'customInstructions', 'respondentName',
      'respondentEmail', 'status',
    ]

    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '更新するフィールドがありません' },
        { status: 400 }
      )
    }

    const project = await prisma.interviewXProject.update({
      where: { id },
      data: updateData,
      include: {
        template: {
          select: { id: true, name: true, category: true, icon: true },
        },
      },
    })

    return NextResponse.json({ success: true, project })
  } catch (e: any) {
    console.error('[interviewx/projects/[id]] PUT error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'プロジェクト更新に失敗しました' },
      { status: 500 }
    )
  }
}

// --------------------------------------------------
// DELETE — プロジェクト削除
// --------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id } = await params

    const existing = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(existing, userId)
    if (ownerErr) return ownerErr

    await prisma.interviewXProject.delete({ where: { id } })

    return NextResponse.json({ success: true, message: 'プロジェクトを削除しました' })
  } catch (e: any) {
    console.error('[interviewx/projects/[id]] DELETE error:', e?.message)
    return NextResponse.json(
      { success: false, error: 'プロジェクト削除に失敗しました' },
      { status: 500 }
    )
  }
}
