export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededMessage } from '@/lib/doyaslide/limits'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/doyaslide/slides/[id]/regenerate — 単一スライド再生成
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const slide = await prisma.doyaSlideSlide.findUnique({
      where: { id: p.id },
      include: { project: true },
    })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    // 再生成も1枚分の生成クレジットを原子的に消費（並行でも上限超過しない）
    const { granted, limit } = await reserveMonthlySlides(userId, 1)
    if (granted < 1) {
      return NextResponse.json({ error: quotaExceededMessage(limit) }, { status: 403 })
    }

    await prisma.doyaSlideSlide.update({ where: { id: slide.id }, data: { status: 'generating' } })
    let r
    try {
      r = await composeSlideImage(userId, slide.project as ComposeProject, slide)
    } catch (e) {
      // 生成失敗ならクレジットを戻す
      await releaseMonthlySlides(userId, 1)
      await prisma.doyaSlideSlide.update({ where: { id: slide.id }, data: { status: 'error' } }).catch(() => {})
      throw e
    }
    const nextVersion = (slide.version || 1) + 1

    const updated = await prisma.doyaSlideSlide.update({
      where: { id: slide.id },
      data: { rawImageUrl: r.rawImageUrl, imageUrl: r.imageUrl, version: nextVersion, status: 'done' },
    })
    await prisma.doyaSlideVersion.create({
      data: {
        slideId: slide.id,
        version: nextVersion,
        imageUrl: r.imageUrl,
        rawImageUrl: r.rawImageUrl,
        prompt: slide.visualPrompt,
      },
    })

    return NextResponse.json({ slide: updated })
  } catch (e: any) {
    console.error('[doyaslide/regenerate]', e?.message)
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }
}
