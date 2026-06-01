export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/doyaslide/slides/[id]/revert — バージョン一覧
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const slide = await prisma.doyaSlideSlide.findUnique({ where: { id: p.id }, include: { project: true } })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    const versions = await prisma.doyaSlideVersion.findMany({
      where: { slideId: slide.id },
      orderBy: { version: 'desc' },
    })
    return NextResponse.json({ versions })
  } catch (e) {
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

// POST /api/doyaslide/slides/[id]/revert — 指定バージョンへ巻き戻し
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const body = await req.json().catch(() => ({}))
    const version = Number(body.version)
    if (!version) return NextResponse.json({ error: 'versionは必須です' }, { status: 400 })

    const slide = await prisma.doyaSlideSlide.findUnique({ where: { id: p.id }, include: { project: true } })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    const v = await prisma.doyaSlideVersion.findFirst({ where: { slideId: slide.id, version } })
    if (!v) return NextResponse.json({ error: 'バージョンが見つかりません' }, { status: 404 })

    // 表示画像と生画像の両方を巻き戻す（以後のロゴ再合成/再生成が巻き戻し状態を基準にするように）
    const updated = await prisma.doyaSlideSlide.update({
      where: { id: slide.id },
      data: { imageUrl: v.imageUrl, rawImageUrl: v.rawImageUrl ?? slide.rawImageUrl },
    })
    return NextResponse.json({ slide: updated })
  } catch (e) {
    console.error('[doyaslide/revert]', e)
    return NextResponse.json({ error: '巻き戻しに失敗しました' }, { status: 500 })
  }
}
