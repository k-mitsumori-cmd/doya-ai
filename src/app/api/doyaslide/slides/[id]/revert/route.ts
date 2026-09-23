export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'

type Ctx = { params: Promise<{ id: string }> }

// GET /api/doyaslide/slides/[id]/revert — バージョン一覧
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

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
    const p = await ctx.params

    const body = await req.json().catch(() => ({}))
    const version = Number(body.version)
    if (!Number.isSafeInteger(version) || version < 1) return NextResponse.json({ error: '有効なバージョンを指定してください' }, { status: 400 })

    const slide = await prisma.doyaSlideSlide.findUnique({ where: { id: p.id }, include: { project: true } })
    if (!slide || slide.project.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    const v = await prisma.doyaSlideVersion.findFirst({ where: { slideId: slide.id, version } })
    if (!v) return NextResponse.json({ error: 'バージョンが見つかりません' }, { status: 404 })

    if (slide.status === 'generating') {
      return NextResponse.json({ error: '画像の生成中は履歴を復元できません。完了後にお試しください。' }, { status: 409 })
    }
    if (!v.prompt?.trim()) {
      return NextResponse.json({ error: 'この履歴には生成指示が保存されていないため復元できません。' }, { status: 409 })
    }

    // 画像と生成指示を同時に復元。versionは履歴追加の連番なので巻き戻さない。
    // 生画像がない旧履歴に、別バージョンの生画像を混ぜない。
    const updated = await prisma.doyaSlideSlide.update({
      where: { id: slide.id, status: { not: 'generating' }, project: { userId } },
      data: { imageUrl: v.imageUrl, rawImageUrl: v.rawImageUrl ?? null, visualPrompt: v.prompt, basePrompt: null, status: 'done', model: null },
    })
    return NextResponse.json({ slide: updated })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: 'スライドの状態が変更されました。再読み込みしてお試しください。' }, { status: 409 })
    }
    console.error('[doyaslide/revert]', e)
    return NextResponse.json({ error: '巻き戻しに失敗しました' }, { status: 500 })
  }
}
