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

  const sessions = await prisma.aishodanSession.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(status ? { status } : {}),
      ...(verdict ? { outcome: { verdict } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, guestName: true, guestCompany: true, status: true, currentPhase: true,
      startedAt: true, endedAt: true, createdAt: true,
      room: { select: { name: true } },
      outcome: { select: { fitScore: true, verdict: true } },
      _count: { select: { turns: true } },
    },
  })
  return NextResponse.json({ sessions })
}
