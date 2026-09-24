export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { getUserDoyaSlideLimits, DOYASLIDE_PROJECT_SERVICE_ID, isSameMonth, monthStart } from '@/lib/doyaslide/limits'
import { getDocType, DOC_TYPES, ASPECT_TO_SIZE, STYLE_PRESETS, MIN_SLIDES, MAX_SLIDES } from '@/lib/doyaslide/constants'
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

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: '入力内容を確認してください' }, { status: 400 })
    }
    const { title, docType, customBrief, slideCount, aspectRatio, themeColor, stylePreset } = body
    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'タイトル（テーマ）は必須です' }, { status: 400 })
    }
    if ((docType != null && (typeof docType !== 'string' || !DOC_TYPES.some((item) => item.value === docType)))
      || (customBrief != null && typeof customBrief !== 'string')
      || (slideCount != null && (typeof slideCount !== 'number' || !Number.isSafeInteger(slideCount) || slideCount < MIN_SLIDES || slideCount > MAX_SLIDES))
      || (aspectRatio != null && (typeof aspectRatio !== 'string' || !Object.prototype.hasOwnProperty.call(ASPECT_TO_SIZE, aspectRatio)))
      || (themeColor != null && (typeof themeColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(themeColor)))
      || (stylePreset != null && (typeof stylePreset !== 'string' || !STYLE_PRESETS.some((item) => item.value === stylePreset)))) {
      return NextResponse.json({ error: '資料設定の入力形式を確認してください' }, { status: 400 })
    }

    const dt = getDocType(docType || 'proposal')
    const count = slideCount ?? dt.defaultCount

    const data = {
      userId,
      title: title.trim().slice(0, 120),
      docType: dt.value,
      customBrief: customBrief || null,
      slideCount: count,
      aspectRatio: aspectRatio || dt.defaultAspect,
      themeColor: themeColor || '#7f19e6',
      stylePreset: stylePreset || 'corporate',
      status: 'draft',
    }
    const limits = await getUserDoyaSlideLimits(userId)
    const project = limits.maxProjects === -1
      ? await prisma.doyaSlideProject.create({ data })
      : await prisma.$transaction(async (tx) => {
        const users = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
        if (users.length === 0) throw new Error('DoyaSlide account not found')
        const now = new Date()
        const [existing, ledger] = await Promise.all([
          tx.doyaSlideProject.count({ where: { userId, createdAt: { gte: monthStart(now) } } }),
          tx.userServiceSubscription.findUnique({
            where: { userId_serviceId: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID } },
            select: { monthlyUsage: true, lastUsageReset: true },
          }),
        ])
        const used = Math.max(existing, ledger && isSameMonth(ledger.lastUsageReset, now) ? ledger.monthlyUsage : 0)
        if (used >= limits.maxProjects) return null
        const project = await tx.doyaSlideProject.create({ data })
        await tx.userServiceSubscription.upsert({
          where: { userId_serviceId: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID } },
          create: { userId, serviceId: DOYASLIDE_PROJECT_SERVICE_ID, monthlyUsage: used + 1, lastUsageReset: now },
          update: { monthlyUsage: used + 1, lastUsageReset: now },
        })
        return project
      })
    if (!project) {
      return NextResponse.json(
        {
          error: `今月のプロジェクト作成数が上限（${limits.maxProjects}件）に達しています。プロプランではプロジェクト数の上限なく作成できます。`,
          code: 'LIMIT_REACHED',
          limit: limits.maxProjects,
          upgradeUrl: '/doyaslide/pricing',
        },
        { status: 403 }
      )
    }
    return NextResponse.json({ project }, { status: 201 })
  } catch (e: any) {
    console.error('[doyaslide/projects POST]', e?.stack || e)
    return NextResponse.json({ error: `作成に失敗しました${errorSuffix(e)}` }, { status: 500 })
  }
}
