export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { getUserDoyaSlideLimits, countProjects } from '@/lib/doyaslide/limits'
import { getDocType, MIN_SLIDES, MAX_SLIDES } from '@/lib/doyaslide/constants'
import { errorSuffix } from '@/lib/doyaslide/errors'

// GET /api/doyaslide/projects — 自分のプロジェクト一覧
export async function GET() {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const projects = await prisma.doyaSlideProject.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        slides: { select: { id: true, index: true, imageUrl: true }, orderBy: { index: 'asc' } },
      },
    })
    return NextResponse.json({ projects })
  } catch (e) {
    console.error('[doyaslide/projects GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// POST /api/doyaslide/projects — 新規プロジェクト作成
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const limits = await getUserDoyaSlideLimits(userId)
    if (limits.maxProjects !== -1) {
      const count = await countProjects(userId)
      if (count >= limits.maxProjects) {
        return NextResponse.json(
          { error: `プロジェクト数が上限（${limits.maxProjects}件）に達しています。プロにアップグレードしてください。` },
          { status: 403 }
        )
      }
    }

    const body = await req.json().catch(() => ({}))
    const { title, docType, customBrief, slideCount, aspectRatio, themeColor, stylePreset } = body
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'タイトル（テーマ）は必須です' }, { status: 400 })
    }

    const dt = getDocType(docType || 'proposal')
    const count = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Number(slideCount) || dt.defaultCount))

    const project = await prisma.doyaSlideProject.create({
      data: {
        userId,
        title: title.slice(0, 120),
        docType: dt.value,
        customBrief: customBrief || null,
        slideCount: count,
        aspectRatio: aspectRatio || dt.defaultAspect,
        themeColor: themeColor || '#7f19e6',
        stylePreset: stylePreset || 'corporate',
        status: 'draft',
      },
    })
    return NextResponse.json({ project }, { status: 201 })
  } catch (e: any) {
    console.error('[doyaslide/projects POST]', e?.stack || e)
    return NextResponse.json({ error: `作成に失敗しました${errorSuffix(e)}` }, { status: 500 })
  }
}
