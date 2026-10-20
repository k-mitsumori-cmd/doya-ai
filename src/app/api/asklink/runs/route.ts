export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { getAskLinkUserId } from '@/lib/asklink/access'
import { parseSourceUrl, readSite, SiteUnreadableError } from '@/lib/asklink/site'
import { generateBannerCopy, generateLinks } from '@/lib/asklink/generate'
import { RUN_SELECT, toRunDto } from '@/lib/asklink/dto'

import { AskLinkCreationError, beginAskLinkCreation, settleAskLinkCreation, validAskLinkCreationId, type AskLinkCreationOutput } from '@/lib/asklink/creation-operation'
import { askLinkCreationResponse, askLinkCreationErrorResponse } from '@/lib/asklink/creation-response'
import { readAskLinkCreationBody } from '@/lib/asklink/creation-http'

const MANUAL_MIN = 20
const MANUAL_MAX = 3000

/**
 * 作成: URL（と、読み取れないサイト向けの手入力説明）→ 抽出 → 質問リンク2本＋バナー文言。
 * バナー画像は時間がかかるので別API（/runs/[id]/banners/[kind]）で1枚ずつ作る。
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAskLinkUserId()
    if (!userId) throw new AskLinkCreationError(401, 'ACTOR_UNAVAILABLE')
    const expectedActor = req.headers.get('X-Asklink-Actor-Id')
    if (expectedActor === null) throw new AskLinkCreationError(428, 'ACTOR_REQUIRED')
    if (expectedActor !== userId) throw new AskLinkCreationError(403, 'ACTOR_CHANGED')
    const body = await readAskLinkCreationBody(req)
    if (Object.keys(body).some(key => !['url', 'manualText', 'operationId'].includes(key)) || !validAskLinkCreationId(body.operationId) || new URL(req.url).searchParams.size) throw new AskLinkCreationError(400, 'INVALID_OPERATION')
    const sourceUrl = typeof body.url === 'string' ? parseSourceUrl(body.url) : null
    if (!sourceUrl || body.manualText !== undefined && typeof body.manualText !== 'string') throw new AskLinkCreationError(400, 'INVALID_INPUT')
    const manualText = typeof body.manualText === 'string' ? body.manualText.trim() : ''
    if (manualText && (manualText.length < MANUAL_MIN || manualText.length > MANUAL_MAX)) throw new AskLinkCreationError(400, 'INVALID_INPUT')
    const accepted = await beginAskLinkCreation({ actor: userId, operationId: body.operationId, sourceUrl, manualText })
    if (!accepted.claim) return askLinkCreationResponse(userId, accepted.operation)
    let output: AskLinkCreationOutput
    try {
      const { site, audience, allowedUrls } = await readSite(sourceUrl, manualText || undefined)
      const links = await generateLinks(audience, site, allowedUrls)
      const bannerCopy = await generateBannerCopy(audience, site, links[0])
      output = { site, audience, allowedUrls, links, bannerCopy }
    } catch (error) {
      const failed = await settleAskLinkCreation(accepted.claim, null, error instanceof SiteUnreadableError ? 'WEBSITE_UNREADABLE' : 'GENERATION_FAILED')
      return askLinkCreationResponse(userId, failed.operation)
    }
    // Saving and presenting are separate: a DTO failure must never delete committed output.
    const saved = await settleAskLinkCreation(accepted.claim, output)
    if (saved.committed) void recordServiceUsage({ userId, serviceId: 'asklink', action: '質問リンクを作成', summary: `${output.site.name} / ${sourceUrl}`, count: output.links.length })
    return askLinkCreationResponse(userId, saved.operation, saved.committed)
  } catch (error) { return askLinkCreationErrorResponse(error) }
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
