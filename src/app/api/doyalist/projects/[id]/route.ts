export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

async function requireOwnedProject(userId: string, projectId: string) {
  const project = await prisma.doyalistProject.findUnique({
    where: { id: projectId },
  })
  if (!project) return { error: 'プロジェクトが見つかりません', status: 404 as const }
  if (project.userId !== userId) {
    return { error: 'アクセス権がありません', status: 403 as const }
  }
  return { project }
}

/**
 * GET /api/doyalist/projects/[id]
 * プロジェクト詳細 + 企業一覧 + アプローチサマリ
 */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const [companies, approaches, approachCount] = await Promise.all([
      prisma.doyalistCompany.findMany({
        where: { projectId: id },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.doyalistApproach.findMany({
        where: { projectId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.doyalistApproach.count({ where: { projectId: id } }),
    ])

    // ステータス別件数
    const statusCounts: Record<string, number> = {}
    for (const c of companies) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
    }

    return NextResponse.json({
      success: true,
      project: guard.project,
      companies,
      approaches,
      summary: {
        companyCount: companies.length,
        approachCount,
        statusCounts,
      },
    })
  } catch (e: any) {
    console.error('[doyalist/projects/[id]][GET]', e)
    return NextResponse.json(
      { error: e?.message || 'プロジェクトの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/doyalist/projects/[id]
 * プロジェクト更新
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    const body = await req.json()
    const data: Record<string, any> = {}
    const fields = ['name', 'description', 'industry', 'region', 'targetSize', 'keywords', 'status']
    for (const k of fields) {
      if (body[k] !== undefined) data[k] = body[k]
    }

    const project = await prisma.doyalistProject.update({
      where: { id },
      data,
    })

    return NextResponse.json({ success: true, project })
  } catch (e: any) {
    console.error('[doyalist/projects/[id]][PATCH]', e)
    return NextResponse.json(
      { error: e?.message || 'プロジェクトの更新に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/doyalist/projects/[id]
 * ソフト削除（status='archived'）
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const id = await resolveId(ctx)
    const guard = await requireOwnedProject(userId, id)
    if ('error' in guard) {
      return NextResponse.json({ error: guard.error }, { status: guard.status })
    }

    await prisma.doyalistProject.update({
      where: { id },
      data: { status: 'archived' },
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[doyalist/projects/[id]][DELETE]', e)
    return NextResponse.json(
      { error: e?.message || 'プロジェクトの削除に失敗しました' },
      { status: 500 }
    )
  }
}
