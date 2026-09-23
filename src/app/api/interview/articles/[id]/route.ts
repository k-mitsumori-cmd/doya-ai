// ============================================
// GET / PUT /api/interview/articles/[id]
// ============================================
// ドラフト(記事)の取得・更新

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: '保存内容が不正です' }, { status: 400 })
    }
    if (typeof body.expectedUpdatedAt !== 'string') {
      return NextResponse.json({ success: false, error: '記事の更新情報がありません。入力をコピーして保管してから記事を開き直してください。' }, { status: 428 })
    }
    const expectedUpdatedAt = new Date(body.expectedUpdatedAt)
    if (!Number.isFinite(expectedUpdatedAt.getTime())) {
      return NextResponse.json({ success: false, error: '記事の更新情報が不正です' }, { status: 400 })
    }
    if (draft.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return NextResponse.json({ success: false, error: '別の画面で記事が更新されています。入力をコピーして保管してから最新版を確認してください。', code: 'EDIT_CONFLICT' }, { status: 409 })
    }
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
    if (typeof data.content === 'string') {
      data.wordCount = data.content.length
      data.readingTime = Math.ceil(data.content.length / 600)
    }

    // 同じミリ秒内の更新も、次回保存から区別できる更新日時にする。
    data.updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1))
    const updated = await prisma.interviewDraft.update({ where: { id, updatedAt: expectedUpdatedAt }, data })

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
    if (e?.code === 'P2025') {
      return NextResponse.json({ success: false, error: '記事が更新または削除されました。入力をコピーして保管してから最新版を確認してください。', code: 'EDIT_CONFLICT' }, { status: 409 })
    }
    return NextResponse.json(
      { success: false, error: e?.message || '保存に失敗しました' },
      { status: 500 }
    )
  }
}
