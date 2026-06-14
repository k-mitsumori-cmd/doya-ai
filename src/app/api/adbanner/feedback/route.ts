export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdIdentity, ownerWhere } from '@/lib/adbanner/access'
import { generateFeedback } from '@/lib/adbanner/feedback'
import type { AdMedia } from '@/lib/adbanner/types'

// POST /api/adbanner/feedback — 指定バナーにAI自動フィードバック
export async function POST(req: NextRequest) {
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: false, error: '権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const creative = await prisma.adBannerCreative.findFirst({
    where: { id: body.creativeId, campaign: where as any },
    include: { campaign: true },
  })
  if (!creative) return NextResponse.json({ success: false, error: 'バナーが見つかりません' }, { status: 404 })

  try {
    const fb = await generateFeedback({
      serviceName: creative.campaign.serviceName || creative.campaign.name,
      appeal: creative.campaign.appeal || undefined,
      media: (creative.campaign.media as AdMedia) || 'meta',
      size: creative.size,
      variantLabel: creative.variantLabel || undefined,
      prompt: creative.prompt,
      brandColors: (creative.campaign.brandColors as string[]) || undefined,
    })
    await prisma.adBannerCreative.update({ where: { id: creative.id }, data: { feedback: fb as any } })
    return NextResponse.json({ success: true, data: fb })
  } catch (e: any) {
    console.error('[adbanner/feedback]', e?.message)
    return NextResponse.json({ success: false, error: 'フィードバックの生成に失敗しました' }, { status: 500 })
  }
}
