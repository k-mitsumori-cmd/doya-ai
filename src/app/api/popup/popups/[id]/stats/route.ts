export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId, ownPopup } from '@/lib/popup/access'
import { ctr, isId } from '@/lib/popup/schema'
import { dailySeries, parseDays } from '@/lib/popup/stats'

type Ctx = { params: Promise<{ id: string }> }

/** 1つの案の日別推移とリンク別クリック数（自分の分だけ） */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  const popup = await prisma.popup.findFirst({ where: ownPopup(userId, id), select: { id: true } })
  if (!popup) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  const days = parseDays(req.nextUrl.searchParams.get('days'))
  const { series, byTarget } = await dailySeries(popup.id, days)
  const impressions = series.reduce((a, p) => a + p.impressions, 0)
  const clicks = series.reduce((a, p) => a + p.clicks, 0)
  const closes = series.reduce((a, p) => a + p.closes, 0)
  return NextResponse.json(
    { days, series, byTarget, totals: { impressions, clicks, closes, ctr: ctr(clicks, impressions) } },
    { headers: { 'Cache-Control': 'private, no-store' } }
  )
}
