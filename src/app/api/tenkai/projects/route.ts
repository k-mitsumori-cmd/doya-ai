// ============================================
// GET / POST /api/tenkai/projects
// ============================================

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { incrementProjectCount } from '@/lib/tenkai/access'

/**
 * GET — プロジェクト一覧（ページネーション、検索、ソート）
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search') || ''
    const sort = searchParams.get('sort') || 'newest'
    let sortBy = 'createdAt'
    let sortOrder: 'asc' | 'desc' = 'desc'
    if (sort === 'oldest') { sortBy = 'createdAt'; sortOrder = 'asc' }
    else if (sort === 'name') { sortBy = 'title'; sortOrder = 'asc' }
    else if (sort === 'score') { sortBy = 'updatedAt'; sortOrder = 'desc' } // スコアソートはDB直接不可、更新日で代替
    const status = searchParams.get('status') || undefined

    const where: Record<string, unknown> = { userId }
    if (search) {
      where.title = { contains: search, mode: 'insensitive' }
    }
    if (status) {
      where.status = status
    }

    const orderBy: Record<string, string> = {}
    if (['createdAt', 'updatedAt', 'title'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = 'desc'
    }

    const [projects, total] = await Promise.all([
      prisma.tenkaiProject.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { outputs: true } },
          outputs: {
            select: { platform: true, status: true, qualityScore: true },
            orderBy: { version: 'desc' },
          },
        },
      }),
      prisma.tenkaiProject.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      projects: projects.map((p) => {
        // 各プラットフォームの最新バージョンのみ抽出
        const latestByPlatform = new Map<string, { status: string; qualityScore: number | null }>()
        for (const o of p.outputs) {
          if (!latestByPlatform.has(o.platform)) {
            latestByPlatform.set(o.platform, { status: o.status, qualityScore: o.qualityScore })
          }
        }

        const platformStatuses = Array.from(latestByPlatform.entries()).map(([platform, data]) => ({
          platform,
          status: data.status as 'completed' | 'generating' | 'pending' | 'failed',
        }))

        // 品質スコア平均
        const scores = Array.from(latestByPlatform.values())
          .map((d) => d.qualityScore)
          .filter((s): s is number => s !== null)
        const avgScore = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
          : undefined

        return {
          id: p.id,
          title: p.title,
          inputType: p.inputType,
          date: p.createdAt.toISOString(),
          status: p.status,
          score: avgScore,
          platformStatuses,
          outputCount: p._count.outputs,
        }
      }),
      hasMore: page < totalPages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] projects list error:', message)
    return NextResponse.json(
      { error: message || 'プロジェクト一覧の取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST — プロジェクト新規作成
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.user.id

    const body = await req.json()
    const { title, inputType, inputUrl, inputText } = body as {
      title: string
      inputType?: string
      inputUrl?: string
      inputText?: string
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'タイトルは必須です' }, { status: 400 })
    }

    const project = await prisma.tenkaiProject.create({
      data: {
        userId,
        title: title.trim(),
        inputType: inputType || 'text',
        inputUrl: inputUrl || null,
        inputText: inputText || null,
        status: 'draft',
        wordCount: inputText ? inputText.length : null,
        language: 'ja',
      },
    })

    await incrementProjectCount(userId)

    return NextResponse.json({
      project: {
        id: project.id,
        title: project.title,
        inputType: project.inputType,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'エラーが発生しました'
    console.error('[tenkai] project create error:', message)
    return NextResponse.json(
      { error: message || 'プロジェクト作成に失敗しました' },
      { status: 500 }
    )
  }
}
