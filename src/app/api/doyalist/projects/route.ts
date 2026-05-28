export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserDoyalistLimits } from '@/lib/doyalist/limits'

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
      where: { userId, status: { not: 'archived' } },
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

    return NextResponse.json({ success: true, projects: result })
  } catch (e: any) {
    console.error('[doyalist/projects][GET]', e)
    return NextResponse.json(
      { error: e?.message || 'プロジェクトの取得に失敗しました' },
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

    const body = await req.json()
    const { name, description, industry, region, targetSize, keywords } = body || {}

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'プロジェクト名は必須です' }, { status: 400 })
    }
    if (name.trim().length > 200) {
      return NextResponse.json({ error: 'プロジェクト名は200文字以内で入力してください' }, { status: 400 })
    }
    if (description && typeof description === 'string' && description.length > 5000) {
      return NextResponse.json({ error: '説明は5000文字以内で入力してください' }, { status: 400 })
    }

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
        name: name.trim(),
        description: description || null,
        industry: industry || null,
        region: region || null,
        targetSize: targetSize || null,
        keywords: keywords || null,
        status: 'active',
      },
    })

    return NextResponse.json({ success: true, project })
  } catch (e: any) {
    console.error('[doyalist/projects][POST]', e)
    return NextResponse.json(
      { error: e?.message || 'プロジェクトの作成に失敗しました' },
      { status: 500 }
    )
  }
}
