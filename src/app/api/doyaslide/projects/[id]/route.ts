export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/doyaslide/projects/[id] — プロジェクト詳細（スライド込み）
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: p.id, userId },
      include: {
        slides: { orderBy: { index: 'asc' } },
      },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    return NextResponse.json({ project })
  } catch (e) {
    console.error('[doyaslide/projects/[id] GET]', e)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// PATCH — タイトル等の更新
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const existing = await prisma.doyaSlideProject.findFirst({ where: { id: p.id, userId } })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const data: any = {}
    for (const k of ['title', 'themeColor', 'stylePreset', 'aspectRatio', 'customBrief']) {
      if (body[k] !== undefined) data[k] = body[k]
    }
    const project = await prisma.doyaSlideProject.update({ where: { id: p.id }, data })
    return NextResponse.json({ project })
  } catch (e) {
    console.error('[doyaslide/projects/[id] PATCH]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}

// DELETE — プロジェクト削除（スライド等はカスケード）
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const existing = await prisma.doyaSlideProject.findFirst({ where: { id: p.id, userId } })
    if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    await prisma.doyaSlideProject.delete({ where: { id: p.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[doyaslide/projects/[id] DELETE]', e)
    return NextResponse.json({ error: '削除に失敗しました' }, { status: 500 })
  }
}
