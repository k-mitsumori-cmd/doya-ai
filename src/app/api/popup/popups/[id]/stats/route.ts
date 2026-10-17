export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPopupUserId } from '@/lib/popup/access'
import { isId } from '@/lib/popup/schema'
import { parseDays } from '@/lib/popup/stats'
import { getPopupDaily } from '@/lib/popup/popup-read'

type Ctx = { params: Promise<{ id: string }> }

/** 1つの案の日別推移とリンク別クリック数（自分の分だけ）。正本は popup-read.ts */
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getPopupUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です。' }, { status: 401 })
  const { id } = await ctx.params
  if (!isId(id)) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  const daily = await getPopupDaily(prisma, userId, id, parseDays(req.nextUrl.searchParams.get('days')))
  if (!daily) return NextResponse.json({ error: '見つかりません。' }, { status: 404 })
  return NextResponse.json(daily, { headers: { 'Cache-Control': 'private, no-store' } })
}
