export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAskLinkUserId, isRunId, ownRun } from '@/lib/asklink/access'
import { RUN_SELECT, toRunDto } from '@/lib/asklink/dto'
import { generateBannerCopy, generateLinks } from '@/lib/asklink/generate'
import type { SiteProfile } from '@/lib/asklink/types'

/** 1回の作成で質問リンクを作り直せる回数（ToB/ToC の切り替え含む）。LLMの乱用防止 */
const MAX_LINK_GENERATIONS = 10

type Ctx = { params: Promise<{ id: string }> }

/** ToB/ToC を切り替えて（または同じ判定のまま）質問リンク2本とバナー文言を作り直す */
export async function POST(req: NextRequest, ctx: Ctx) {
  const userId = await getAskLinkUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const p = await ctx.params
  if (!isRunId(p.id)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const audience = body?.audience === 'b2c' ? 'b2c' : body?.audience === 'b2b' ? 'b2b' : null
  if (!audience) return NextResponse.json({ error: 'ToB / ToC を指定してください。' }, { status: 400 })

  const run = await prisma.askLinkRun.findFirst({ where: ownRun(userId, p.id), select: { id: true, site: true, allowedUrls: true, links: true } })
  if (!run || !Array.isArray(run.links)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })

  // 先に回数を確保してから生成する（同時に押されても上限を超えない）
  const claimed = await prisma.askLinkRun.updateMany({
    where: { id: run.id, userId, linkGenerations: { lt: MAX_LINK_GENERATIONS } },
    data: { linkGenerations: { increment: 1 } },
  })
  if (claimed.count === 0) {
    return NextResponse.json({ error: 'この結果で作り直せる回数の上限に達しました。新しく作成してください。' }, { status: 429 })
  }

  try {
    const site = run.site as unknown as SiteProfile
    const allowedUrls = (run.allowedUrls as string[]) || []
    const links = await generateLinks(audience, site, allowedUrls)
    const bannerCopy = await generateBannerCopy(audience, site, links[0])
    const saved = await prisma.askLinkRun.update({
      where: { id: run.id },
      data: { audience, links: links as any, bannerCopy: bannerCopy as any },
      select: RUN_SELECT,
    })
    return NextResponse.json({ run: await toRunDto(saved) })
  } catch (e) {
    console.error('[asklink] regenerate links failed', (e as Error)?.name)
    return NextResponse.json({ error: '作り直しに失敗しました。時間をおいてもう一度お試しください。' }, { status: 500 })
  }
}
