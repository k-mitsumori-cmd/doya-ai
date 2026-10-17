export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownSite } from '@/lib/popup/access'
import { isId, parseDomain, sanitizeName } from '@/lib/popup/schema'
import { parseDays, sumTotals, totalsByPopup } from '@/lib/popup/stats'
import { toPopupDto, toSiteDto } from '@/lib/popup/dto'

type Ctx = { params: Promise<{ id: string }> }

const NOT_FOUND = { error: '見つかりません。' }

/** サイト詳細（案と集計）。自分の分だけ。他人のIDは404 */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const site = await prisma.popupSite.findFirst({
    where: ownSite(userId, id),
    include: { popups: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  })
  if (!site) return NextResponse.json(NOT_FOUND, { status: 404 })
  const days = parseDays(req.nextUrl.searchParams.get('days'))
  const totals = await totalsByPopup(site.popups.map((p) => p.id), days)
  const popups = site.popups.map((p) => toPopupDto(p, totals.get(p.id)))
  return NextResponse.json({
    days,
    site: toSiteDto(site, { liveCount: popups.filter((p) => p.status === 'live').length, totals: sumTotals(popups.map((p) => p.totals)) }),
    popups,
  })
}

/** サイト名・表示を許すドメインの変更 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const site = await prisma.popupSite.findFirst({ where: ownSite(userId, id), select: { id: true, name: true } })
  if (!site) return NextResponse.json(NOT_FOUND, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: { name?: string; domain?: string } = {}
  if ('name' in (body || {})) data.name = sanitizeName(body.name, site.name)
  if ('domain' in (body || {})) {
    const domain = parseDomain(body.domain)
    if (!domain) return NextResponse.json({ error: 'ドメインを正しく入力してください（例: example.com）。' }, { status: 400 })
    data.domain = domain
  }
  await prisma.popupSite.updateMany({ where: ownSite(userId, site.id), data })
  return NextResponse.json({ ok: true })
}

/**
 * 削除。⚠️ 行は消さずに deletedAt を付ける（消すと提案回数の数え直しで無料枠が戻る）。
 * 公開中の案はその場で止める（タグが残っていても何も出なくなる）。
 */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json(NOT_FOUND, { status: 404 })
  const site = await prisma.popupSite.findFirst({ where: ownSite(userId, id), select: { id: true } })
  if (!site) return NextResponse.json(NOT_FOUND, { status: 404 })
  await prisma.$transaction([
    prisma.popup.updateMany({ where: { siteId: site.id, userId }, data: { status: 'paused' } }),
    prisma.popupSite.updateMany({ where: ownSite(userId, site.id), data: { deletedAt: new Date() } }),
  ])
  return NextResponse.json({ ok: true })
}
