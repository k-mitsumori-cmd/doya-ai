export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { AskLinkBannerWriteError, claimAskLinkBanner, uploadAskLinkBanner, settleAskLinkBanner } from '@/lib/asklink/banner-write'
import { getAskLinkUserId, isRunId, ownRun } from '@/lib/asklink/access'
import { generateBanner } from '@/lib/asklink/banner'
import { RUN_SELECT, toRunDto } from '@/lib/asklink/dto'
import { findBannerSpec, type BannerCopy, type SiteProfile } from '@/lib/asklink/types'

type Ctx = { params: Promise<{ id: string; kind: string }> }

/**
 * バナーを1枚生成する。画面は3種類を順に呼び、1枚ずつ進捗を出す。
 * ⚠️ 費用が出る処理。1種類あたり BANNER_MAX_GENERATIONS 回まで（初回＋作り直し1回）。
 *    回数は生成の前に確保する（同時に押されても上限を超えない）。
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  const userId = await getAskLinkUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const p = await ctx.params
  const spec = findBannerSpec(p.kind)
  if (!isRunId(p.id) || !spec) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })

  let accepted: Awaited<ReturnType<typeof claimAskLinkBanner>>
  try { accepted = await claimAskLinkBanner({ actor: userId, runId: p.id, kind: spec.kind }) }
  catch (error) {
    if (error instanceof AskLinkBannerWriteError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('[asklink] banner claim unavailable')
    return NextResponse.json({ error: 'バナーの作成状態を確認できませんでした。' }, { status: 503 })
  }
  const { run, claim } = accepted

  const site = run.site as unknown as SiteProfile
  const copy = run.bannerCopy as unknown as BannerCopy
  try {
    const color = site.colors?.[0] || '#0066ff'
    const result = await generateBanner(spec, copy, site.name, color)
    const path = await uploadAskLinkBanner(claim, result.png)
    const saved = await settleAskLinkBanner(claim, { path, verify: result.verify, model: result.model })
    if (saved) void recordServiceUsage({ userId, serviceId: 'asklink', action: 'バナーを生成', summary: `${site.name} / ${spec.label}`, count: 1 })
  } catch {
    console.error('[asklink] banner result unavailable')
    await settleAskLinkBanner(claim, null).catch(() => {})
  }

  const saved = await prisma.askLinkRun.findFirst({ where: ownRun(userId, run.id), select: RUN_SELECT })
  return NextResponse.json({ run: saved ? await toRunDto(saved) : null })
}
