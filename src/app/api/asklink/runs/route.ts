export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { createRunWithinQuota, getAskLinkUserId } from '@/lib/asklink/access'
import { parseSourceUrl, readSite, SiteUnreadableError } from '@/lib/asklink/site'
import { generateBannerCopy, generateLinks } from '@/lib/asklink/generate'
import { RUN_SELECT, toRunDto } from '@/lib/asklink/dto'

const MANUAL_MIN = 20
const MANUAL_MAX = 3000

/**
 * 作成: URL（と、読み取れないサイト向けの手入力説明）→ 抽出 → 質問リンク2本＋バナー文言。
 * バナー画像は時間がかかるので別API（/runs/[id]/banners/[kind]）で1枚ずつ作る。
 */
export async function POST(req: NextRequest) {
  const userId = await getAskLinkUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sourceUrl = parseSourceUrl(body?.url)
  if (!sourceUrl) return NextResponse.json({ error: 'サイトのURLを正しく入力してください。' }, { status: 400 })
  const manualText = typeof body?.manualText === 'string' ? body.manualText.trim() : ''
  if (manualText && (manualText.length < MANUAL_MIN || manualText.length > MANUAL_MAX)) {
    return NextResponse.json({ error: `サービスの説明は${MANUAL_MIN}〜${MANUAL_MAX}字で入力してください。` }, { status: 400 })
  }

  // ⚠️ 利用枠の判定はクロール・LLM の前。ここで1件として数える
  const created = await createRunWithinQuota(userId, {
    sourceUrl,
    source: manualText ? 'manual' : 'site',
    site: {},
    allowedUrls: [],
  })
  if (!created.ok) {
    return NextResponse.json(
      { error: created.quota.reason, limitReached: true, used: created.quota.used, limit: created.quota.limit, upgradeUrl: '/asklink/pricing' },
      { status: 429 }
    )
  }
  const runId = created.runId

  try {
    const { site, audience, allowedUrls } = await readSite(sourceUrl, manualText || undefined)
    const links = await generateLinks(audience, site, allowedUrls)
    const bannerCopy = await generateBannerCopy(audience, site, links[0])
    const run = await prisma.askLinkRun.update({
      where: { id: runId },
      data: {
        site: site as any,
        allowedUrls,
        audience,
        detectedAudience: audience,
        links: links as any,
        bannerCopy: bannerCopy as any,
        linkGenerations: 1,
      },
      select: RUN_SELECT,
    })
    void recordServiceUsage({
      userId,
      serviceId: 'asklink',
      action: '質問リンクを作成',
      summary: `${site.name} / ${sourceUrl}`,
      count: links.length,
    })
    return NextResponse.json({ run: await toRunDto(run) })
  } catch (e) {
    // 結果を出せなかった run は枠から外す（読み取れないサイトで枠を失わせない）
    await prisma.askLinkRun.delete({ where: { id: runId } }).catch(() => {})
    if (e instanceof SiteUnreadableError) {
      return NextResponse.json({ error: e.message, code: 'WEBSITE_UNREADABLE', canUseManualInput: true }, { status: 422 })
    }
    console.error('[asklink] create failed', (e as Error)?.name)
    return NextResponse.json({ error: '作成に失敗しました。時間をおいてもう一度お試しください。' }, { status: 500 })
  }
}

/** 履歴一覧（自分の分だけ） */
export async function GET() {
  const userId = await getAskLinkUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const runs = await prisma.askLinkRun.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, sourceUrl: true, audience: true, site: true, links: true, createdAt: true, banners: { select: { status: true } } },
  })
  return NextResponse.json({
    runs: runs
      .filter((r) => Array.isArray(r.links))
      .map((r) => ({
        id: r.id,
        sourceUrl: r.sourceUrl,
        audience: r.audience,
        name: (r.site as { name?: string })?.name || r.sourceUrl,
        bannersDone: r.banners.filter((b) => b.status === 'done').length,
        createdAt: r.createdAt.toISOString(),
      })),
  })
}
