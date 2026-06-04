export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'

// GET /api/sfa/accounts — 取引先一覧（組織スコープ）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const q = new URL(req.url).searchParams.get('q')?.trim()
  const accounts = await prisma.sfaAccount.findMany({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ accounts: bigIntToNumber(accounts) }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/accounts — 取引先作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: '会社名は必須です' }, { status: 400 })

  const account = await prisma.sfaAccount.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      industry: (body.industry as string)?.slice(0, 80) || null,
      prefecture: (body.prefecture as string)?.slice(0, 40) || null,
      url: (body.url as string)?.slice(0, 300) || null,
      note: (body.note as string)?.slice(0, 2000) || null,
      ownerMemberId: ctx.memberId,
    },
  })
  return NextResponse.json({ account: bigIntToNumber(account) })
}
