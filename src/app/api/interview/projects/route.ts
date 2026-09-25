// ============================================
// GET / POST /api/interview/projects
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import {
  getInterviewUser,
  getGuestIdFromRequest,
  ensureGuestId,
  setGuestCookie,
  interviewGuestTotalLimit,
  requireDatabase,
} from '@/lib/interview/access'

/**
 * GET — プロジェクト一覧
 */
export async function GET(req: NextRequest) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const statsOnly = req.nextUrl.searchParams.get('statsOnly') === '1'
    if (!userId && !guestId) {
      return NextResponse.json(statsOnly
        ? { success: true, stats: { totalProjects: 0, totalDrafts: 0, totalMaterials: 0 } }
        : { success: true, projects: [] })
    }

    const where = userId
      ? { userId }
      : { guestId: guestId! }

    if (statsOnly) {
      const [totalProjects, totalDrafts, totalMaterials] = await Promise.all([
        prisma.interviewProject.count({ where }),
        prisma.interviewDraft.count({ where: { project: { is: where } } }),
        prisma.interviewMaterial.count({ where: { project: { is: where } } }),
      ])
      return NextResponse.json({ success: true, stats: { totalProjects, totalDrafts, totalMaterials } })
    }

    const params = req.nextUrl.searchParams
    const query = (params.get('q') || '').trim()
    const status = params.get('status') || ''
    if (query.length > 100 || (status && !['DRAFT', 'EDITING', 'COMPLETED'].includes(status))) {
      return NextResponse.json({ success: false, error: '検索条件が正しくありません' }, { status: 400 })
    }

    let cursor: { createdAt: Date; id: string } | null = null
    const rawCursor = params.get('cursor')
    if (rawCursor) {
      try {
        if (rawCursor.length > 512) throw new Error('Cursor too long')
        const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { createdAt?: unknown; id?: unknown }
        if (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) {
          throw new Error('Invalid cursor')
        }
        const createdAt = new Date(decoded.createdAt)
        if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== decoded.createdAt) throw new Error('Invalid date')
        cursor = { createdAt, id: decoded.id }
      } catch {
        return NextResponse.json({ success: false, error: 'ページ指定が正しくありません' }, { status: 400 })
      }
    }

    const scopeWhere: Prisma.InterviewProjectWhereInput = where
    const searchWhere: Prisma.InterviewProjectWhereInput = {
      ...scopeWhere,
      ...(status ? { status } : {}),
      ...(query ? { OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { intervieweeName: { contains: query, mode: 'insensitive' } },
        { intervieweeCompany: { contains: query, mode: 'insensitive' } },
      ] } : {}),
    }
    const pageWhere: Prisma.InterviewProjectWhereInput = cursor
      ? { AND: [searchWhere, { OR: [
        { createdAt: { lt: cursor.createdAt } },
        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
      ] }] }
      : searchWhere

    const [rows, filteredCount, statusGroups] = await Promise.all([
      prisma.interviewProject.findMany({
        where: pageWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
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
      }),
      prisma.interviewProject.count({ where: searchWhere }),
      prisma.interviewProject.groupBy({ by: ['status'], where: scopeWhere, _count: { _all: true } }),
    ])
    const hasMore = rows.length > 50
    const projects = rows.slice(0, 50)
    const counts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all]))
    const last = projects[projects.length - 1]

    return NextResponse.json({
      success: true,
      totalCount: statusGroups.reduce((total, group) => total + group._count._all, 0),
      filteredCount,
      statusCounts: counts,
      nextCursor: hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64url')
        : null,
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
  } catch (error) {
    console.error('[interview/projects] List failed:', error)
    return NextResponse.json(
      { success: false, error: 'プロジェクト一覧の取得に失敗しました', projects: [] },
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
    const { userId } = await getInterviewUser()
    let guestId = !userId ? getGuestIdFromRequest(req) : null

    // ゲストIDがない場合は新規発行
    if (!userId && !guestId) {
      guestId = ensureGuestId()
    }

    // 日次の生成枠は記事保存時に消費する。プロジェクト作成は枠に含めない。
    if (!userId) {
      const limit = interviewGuestTotalLimit()
      const used = await prisma.interviewProject.count({ where: { guestId: guestId! } })
      if (used >= limit) {
        return NextResponse.json(
          { success: false, error: 'ゲスト利用の上限に達しました。ログインすると追加利用できます。', code: 'GUEST_LIMIT' },
          { status: 429 }
        )
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
    console.error('[interview/projects] unexpected error', e)
    return NextResponse.json(
      { success: false, error: 'プロジェクト作成に失敗しました' },
      { status: 500 }
    )
  }
}
