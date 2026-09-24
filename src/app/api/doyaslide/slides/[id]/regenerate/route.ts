export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededPayload } from '@/lib/doyaslide/limits'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/doyaslide/slides/[id]/regenerate — 単一スライド再生成
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const slide = await prisma.doyaSlideSlide.findUnique({
      where: { id: p.id },
      include: { project: true },
    })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }
    if (slide.status === 'generating') {
      return NextResponse.json({ error: '画像の生成中です。完了後にお試しください。' }, { status: 409 })
    }

    // 再生成も1枚分の生成クレジットを原子的に消費（並行でも上限超過しない）
    const { granted, limit, reservedMonth } = await reserveMonthlySlides(userId, 1)
    if (granted < 1) {
      return NextResponse.json(quotaExceededPayload(limit), { status: 403 })
    }

    let saved = false
    let markedGenerating = false
    try {
      await prisma.doyaSlideSlide.update({
        where: { id: slide.id, version: slide.version, imageUrl: slide.imageUrl, visualPrompt: slide.visualPrompt, status: slide.status },
        data: { status: 'generating' },
      })
      markedGenerating = true
      const r = await composeSlideImage(userId, slide.project as ComposeProject, slide)
      const nextVersion = (slide.version || 1) + 1

      // 別の再生成・履歴復元が先に保存した場合は古い内容で上書きしない。
      const [updated] = await prisma.$transaction([
        prisma.doyaSlideSlide.update({
          where: { id: slide.id, version: slide.version, imageUrl: slide.imageUrl, visualPrompt: slide.visualPrompt, status: 'generating' },
          data: { rawImageUrl: r.rawImageUrl, imageUrl: r.imageUrl, version: nextVersion, status: 'done', model: r.model },
        }),
        prisma.doyaSlideVersion.create({
          data: {
            slideId: slide.id,
            version: nextVersion,
            imageUrl: r.imageUrl,
            rawImageUrl: r.rawImageUrl,
            prompt: slide.visualPrompt,
          },
        }),
      ])
      saved = true
      return NextResponse.json({ slide: updated })
    } catch (e) {
      if (!saved) await releaseMonthlySlides(userId, 1, reservedMonth)
      if (markedGenerating) {
        await prisma.doyaSlideSlide.updateMany({
          where: { id: slide.id, version: slide.version, imageUrl: slide.imageUrl, visualPrompt: slide.visualPrompt, status: 'generating' },
          data: { status: slide.imageUrl ? 'done' : 'error' },
        }).catch(() => {})
      }
      if ((e as { code?: string })?.code === 'P2025') {
        return NextResponse.json({ error: 'スライドが変更されました。再読み込みしてお試しください。' }, { status: 409 })
      }
      throw e
    }
  } catch (e: any) {
    console.error('[doyaslide/regenerate]', e?.message)
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }
}
