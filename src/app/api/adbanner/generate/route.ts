export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdIdentity, ownerWhere, remainingQuota } from '@/lib/adbanner/access'
import { generateBanners } from '@/lib/adbanner/generate'
import { downloadBuffer, signedUrl } from '@/lib/adbanner/storage'
import { BANNER_SIZES, type AdMedia, type LogoConfig } from '@/lib/adbanner/types'

const DEFAULT_LOGO_CFG: LogoConfig = { pos: 'bottom-right', maxWidthPct: 22, paddingPct: 4 }

// POST /api/adbanner/generate — N案を一括量産
export async function POST(req: NextRequest) {
  const id = await getAdIdentity(req)
  const where = ownerWhere(id)
  if (!where) return NextResponse.json({ success: false, error: '先にキャンペーンを作成してください' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const campaign = await prisma.adBannerCampaign.findFirst({ where: { id: body.campaignId, ...(where as any) } })
  if (!campaign) return NextResponse.json({ success: false, error: 'キャンペーンが見つかりません' }, { status: 404 })

  // 上限チェック
  const quota = await remainingQuota(id)
  if (quota.remaining <= 0) {
    return NextResponse.json({ success: false, error: `本日の生成上限（${quota.limit}枚）に達しました。プロプランで上限が上がります。初月無料でお試しいただけます。`, code: 'LIMIT' }, { status: 402 })
  }

  // サイズ（無料/ゲストは 1080x1080 固定、PROは複数可）
  const validKeys = new Set(BANNER_SIZES.map((s) => s.key))
  let sizes: string[] = Array.isArray(body.sizes) ? body.sizes.filter((s: any) => validKeys.has(s)) : []
  if (id.plan !== 'PRO' || sizes.length === 0) sizes = ['1080x1080']

  // 枚数（上限・残数で頭打ち）
  const reqVariants = Number(body.variants) || 4
  const variants = Math.max(1, Math.min(reqVariants, id.plan === 'PRO' ? 8 : 4, quota.remaining))

  // ロゴ
  let logo: Buffer | null = null
  if (campaign.logoPath) logo = await downloadBuffer(campaign.logoPath)
  const logoCfg = logo ? { ...DEFAULT_LOGO_CFG, ...(body.logoCfg || {}) } : undefined

  try {
    const creatives = await generateBanners({
      campaignId: campaign.id,
      serviceName: campaign.serviceName || campaign.name,
      description: undefined,
      appeal: campaign.appeal || undefined,
      brandColors: (campaign.brandColors as string[]) || undefined,
      media: (campaign.media as AdMedia) || 'meta',
      sizes,
      variants,
      logo,
      logoCfg,
    })
    if (!creatives.length) return NextResponse.json({ success: false, error: '生成に失敗しました。時間をおいて再度お試しください。' }, { status: 500 })

    const created = await prisma.$transaction(
      creatives.map((c) => prisma.adBannerCreative.create({
        data: { campaignId: campaign.id, imagePath: c.imagePath, size: c.size, prompt: c.prompt, variantLabel: c.variantLabel, model: c.model },
      }))
    )
    const data = await Promise.all(created.map(async (b) => ({
      id: b.id, size: b.size, variantLabel: b.variantLabel, model: b.model, feedback: null, generation: b.generation, createdAt: b.createdAt,
      imageUrl: await signedUrl(b.imagePath),
    })))
    return NextResponse.json({ success: true, data })
  } catch (e: any) {
    console.error('[adbanner/generate]', e?.message)
    return NextResponse.json({ success: false, error: 'バナー生成に失敗しました' }, { status: 500 })
  }
}
