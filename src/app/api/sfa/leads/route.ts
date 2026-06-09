export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'
import type { LeadStatus } from '@/lib/sfa/types'

const LEAD_STATUSES: LeadStatus[] = ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified']
const LEAD_SOURCES = ['doyalist', 'csv', 'manual']

// GET /api/sfa/leads — リード一覧（status/q フィルタ）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const status = url.searchParams.get('status')?.trim()
  const q = url.searchParams.get('q')?.trim()

  const leads = await prisma.sfaLead.findMany({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      ...(status && (LEAD_STATUSES as string[]).includes(status) ? { status } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
  })
  return NextResponse.json({ leads: bigIntToNumber(leads) }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/leads — リード手動作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: '企業名/氏名は必須です' }, { status: 400 })

  const source = LEAD_SOURCES.includes(body.source) ? body.source : 'manual'

  const lead = await prisma.sfaLead.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      corporateNumber: (body.corporateNumber as string)?.slice(0, 20) || null,
      contactName: (body.contactName as string)?.slice(0, 80) || null,
      email: (body.email as string)?.slice(0, 200) || null,
      phone: (body.phone as string)?.slice(0, 40) || null,
      note: (body.note as string)?.slice(0, 2000) || null,
      source,
      status: 'new',
      assigneeMemberId: ctx.memberId,
    },
  })
  return NextResponse.json({ lead: bigIntToNumber(lead) })
}
