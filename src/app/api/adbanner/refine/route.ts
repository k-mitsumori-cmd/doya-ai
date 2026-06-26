export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdIdentity, ownerWhere, remainingQuota } from '@/lib/adbanner/access'
import { generateBanners } from '@/lib/adbanner/generate'
import { downloadBuffer, signedUrl } from '@/lib/adbanner/storage'
import { type AdMedia, type LogoConfig } from '@/lib/adbanner/types'

const DEFAULT_LOGO_CFG: LogoConfig = { pos: 'bottom-right', maxWidthPct: 22, paddingPct: 4 }

// POST /api/adbanner/refine — フィードバックを反映して1案を再生成（改善世代+1）
export async function POST(req: NextRequest) {
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const base = await prisma.adBannerCreative.findFirst({
    where: { id: body.creativeId, campaign: where as any },
    include: { campaign: true },
  })
  if (!base) return NextResponse.json({ success: false, error: 'バナーが見つかりません' }, { status: 404 })

  const quota = await remainingQuota(id)
  if (quota.remaining <= 0) {
    return NextResponse.json({ success: false, error: `本日の生成上限（${quota.limit}枚）に達しました。プロプランで上限が上がります。初月無料でお試しいただけます。`, code: 'LIMIT' }, { status: 402 })
  }

  const advice = (base.feedback as any)?.advice as string | undefined
  const appeal = [base.campaign.appeal, advice ? `改善指示: ${advice}` : ''].filter(Boolean).join(' / ')

  let logo: Buffer | null = null
  if (base.campaign.logoPath) logo = await downloadBuffer(base.campaign.logoPath)

  try {
    const creatives = await generateBanners({
      campaignId: base.campaignId,
      serviceName: base.campaign.serviceName || base.campaign.name,
      appeal,
      brandColors: (base.campaign.brandColors as string[]) || undefined,
      media: (base.campaign.media as AdMedia) || 'meta',
      sizes: [base.size],
      variants: 1,
      logo,
      logoCfg: logo ? DEFAULT_LOGO_CFG : undefined,
    })
    if (!creatives.length) return NextResponse.json({ success: false, error: '再生成に失敗しました' }, { status: 500 })
    const c = creatives[0]
    const created = await prisma.adBannerCreative.create({
      data: { campaignId: base.campaignId, imagePath: c.imagePath, size: c.size, prompt: c.prompt, variantLabel: c.variantLabel, model: c.model, generation: base.generation + 1, parentId: base.id },
    })
    return NextResponse.json({ success: true, data: { id: created.id, size: created.size, variantLabel: created.variantLabel, model: created.model, feedback: null, generation: created.generation, createdAt: created.createdAt, imageUrl: await signedUrl(created.imagePath) } })
  } catch (e: any) {
    console.error('[adbanner/refine]', e?.message)
    return NextResponse.json({ success: false, error: '再生成に失敗しました' }, { status: 500 })
  }
}
