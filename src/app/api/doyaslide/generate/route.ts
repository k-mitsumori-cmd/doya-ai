export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { reserveMonthlySlides, releaseMonthlySlides, quotaExceededMessage } from '@/lib/doyaslide/limits'
import { composeSlideImage, type ComposeProject } from '@/lib/doyaslide/generate'

// 並列数を抑えて画像生成（レート制限・タイムアウト対策）
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

// POST /api/doyaslide/generate — 全スライドをフル画像生成 + ロゴ合成
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const { projectId, onlyPending } = body
    if (!projectId) return NextResponse.json({ error: 'projectIdは必須です' }, { status: 400 })

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: projectId, userId },
      include: { slides: { orderBy: { index: 'asc' } } },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (project.slides.length === 0) {
      return NextResponse.json({ error: '先に構成を作成してください' }, { status: 400 })
    }

    const targets = onlyPending ? project.slides.filter((s) => !s.imageUrl) : project.slides

    // 生成対象が無ければ何もしない（上限チェックも不要）
    if (targets.length === 0) {
      const slides = await prisma.doyaSlideSlide.findMany({ where: { projectId }, orderBy: { index: 'asc' } })
      return NextResponse.json({ slides, errorCount: 0, skipped: 0 })
    }

    // 残枠まで原子的に予約（並行でも上限超過しない=TOCTOU回避 / 残枠未満でも作れる分だけ生成）
    const { granted, limit } = await reserveMonthlySlides(userId, targets.length)
    if (granted <= 0) {
      return NextResponse.json({ error: quotaExceededMessage(limit) }, { status: 403 })
    }
    const slidesToGen = targets.slice(0, granted)
    const skipped = targets.length - slidesToGen.length

    await prisma.doyaSlideProject.update({ where: { id: projectId }, data: { status: 'generating' } })

    const cp: ComposeProject = project as any

    let errorCount = 0
    await mapWithConcurrency(slidesToGen, 3, async (slide) => {
      try {
        await prisma.doyaSlideSlide.update({ where: { id: slide.id }, data: { status: 'generating' } })
        const r = await composeSlideImage(userId, cp, slide)
        // 既に画像があるスライドの再生成は +1、初回は現バージョン(1)を採番
        const nextVersion = slide.imageUrl ? (slide.version || 1) + 1 : (slide.version || 1)
        await prisma.doyaSlideSlide.update({
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
      } catch (e: any) {
        errorCount++
        console.error('[doyaslide/generate] slide failed', slide.index, e?.message)
        await prisma.doyaSlideSlide.update({ where: { id: slide.id }, data: { status: 'error' } }).catch(() => {})
      }
    })

    // 生成に失敗した分の生成枚数クレジットを戻す
    await releaseMonthlySlides(userId, errorCount)

    await prisma.doyaSlideProject.update({
      where: { id: projectId },
      data: { status: errorCount >= slidesToGen.length ? 'error' : 'completed' },
    })

    const slides = await prisma.doyaSlideSlide.findMany({ where: { projectId }, orderBy: { index: 'asc' } })
    return NextResponse.json({ slides, errorCount, skipped, limit })
  } catch (e: any) {
    console.error('[doyaslide/generate]', e?.message)
    return NextResponse.json({ error: '生成に失敗しました' }, { status: 500 })
  }
}
