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

  const sessions = await prisma.aishodanSession.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(status ? { status } : {}),
      ...(verdict ? { outcome: { verdict } } : {}),
      ...(scope === 'real' ? { room: { isPreview: false } } : {}),
      ...(scope === 'preview' ? { room: { isPreview: true } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, guestName: true, guestCompany: true, status: true, currentPhase: true,
      startedAt: true, endedAt: true, createdAt: true, schedulingClickedAt: true,
      room: { select: { name: true, isPreview: true } },
      outcome: { select: { fitScore: true, verdict: true } },
      _count: { select: { turns: true } },
    },
  })
  return NextResponse.json({ sessions })
}
