export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { generateSlideImage, type StoredSlide } from '@/lib/shodan/slide-image'
import { signedUrl } from '@/lib/shodan/storage'
import type { ProposalSlide } from '@/lib/shodan/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/shodan/preparations/[id]/slides/regenerate — 1スライドを修正指示つきで再生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const index = Number(body.index)
  const instruction = (body.instruction as string)?.trim()?.slice(0, 500) || undefined

  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const slides = (prep.slidesJson as unknown as ProposalSlide[] | null) || []
  const images = ((prep.slideImages as unknown as StoredSlide[] | null) || []).slice()
  // slideImages は slidesJson と整列保持。索引は両配列の範囲内（=スライド画像が存在する枠）に限定。
  if (!Number.isInteger(index) || index < 0 || index >= slides.length || index >= images.length) {
    return NextResponse.json({ error: '不正なスライドです' }, { status: 400 })
  }

  try {
    const img = await generateSlideImage(sctx.userId, prep.id, slides[index], index, instruction)
    images[index] = img
    await prisma.shodanPreparation.update({ where: { id: prep.id }, data: { slideImages: images as any } })
    return NextResponse.json({ success: true, data: { index, image: { title: img.title, role: img.role, imageUrl: await signedUrl(img.imagePath) } } })
  } catch (e: any) {
    console.error('[shodan/slides/regenerate]', e?.message)
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }
}
