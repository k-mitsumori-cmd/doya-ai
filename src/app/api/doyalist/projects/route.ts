export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserDoyalistLimits } from '@/lib/doyalist/limits'
import { OperationalBodyError, readOperationalJson } from '@/lib/operational-json'
import { MAX_DOYALIST_PROJECT_BODY_BYTES, parseDoyalistProjectInput } from '@/lib/doyalist/project-input'
import { streamDoyalistJsonIterable } from '@/lib/doyalist/stream-json'

const PROJECT_PAGE_SIZE = 200

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

    const query = {
      where: {
        userId,
        status: { not: 'archived' },
        // 失敗した0社のプロジェクトも、枠を消費するため履歴から整理可能にする。
      },
      include: {
        _count: { select: { companies: true, approaches: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: PROJECT_PAGE_SIZE,
    } satisfies Prisma.DoyalistProjectFindManyArgs
    // The first DB read must finish before sending 200, so failures keep the JSON error contract.
    const firstPage = await prisma.doyalistProject.findMany(query)

    async function* projects() {
      let page = firstPage
      while (page.length > 0) {
        for (const p of page) {
          yield {
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
          }
        }
        if (page.length < PROJECT_PAGE_SIZE) break
        page = await prisma.doyalistProject.findMany({
          ...query,
          cursor: { id: page[page.length - 1].id },
          skip: 1,
        })
      }
    }

    return streamDoyalistJsonIterable({ success: true }, 'projects', projects())
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
