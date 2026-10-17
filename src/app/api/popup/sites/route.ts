export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { parseSourceUrl, readSite, SiteUnreadableError } from '@/lib/asklink/site'
import { generateBannerCopy, generateLinks } from '@/lib/asklink/generate'
import { createSiteWithinQuota, getPopupUserId } from '@/lib/popup/access'
import { buildProposals } from '@/lib/popup/proposals'
import { parseDomain } from '@/lib/popup/schema'
import { sumTotals, totalsByPopup } from '@/lib/popup/stats'
import { toSiteDto } from '@/lib/popup/dto'

const MANUAL_MIN = 20
const MANUAL_MAX = 3000

/**
 * 提案の作成: URL（と、読み取れないサイト向けの手入力説明）→ 読み取り → 質問リンク → 2〜3案を下書きで作る。
 * ⚠️ 利用枠の判定はクロール・LLM の前（createSiteWithinQuota）。失敗したらサイト行を消して枠を戻す。
 */
export async function POST(req: NextRequest) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sourceUrl = parseSourceUrl(body?.url)
  const domain = sourceUrl ? parseDomain(sourceUrl) : null
  if (!sourceUrl || !domain) return NextResponse.json({ error: 'サイトのURLを正しく入力してください。' }, { status: 400 })
  const manualText = typeof body?.manualText === 'string' ? body.manualText.trim() : ''
  if (manualText && (manualText.length < MANUAL_MIN || manualText.length > MANUAL_MAX)) {
    return NextResponse.json({ error: `サービスの説明は${MANUAL_MIN}〜${MANUAL_MAX}字で入力してください。` }, { status: 400 })
  }

  const created = await createSiteWithinQuota(userId, {
    name: domain,
    sourceUrl,
    domain,
    source: manualText ? 'manual' : 'site',
    site: {},
    allowedUrls: [],
  })
  if (!created.ok) {
    return NextResponse.json(
      { error: created.quota.reason, limitReached: true, used: created.quota.used, limit: created.quota.limit, upgradeUrl: '/popup/pricing' },
      { status: 429 }
    )
  }
  const siteId = created.siteId

  try {
    const { site, audience, allowedUrls } = await readSite(sourceUrl, manualText || undefined)
    const links = await generateLinks(audience, site, allowedUrls)
    const copy = await generateBannerCopy(audience, site, links[0])
    const proposals = buildProposals(site, audience, links, copy)
    const saved = await prisma.$transaction(async (tx) => {
      const s = await tx.popupSite.update({
        where: { id: siteId },
        data: { name: site.name.slice(0, 80) || domain, site: site as any, allowedUrls, audience },
      })
      await tx.popup.createMany({
        data: proposals.map((p, i) => ({
          siteId,
          userId,
          name: p.name,
          kind: p.kind,
          status: 'draft',
          sortOrder: i,
          creative: p.creative as any,
          trigger: p.trigger as any,
          targeting: p.targeting as any,
          frequency: p.frequency as any,
          reason: p.reason,
        })),
      })
      return s
    })
    void recordServiceUsage({
      userId,
      serviceId: 'popup',
      action: 'ポップアップを提案',
      summary: `${site.name} / ${sourceUrl}`,
      count: proposals.length,
    })
    return NextResponse.json({ site: toSiteDto(saved, { liveCount: 0, totals: sumTotals([]) }) })
  } catch (e) {
    // 結果を出せなかったサイトは枠から外す（読み取れないサイトで枠を失わせない）。案はまだ無い
    await prisma.popupSite.delete({ where: { id: siteId } }).catch(() => {})
    if (e instanceof SiteUnreadableError) {
      return NextResponse.json({ error: e.message, code: 'WEBSITE_UNREADABLE', canUseManualInput: true }, { status: 422 })
    }
    console.error('[popup] create failed', (e as Error)?.name)
    return NextResponse.json({ error: '提案の作成に失敗しました。時間をおいてもう一度お試しください。' }, { status: 500 })
  }
}

/** サイト一覧（自分の分だけ）と直近30日の集計 */
export async function GET() {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const sites = await prisma.popupSite.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { popups: { select: { id: true, status: true } } },
  })
  const totals = await totalsByPopup(sites.flatMap((s) => s.popups.map((p) => p.id)), 30)
  return NextResponse.json({
    sites: sites.map((s) =>
      toSiteDto(s, {
        liveCount: s.popups.filter((p) => p.status === 'live').length,
        totals: sumTotals(s.popups.map((p) => totals.get(p.id)).filter((t): t is NonNullable<typeof t> => !!t)),
      })
    ),
  })
}
