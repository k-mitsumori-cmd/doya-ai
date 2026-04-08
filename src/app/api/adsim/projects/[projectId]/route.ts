// ============================================
// GET/PATCH/DELETE /api/adsim/projects/[projectId]
// ============================================

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [project, user] = await Promise.all([
      prisma.adSimProject.findUnique({ where: { id: params.projectId } }),
      prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
    ])
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (project.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 当日の使用カウントも返す（プレビューUI で残り回数表示用）
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const allProjects = await prisma.adSimProject.findMany({
      where: { userId },
      select: { chartData: true },
    })
    let bannerToday = 0
    let chatToday = 0
    for (const p of allProjects) {
      const cd = p.chartData as any
      if (cd?.bannerGeneratedAt) {
        const ts = new Date(cd.bannerGeneratedAt)
        if (!isNaN(ts.getTime()) && ts >= startOfDay) bannerToday++
      }
      if (Array.isArray(cd?.chatLog)) {
        for (const e of cd.chatLog) {
          if (e?.timestamp) {
            const ts = new Date(e.timestamp)
            if (!isNaN(ts.getTime()) && ts >= startOfDay) chatToday++
          }
        }
      }
    }

    return NextResponse.json({
      project,
      userPlan: user?.plan || 'FREE',
      usage: { bannerToday, chatToday },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // userId などを上書きされないよう、編集可能フィールドのみ whitelist
    const body = await req.json()
    const allowed: Record<string, unknown> = {}
    if (typeof body.name === 'string') allowed.name = body.name
    if (typeof body.proposerName === 'string') allowed.proposerName = body.proposerName
    if (typeof body.proposerEmail === 'string') allowed.proposerEmail = body.proposerEmail
    if (typeof body.templateId === 'string') allowed.templateId = body.templateId

    const project = await prisma.adSimProject.update({
      where: { id: params.projectId },
      data: allowed,
    })
    return NextResponse.json({ project })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { projectId: string } }) {
  try {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const existing = await prisma.adSimProject.findUnique({ where: { id: params.projectId } })
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.adSimProject.delete({ where: { id: params.projectId } })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
