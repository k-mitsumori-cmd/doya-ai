export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserDoyalistLimits } from '@/lib/doyalist/limits'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { MAX_DOYALIST_PROJECT_BODY_BYTES, parseDoyalistProjectInput } from '@/lib/doyalist/project-input'
import { streamDoyalistJsonArray } from '@/lib/doyalist/stream-json'

/**
 * GET /api/doyalist/projects
 * ログインユーザーのプロジェクト一覧（企業件数付き）を返す
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    const projects = await prisma.doyalistProject.findMany({
      where: {
        userId,
        status: { not: 'archived' },
        // 失敗した0社のプロジェクトも、枠を消費するため履歴から整理可能にする。
      },
      include: {
        _count: { select: { companies: true, approaches: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      industry: p.industry,
      region: p.region,
      targetSize: p.targetSize,
      keywords: p.keywords,
      status: p.status,
      companyCount: p._count.companies,
      approachCount: p._count.approaches,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    return streamDoyalistJsonArray({ success: true }, 'projects', result)
  } catch {
    console.error('[doyalist/projects][GET] failed')
    return NextResponse.json(
      { error: 'プロジェクトの取得に失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/doyalist/projects
 * 新規プロジェクト作成
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as any)?.id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = await readOperationalJson(req, MAX_DOYALIST_PROJECT_BODY_BYTES)
    } catch (error) {
      if (error instanceof OperationalBodyError) {
        return NextResponse.json({ error: '入力形式またはサイズを確認してください' }, { status: error.status })
      }
      throw error
    }
    const input = parseDoyalistProjectInput(body, 'create')
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 })

    // プラン上限チェック
    const limits = await getUserDoyalistLimits(userId)
    if (limits.maxProjects === 0) {
      return NextResponse.json(
        { error: '現在のプランではプロジェクトを作成できません' },
        { status: 403 }
      )
    }
    if (limits.maxProjects > 0) {
      const current = await prisma.doyalistProject.count({
        where: { userId, status: { not: 'archived' } },
      })
      if (current >= limits.maxProjects) {
        return NextResponse.json(
          { error: `プラン上限（${limits.maxProjects}件）に達しました。プランをアップグレードしてください` },
          { status: 403 }
        )
      }
    }

    const project = await prisma.doyalistProject.create({
      data: {
        userId,
        name: input.data.name!,
        description: input.data.description || null,
        industry: input.data.industry || null,
        region: input.data.region || null,
        targetSize: input.data.targetSize || null,
        keywords: input.data.keywords || null,
        status: 'active',
      },
    })

    return NextResponse.json({ success: true, project })
  } catch {
    console.error('[doyalist/projects][POST] failed')
    return NextResponse.json(
      { error: 'プロジェクトの作成に失敗しました' },
      { status: 500 }
    )
  }
}
