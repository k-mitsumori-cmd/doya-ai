export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { compositeLogo, fetchBuffer } from '@/lib/doyaslide/logo'
import { uploadComposedImage } from '@/lib/doyaslide/storage'
import type { LogoPosition, LogoSize } from '@/lib/doyaslide/types'

type Ctx = { params: Promise<{ id: string }> }
const LOGO_POSITIONS = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'] as const
const LOGO_SIZES = ['S', 'M', 'L'] as const

// PUT /api/doyaslide/projects/[id]/logo-config — ロゴ位置/サイズ変更 → 全スライド再合成
// 注意: logoUrl はここでは受け付けない（SSRF防止。ロゴ設定は assets/logo アップロード経由のみ）
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = await ctx.params

    const project = await prisma.doyaSlideProject.findFirst({
      where: { id: p.id, userId },
      include: { _count: { select: { slides: { where: { status: 'generating' } } } } },
    })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (['structuring', 'generating'].includes(project.status) || project._count.slides > 0) {
      return NextResponse.json({ error: '資料を処理中のためロゴ設定を変更できません。完了後にお試しください。' }, { status: 409 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'ロゴ設定が正しくありません' }, { status: 400 })
    }
    const data: { logoPosition?: string; logoSize?: string; logoBackingChip?: boolean } = {}
    if (body.logoPosition !== undefined) {
      if (!LOGO_POSITIONS.includes(body.logoPosition)) return NextResponse.json({ error: 'ロゴの位置が正しくありません' }, { status: 400 })
      data.logoPosition = body.logoPosition
    }
    if (body.logoSize !== undefined) {
      if (!LOGO_SIZES.includes(body.logoSize)) return NextResponse.json({ error: 'ロゴのサイズが正しくありません' }, { status: 400 })
      data.logoSize = body.logoSize
    }
    if (body.logoBackingChip !== undefined) {
      if (typeof body.logoBackingChip !== 'boolean') return NextResponse.json({ error: '背景チップの設定が正しくありません' }, { status: 400 })
      data.logoBackingChip = body.logoBackingChip
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: '変更する設定がありません' }, { status: 400 })

    const slides = project.logoUrl ? await prisma.doyaSlideSlide.findMany({
      where: { projectId: p.id, rawImageUrl: { not: null } },
    }) : []
    let logoBuf: Buffer | null = null
    if (project.logoUrl && slides.length > 0) {
      try {
        logoBuf = await fetchBuffer(project.logoUrl)
      } catch {
        return NextResponse.json({ error: 'ロゴ画像を読み込めませんでした。設定は変更されていません。' }, { status: 503 })
      }
    }

    const updated = await prisma.doyaSlideProject.update({
      where: {
        id: p.id, userId, updatedAt: project.updatedAt,
        status: { notIn: ['structuring', 'generating'] },
        slides: { none: { status: 'generating' } },
      },
      data,
    })

    // 生画像があるスライドはロゴだけ再合成（ロゴは一度だけ取得して並列処理）
    const opts = {
      position: (updated.logoPosition as LogoPosition) || 'top-right',
      size: (updated.logoSize as LogoSize) || 'M',
      backingChip: updated.logoBackingChip,
    }
    const outcomes = logoBuf ? await Promise.allSettled(slides.map(async (s) => {
      if (!s.rawImageUrl) return
      const baseBuf = await fetchBuffer(s.rawImageUrl)
      const composed = await compositeLogo(baseBuf, logoBuf, opts)
      const imageUrl = await uploadComposedImage(userId, p.id, composed)
      // Compare both the slide and the saved branding after awaited image work.
      await prisma.doyaSlideSlide.update({
        where: {
          id: s.id, projectId: p.id, version: s.version,
          imageUrl: s.imageUrl, rawImageUrl: s.rawImageUrl, status: s.status,
          project: {
            userId, updatedAt: updated.updatedAt, logoUrl: updated.logoUrl,
            status: { notIn: ['structuring', 'generating'] },
          },
        },
        data: { imageUrl },
      })
    })) : []
    const failedSlides = outcomes.filter((outcome) => outcome.status === 'rejected').length

    const result = await prisma.doyaSlideProject.findFirst({
      where: { id: p.id, userId },
      include: { slides: { orderBy: { index: 'asc' } } },
    })
    if (!result) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (result.updatedAt.getTime() !== updated.updatedAt.getTime()) {
      return NextResponse.json({ error: '資料の状態が変わりました。再読み込みしてロゴの反映状況をご確認ください。' }, { status: 409 })
    }
    if (failedSlides > 0) {
      console.error('[doyaslide/logo-config] recomposite failed', { failedSlides })
      return NextResponse.json({
        error: `ロゴ設定は保存されましたが、${failedSlides}枚のスライドに反映できませんでした。再度設定を保存してください。`,
        project: result,
        failedSlides,
      }, { status: 503 })
    }
    return NextResponse.json({ project: result })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2025') {
      return NextResponse.json({ error: '資料の状態が変わりました。再読み込みしてお試しください。' }, { status: 409 })
    }
    console.error('[doyaslide/logo-config]')
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
