export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/doyaslide/access'
import { compositeLogo, fetchBuffer } from '@/lib/doyaslide/logo'
import { uploadComposedImage } from '@/lib/doyaslide/storage'
import type { LogoPosition, LogoSize } from '@/lib/doyaslide/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// PUT /api/doyaslide/projects/[id]/logo-config — ロゴ位置/サイズ変更 → 全スライド再合成
// 注意: logoUrl はここでは受け付けない（SSRF防止。ロゴ設定は assets/logo アップロード経由のみ）
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const project = await prisma.doyaSlideProject.findFirst({ where: { id: p.id, userId } })
    if (!project) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const data: any = {}
    if (body.logoPosition !== undefined) data.logoPosition = body.logoPosition
    if (body.logoSize !== undefined) data.logoSize = body.logoSize
    if (body.logoBackingChip !== undefined) data.logoBackingChip = !!body.logoBackingChip

    const updated = await prisma.doyaSlideProject.update({ where: { id: p.id }, data })

    // 生画像があるスライドはロゴだけ再合成（ロゴは一度だけ取得して並列処理）
    if (updated.logoUrl) {
      const slides = await prisma.doyaSlideSlide.findMany({
        where: { projectId: p.id, rawImageUrl: { not: null } },
      })
      if (slides.length > 0) {
        try {
          const logoBuf = await fetchBuffer(updated.logoUrl)
          const opts = {
            position: (updated.logoPosition as LogoPosition) || 'top-right',
            size: (updated.logoSize as LogoSize) || 'M',
            backingChip: updated.logoBackingChip,
          }
          await Promise.all(
            slides.map(async (s) => {
              if (!s.rawImageUrl) return
              try {
                const baseBuf = await fetchBuffer(s.rawImageUrl)
                const composed = await compositeLogo(baseBuf, logoBuf, opts)
                const imageUrl = await uploadComposedImage(userId, p.id, composed)
                await prisma.doyaSlideSlide.update({ where: { id: s.id }, data: { imageUrl } })
              } catch (e) {
                console.error('[doyaslide/logo-config] recomposite failed', s.index, (e as any)?.message)
              }
            })
          )
        } catch (e) {
          console.error('[doyaslide/logo-config] logo fetch failed', (e as any)?.message)
        }
      }
    }

    const result = await prisma.doyaSlideProject.findFirst({
      where: { id: p.id },
      include: { slides: { orderBy: { index: 'asc' } } },
    })
    return NextResponse.json({ project: result })
  } catch (e) {
    console.error('[doyaslide/logo-config]', e)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
