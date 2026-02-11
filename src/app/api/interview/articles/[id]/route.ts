// ============================================
// GET / PUT /api/interview/articles/[id]
// ============================================
// ドラフト(記事)の取得・更新

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

/**
 * GET — ドラフト詳細取得
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const draft = await prisma.interviewDraft.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            userId: true,
            guestId: true,
            title: true,
            intervieweeName: true,
            intervieweeCompany: true,
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    return NextResponse.json({
      success: true,
      draft: {
        id: draft.id,
        projectId: draft.projectId,
        version: draft.version,
        title: draft.title,
        lead: draft.lead,
        content: draft.content,
        articleType: draft.articleType,
        displayFormat: draft.displayFormat,
        structure: draft.structure,
        wordCount: draft.wordCount,
        readingTime: draft.readingTime,
        seoTitle: draft.seoTitle,
        seoDescription: draft.seoDescription,
        status: draft.status,
        project: draft.project,
        latestReview: draft.reviews[0] || null,
        createdAt: draft.createdAt.toISOString(),
        updatedAt: draft.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PUT — ドラフト内容を更新 (エディタからの保存)
 */
export async function PUT(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const id = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const draft = await prisma.interviewDraft.findUnique({
      where: { id },
      include: { project: { select: { userId: true, guestId: true } } },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const allowedFields = [
      'title', 'lead', 'content', 'displayFormat',
      'seoTitle', 'seoDescription', 'socialTitle', 'socialDescription',
      'status',
    ]

    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key]
    }

    // contentが更新された場合はwordCountも更新
    if (data.content) {
      data.wordCount = data.content.length
      data.readingTime = Math.ceil(data.content.length / 600)
    }

    const updated = await prisma.interviewDraft.update({ where: { id }, data })

    return NextResponse.json({
      success: true,
      draft: {
        id: updated.id,
        wordCount: updated.wordCount,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '保存に失敗しました' },
      { status: 500 }
    )
  }
}