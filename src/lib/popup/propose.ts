// ============================================
// ドヤポップアップ: 提案の作成（POST /api/popup/sites とエージェントの道具 popup.proposeDrafts の正本）
// ============================================
// ⚠️ 利用枠の判定はクロール・LLM の前（createSiteWithinQuota）。失敗したらサイト行を消して枠を戻す。
// ⚠️ 作るのは下書きだけ。公開（外部サイトに出る）は publish 側で、エージェントからは承認必須。
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { parseSourceUrl, readSite, SiteUnreadableError } from '@/lib/asklink/site'
import { generateBannerCopy, generateLinks } from '@/lib/asklink/generate'
import type { QuotaResult } from '@/lib/plan-limit'
import { createSiteWithinQuota } from './access'
import { buildProposals } from './proposals'
import { parseDomain } from './schema'
import { sumTotals } from './stats'
import { toSiteDto, type SiteDto } from './dto'

export const MANUAL_MIN = 20
export const MANUAL_MAX = 3000

export type ProposeResult =
  | { ok: true; site: SiteDto; popups: { id: string; name: string; kind: string }[] }
  | { ok: false; status: 400; error: string }
  | { ok: false; status: 429; error: string; quota: QuotaResult }
  | { ok: false; status: 422; error: string; code: 'WEBSITE_UNREADABLE' }
  | { ok: false; status: 500; error: string }

export async function proposeForUser(userId: string, input: { url: unknown; manualText?: unknown }): Promise<ProposeResult> {
  const sourceUrl = parseSourceUrl(input.url)
  const domain = sourceUrl ? parseDomain(sourceUrl) : null
  if (!sourceUrl || !domain) return { ok: false, status: 400, error: 'サイトのURLを正しく入力してください。' }
  const manualText = typeof input.manualText === 'string' ? input.manualText.trim() : ''
  if (manualText && (manualText.length < MANUAL_MIN || manualText.length > MANUAL_MAX)) {
    return { ok: false, status: 400, error: `サービスの説明は${MANUAL_MIN}〜${MANUAL_MAX}字で入力してください。` }
  }

  const created = await createSiteWithinQuota(userId, {
    name: domain,
    sourceUrl,
    domain,
    source: manualText ? 'manual' : 'site',
    site: {},
    allowedUrls: [],
  })
  if (!created.ok) return { ok: false, status: 429, error: created.quota.reason || '利用の上限に達しました。', quota: created.quota }
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
      const popups = await tx.popup.findMany({ where: { siteId, userId }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, kind: true } })
      return { site: s, popups }
    })
    void recordServiceUsage({
      userId,
      serviceId: 'popup',
      action: 'ポップアップを提案',
      summary: `${site.name} / ${sourceUrl}`,
      count: proposals.length,
    })
    return { ok: true, site: toSiteDto(saved.site, { liveCount: 0, totals: sumTotals([]) }), popups: saved.popups }
  } catch (e) {
    // 結果を出せなかったサイトは枠から外す（読み取れないサイトで枠を失わせない）。案はまだ無い
    await prisma.popupSite.delete({ where: { id: siteId } }).catch(() => {})
    if (e instanceof SiteUnreadableError) return { ok: false, status: 422, error: e.message, code: 'WEBSITE_UNREADABLE' }
    console.error('[popup] create failed', (e as Error)?.name)
    return { ok: false, status: 500, error: '提案の作成に失敗しました。時間をおいてもう一度お試しください。' }
  }
}
