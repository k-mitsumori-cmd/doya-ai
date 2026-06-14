export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdIdentity, ownerWhere } from '@/lib/adbanner/access'
import { signedUrl } from '@/lib/adbanner/storage'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/adbanner/campaigns/[id] — 詳細（バナーに署名付きURLを付与）
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: false, error: '見つかりません' }, { status: 404 })

  const campaign = await prisma.adBannerCampaign.findFirst({
    where: { id: p.id, ...(where as any) }, // 所有者スコープ（IDOR防止）
    include: { banners: { orderBy: { createdAt: 'desc' } } },
  })
  if (!campaign) return NextResponse.json({ success: false, error: '見つかりません' }, { status: 404 })

  const banners = await Promise.all(
    campaign.banners.map(async (b) => ({
      id: b.id, size: b.size, variantLabel: b.variantLabel, model: b.model,
      feedback: b.feedback, generation: b.generation, createdAt: b.createdAt,
      imageUrl: await signedUrl(b.imagePath),
    }))
  )
  const logoUrl = campaign.logoPath ? await signedUrl(campaign.logoPath) : null

  return NextResponse.json({
    success: true,
    data: {
      id: campaign.id, name: campaign.name, sourceUrl: campaign.sourceUrl, serviceName: campaign.serviceName,
      appeal: campaign.appeal, brandColors: campaign.brandColors, media: campaign.media, logoUrl, banners,
    },
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// DELETE /api/adbanner/campaigns/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })
  const found = await prisma.adBannerCampaign.findFirst({ where: { id: p.id, ...(where as any) }, select: { id: true } })
  if (!found) return NextResponse.json({ success: false, error: '見つかりません' }, { status: 404 })
  await prisma.adBannerCampaign.delete({ where: { id: found.id } })
  return NextResponse.json({ success: true })
}
