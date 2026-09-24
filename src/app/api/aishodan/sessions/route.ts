export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/aishodan/sessions — 商談一覧
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || undefined
  const verdict = url.searchParams.get('verdict') || undefined
  // ⚠️ 練習の商談は**隠さない**。何を話したかを見返すのが練習の目的そのもの。
  //    指標からは除いてあるので、一覧では印を付けて並べる。
  const scope = url.searchParams.get('scope') // 'real' | 'preview' | 未指定=すべて
  const cursor = url.searchParams.get('cursor')
  if (url.searchParams.has('cursor') && (!cursor || cursor.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(cursor))) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }

  const where = {
      organizationId: ctx.organizationId,
      ...(status ? { status } : {}),
      ...(verdict ? { outcome: { verdict } } : {}),
      ...(scope === 'real' ? { room: { isPreview: false } } : {}),
      ...(scope === 'preview' ? { room: { isPreview: true } } : {}),
  }
  if (cursor && !await prisma.aishodanSession.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) {
    return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
  }
  const [rows, total] = await Promise.all([prisma.aishodanSession.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 201,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, guestName: true, guestCompany: true, status: true, currentPhase: true,
      startedAt: true, endedAt: true, createdAt: true, schedulingClickedAt: true,
      room: { select: { name: true, isPreview: true } },
      outcome: { select: { fitScore: true, verdict: true } },
      _count: { select: { turns: true } },
    },
  }), prisma.aishodanSession.count({ where })])
  const sessions = rows.slice(0, 200)
  return NextResponse.json({ sessions, total, nextCursor: rows.length > 200 ? sessions[199].id : null }, { headers: { 'Cache-Control': 'private, no-store' } })
}
