export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// gpt-image-2 high・1536x1024 は単発で約100秒＋専用バケットへの再アップロード。120sでは強制終了されるため余裕をもって300sに。
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { saveSlideImages, SlideImageConflict } from '@/lib/shodan/save-slide-images'
import { getShodanContext, orgSlugFrom } from '@/lib/shodan/access'
import { generateSlideImage, type StoredSlide } from '@/lib/shodan/slide-image'
import { signedUrl } from '@/lib/shodan/storage'
import type { ProposalSlide } from '@/lib/shodan/types'
import { isPaidPlan } from '@/lib/unified-plan'

type Ctx = { params: Promise<{ id: string }> }

// POST /api/shodan/preparations/[id]/slides/regenerate — 1スライドを修正指示つきで再生成
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getShodanContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  // スライド資料の生成・再生成はプロプラン限定
  const user = await prisma.user.findUnique({ where: { id: sctx.userId }, select: { plan: true } })
  if (!isPaidPlan(user?.plan)) {
    return NextResponse.json({ error: 'スライド資料の生成はプロプランの機能です。', code: 'PLAN' }, { status: 402 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.index !== 'number' || !Number.isSafeInteger(body.index)
    || (body.instruction != null && typeof body.instruction !== 'string')) {
    return NextResponse.json({ error: 'スライドの指定または修正指示を確認してください' }, { status: 400 })
  }
  const index = body.index
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim().slice(0, 500) || undefined : undefined

  const prep = await prisma.shodanPreparation.findFirst({ where: { id: p.id, organizationId: sctx.organizationId } })
  if (!prep) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  const slides = (prep.slidesJson as unknown as ProposalSlide[] | null) || []
  const images = ((prep.slideImages as unknown as StoredSlide[] | null) || []).slice()
  // slideImages は slidesJson と整列保持。索引は両配列の範囲内（=スライド画像が存在する枠）に限定。
  if (!Number.isInteger(index) || index < 0 || index >= slides.length || index >= images.length) {
    return NextResponse.json({ error: '不正なスライドです' }, { status: 400 })
  }

  const profile = await prisma.shodanCompanyProfile.findUnique({ where: { organizationId: sctx.organizationId } })
  const brand = {
    brandColors: (profile?.brandColors as string[] | null) || undefined,
    logoUrl: profile?.logoPath ? await signedUrl(profile.logoPath) : null,
  }

  try {
    const img = await generateSlideImage(sctx.userId, prep.id, slides[index], index, { extra: instruction, brand })
    await saveSlideImages(prep.id, sctx.organizationId, prep.slidesJson, images, [{ index, image: img }])
    return NextResponse.json({ success: true, data: { index, image: { title: img.title, role: img.role, imageUrl: await signedUrl(img.imagePath) } } })
  } catch (e: any) {
    if (e instanceof SlideImageConflict) return NextResponse.json({ error: e.message }, { status: 409 })
    console.error('[shodan/slides/regenerate]', e?.message)
    return NextResponse.json({ error: '再生成に失敗しました' }, { status: 500 })
  }
}
