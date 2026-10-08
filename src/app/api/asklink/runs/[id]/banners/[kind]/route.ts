export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { recordServiceUsage } from '@/lib/service-usage'
import { uploadPng } from '@/lib/adimage/storage'
import { getAskLinkUserId, isRunId, ownRun } from '@/lib/asklink/access'
import { generateBanner } from '@/lib/asklink/banner'
import { BANNER_MAX_GENERATIONS, RUN_SELECT, toRunDto } from '@/lib/asklink/dto'
import { findBannerSpec, type BannerCopy, type SiteProfile } from '@/lib/asklink/types'

/** 生成中のまま止まった行（関数のタイムアウト等）を、やり直し可能とみなすまでの時間 */
const STALE_MS = 6 * 60 * 1000

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

  const run = await prisma.askLinkRun.findFirst({ where: ownRun(userId, p.id), select: { id: true, site: true, bannerCopy: true } })
  if (!run || !run.bannerCopy) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })

  await prisma.askLinkBanner.upsert({
    where: { runId_kind: { runId: run.id, kind: spec.kind } },
    create: { runId: run.id, kind: spec.kind },
    update: {},
  })
  const claimed = await prisma.askLinkBanner.updateMany({
    where: {
      runId: run.id,
      kind: spec.kind,
      generations: { lt: BANNER_MAX_GENERATIONS },
      OR: [{ status: { not: 'generating' } }, { updatedAt: { lt: new Date(Date.now() - STALE_MS) } }],
    },
    data: { generations: { increment: 1 }, status: 'generating' },
  })
  if (claimed.count === 0) {
    const b = await prisma.askLinkBanner.findUnique({ where: { runId_kind: { runId: run.id, kind: spec.kind } }, select: { status: true } })
    return NextResponse.json(
      { error: b?.status === 'generating' ? 'このバナーは生成中です。しばらくお待ちください。' : 'このバナーを作り直せる回数の上限に達しました。' },
      { status: b?.status === 'generating' ? 409 : 429 }
    )
  }

  const site = run.site as unknown as SiteProfile
  const copy = run.bannerCopy as unknown as BannerCopy
  try {
    const color = site.colors?.[0] || '#0066ff'
    const result = await generateBanner(spec, copy, site.name, color)
    const path = await uploadPng(`asklink/${userId}/${run.id}/${spec.kind}_${Date.now()}.png`, result.png)
    await prisma.askLinkBanner.update({
      where: { runId_kind: { runId: run.id, kind: spec.kind } },
      data: { status: 'done', imagePath: path, verify: result.verify as any, model: result.model },
    })
    void recordServiceUsage({ userId, serviceId: 'asklink', action: 'バナーを生成', summary: `${site.name} / ${spec.label}`, count: 1 })
  } catch (e) {
    console.error('[asklink] banner failed', (e as Error)?.name)
    await prisma.askLinkBanner
      .update({ where: { runId_kind: { runId: run.id, kind: spec.kind } }, data: { status: 'failed' } })
      .catch(() => {})
  }

  const saved = await prisma.askLinkRun.findFirst({ where: ownRun(userId, run.id), select: RUN_SELECT })
  return NextResponse.json({ run: saved ? await toRunDto(saved) : null })
}
