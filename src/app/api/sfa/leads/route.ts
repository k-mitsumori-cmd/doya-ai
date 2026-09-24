export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
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
  const status = url.searchParams.get('status')?.trim() || ''
  const q = url.searchParams.get('q')?.trim() || ''
  const rawCursor = url.searchParams.get('cursor') || ''
  if ((status && !(LEAD_STATUSES as string[]).includes(status)) || q.length > 100 || rawCursor.length > 512) {
    return NextResponse.json({ error: '検索条件が正しくありません' }, { status: 400 })
  }

  let cursor: { score: number | null; updatedAt: Date; id: string } | null = null
  if (rawCursor) {
    try {
      const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { score?: unknown; updatedAt?: unknown; id?: unknown }
      if ((decoded.score !== null && (typeof decoded.score !== 'number' || !Number.isSafeInteger(decoded.score))) ||
        typeof decoded.updatedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) throw new Error('Invalid cursor')
      const updatedAt = new Date(decoded.updatedAt)
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== decoded.updatedAt) throw new Error('Invalid date')
      cursor = { score: decoded.score, updatedAt, id: decoded.id }
    } catch {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const where: Prisma.SfaLeadWhereInput = {
    organizationId: ctx.organizationId,
    isActive: true,
    ...(status ? { status } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const afterCursor: Prisma.SfaLeadWhereInput | null = cursor
    ? cursor.score === null
      ? { score: null, OR: [
        { updatedAt: { lt: cursor.updatedAt } },
        { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
      ] }
      : { OR: [
        { score: { lt: cursor.score } },
        { score: cursor.score, updatedAt: { lt: cursor.updatedAt } },
        { score: cursor.score, updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
        { score: null },
      ] }
    : null
  const pageWhere: Prisma.SfaLeadWhereInput = afterCursor ? { AND: [where, afterCursor] } : where
  const [rows, totalCount] = await Promise.all([
    prisma.sfaLead.findMany({
      where: pageWhere,
      orderBy: [{ score: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }, { id: 'desc' }],
      take: 201,
    }),
    prisma.sfaLead.count({ where }),
  ])
  const leads = rows.slice(0, 200)
  const last = leads[leads.length - 1]
  return NextResponse.json({
    leads: bigIntToNumber(leads),
    totalCount,
    nextCursor: rows.length > 200 && last
      ? Buffer.from(JSON.stringify({ score: last.score, updatedAt: last.updatedAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/leads — リード手動作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: '企業名/氏名は必須です' }, { status: 400 })
  if (['corporateNumber', 'contactName', 'email', 'phone', 'note'].some((key) => body[key] != null && typeof body[key] !== 'string')) {
    return NextResponse.json({ error: '入力項目の形式が正しくありません' }, { status: 400 })
  }
  if (body.source != null && (typeof body.source !== 'string' || !LEAD_SOURCES.includes(body.source))) {
    return NextResponse.json({ error: '流入元が正しくありません' }, { status: 400 })
  }

  const source = typeof body.source === 'string' ? body.source : 'manual'

  const lead = await prisma.sfaLead.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      corporateNumber: (body.corporateNumber as string | undefined)?.slice(0, 20) || null,
      contactName: (body.contactName as string | undefined)?.slice(0, 80) || null,
      email: (body.email as string | undefined)?.slice(0, 200) || null,
      phone: (body.phone as string | undefined)?.slice(0, 40) || null,
      note: (body.note as string | undefined)?.slice(0, 2000) || null,
      source,
      status: 'new',
      assigneeMemberId: ctx.memberId,
    },
  })
  return NextResponse.json({ lead: bigIntToNumber(lead) })
}
