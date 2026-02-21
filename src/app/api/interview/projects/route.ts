// ============================================
// GET / POST /api/interview/projects
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  getInterviewUser,
  getGuestIdFromRequest,
  ensureGuestId,
  setGuestCookie,
  isTrialActive,
  interviewDailyLimit,
  interviewGuestTotalLimit,
  jstDayRange,
  requireDatabase,
} from '@/lib/interview/access'

/**
 * GET — プロジェクト一覧
 */
export async function GET(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return NextResponse.json({ success: true, projects: [] })

  try {
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    if (!userId && !guestId) {
      return NextResponse.json({ success: true, projects: [] })
    }

    const where = userId
      ? { userId }
      : { guestId: guestId! }

    const projects = await prisma.interviewProject.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        _count: {
          select: {
            materials: true,
            drafts: true,
          },
        },
        drafts: {
          take: 1,
          orderBy: { version: 'desc' },
          select: { title: true, content: true },
        },
        transcriptions: {
          where: { status: 'COMPLETED' },
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { summary: true, text: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      projects: projects.map((p) => {
        const latestDraft = p.drafts?.[0]
        const latestTranscription = p.transcriptions?.[0]
        return {
          id: p.id,
          title: p.title,
          status: p.status,
          intervieweeName: p.intervieweeName,
          intervieweeRole: p.intervieweeRole,
          intervieweeCompany: p.intervieweeCompany,
          genre: p.genre,
          theme: p.theme,
          thumbnailUrl: p.thumbnailUrl || null,
          materialCount: p._count.materials,
          draftCount: p._count.drafts,
          articleTitle: latestDraft?.title || null,
          articleSummary: latestDraft?.content
            ? latestDraft.content.replace(/^#.*\n/gm, '').replace(/\n+/g, ' ').trim().slice(0, 120)
            : null,
          transcriptionSummary: latestTranscription?.summary || null,
          transcriptionExcerpt: latestTranscription?.text
            ? latestTranscription.text.replace(/\n+/g, ' ').trim().slice(0, 150)
            : null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        }
      }),
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'プロジェクト一覧の取得に失敗しました', projects: [] },
      { status: 500 }
    )
  }
}

/**
 * POST — プロジェクト新規作成
 */
export async function POST(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId, plan, firstLoginAt } = await getInterviewUser()
    let guestId = !userId ? getGuestIdFromRequest(req) : null

    // ゲストIDがない場合は新規発行
    if (!userId && !guestId) {
      guestId = ensureGuestId()
    }

    // 利用制限チェック
    const trialActive = !!userId && isTrialActive(firstLoginAt)
    if (!trialActive) {
      if (userId) {
        const limit = interviewDailyLimit(plan)
        if (limit >= 0) {
          const { start, end } = jstDayRange()
          const used = await prisma.interviewProject.count({
            where: { userId, createdAt: { gte: start, lt: end } },
          })
          if (used >= limit) {
            return NextResponse.json(
              { success: false, error: `本日のプロジェクト作成上限 (${limit}件/日) に達しました` },
              { status: 429 }
            )
          }
        }
      } else {
        const limit = interviewGuestTotalLimit()
        const used = await prisma.interviewProject.count({
          where: { guestId: guestId! },
        })
        if (used >= limit) {
          return NextResponse.json(
            { success: false, error: 'ゲスト利用の上限に達しました。ログインすると追加利用できます。', code: 'GUEST_LIMIT' },
            { status: 429 }
          )
        }
      }
    }

    const body = await req.json()
    const {
      title,
      intervieweeName,
      intervieweeRole,
      intervieweeCompany,
      intervieweeBio,
      genre,
      theme,
      purpose,
      targetAudience,
      tone,
      mediaType,
    } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'タイトルは必須です' },
        { status: 400 }
      )
    }

    // 文字数制限バリデーション
    const STR_LIMITS: Record<string, [string, number]> = {
      title: ['タイトル', 200],
      intervieweeName: ['インタビュイー名', 100],
      intervieweeRole: ['役職', 100],
      intervieweeCompany: ['会社名', 100],
      intervieweeBio: ['プロフィール', 2000],
      theme: ['テーマ', 500],
      purpose: ['目的', 500],
      targetAudience: ['対象読者', 200],
    }
    for (const [key, [label, max]] of Object.entries(STR_LIMITS)) {
      const v = body[key]
      if (v && typeof v === 'string' && v.length > max) {
        return NextResponse.json(
          { success: false, error: `${label}は${max}文字以内で入力してください` },
          { status: 400 }
        )
      }
    }

    // 許可値バリデーション
    const VALID_GENRES = ['CASE_STUDY', 'PRODUCT_INTERVIEW', 'PERSONA_INTERVIEW', 'PANEL_DISCUSSION', 'EVENT_REPORT', 'OTHER']
    if (genre && !VALID_GENRES.includes(genre)) {
      return NextResponse.json(
        { success: false, error: '不正なジャンルです' },
        { status: 400 }
      )
    }
    const VALID_TONES = ['friendly', 'formal', 'casual', 'professional', 'academic']
    if (tone && !VALID_TONES.includes(tone)) {
      return NextResponse.json(
        { success: false, error: '不正なトーンです' },
        { status: 400 }
      )
    }

    const project = await prisma.interviewProject.create({
      data: {
        userId: userId || null,
        guestId: userId ? null : guestId,
        title: title.trim().slice(0, 200),
        status: 'DRAFT',
        intervieweeName: intervieweeName ? String(intervieweeName).slice(0, 100) : null,
        intervieweeRole: intervieweeRole ? String(intervieweeRole).slice(0, 100) : null,
        intervieweeCompany: intervieweeCompany ? String(intervieweeCompany).slice(0, 100) : null,
        intervieweeBio: intervieweeBio ? String(intervieweeBio).slice(0, 2000) : null,
        genre: genre || null,
        theme: theme ? String(theme).slice(0, 500) : null,
        purpose: purpose ? String(purpose).slice(0, 500) : null,
        targetAudience: targetAudience ? String(targetAudience).slice(0, 200) : null,
        tone: tone || 'friendly',
        mediaType: mediaType || null,
      },
    })

    const res = NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      },
    })

    if (!userId && guestId) {
      setGuestCookie(res, guestId)
    }

    return res
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || 'プロジェクト作成に失敗しました' },
      { status: 500 }
    )
  }
}
