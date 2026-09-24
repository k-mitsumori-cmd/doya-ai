export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'
import { bigIntToNumber } from '@/lib/sfa/format'

// GET /api/sfa/accounts — 取引先一覧（組織スコープ）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const params = new URL(req.url).searchParams
  const q = params.get('q')?.trim() || ''
  const optionsOnly = params.get('options') === '1'
  if (q.length > 100) return NextResponse.json({ error: '検索条件が長すぎます' }, { status: 400 })

  let cursor: { updatedAt: Date; id: string } | null = null
  const rawCursor = params.get('cursor')
  if (rawCursor) {
    try {
      if (rawCursor.length > 512) throw new Error('Cursor too long')
      const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8')) as { updatedAt?: unknown; id?: unknown }
      if (typeof decoded.updatedAt !== 'string' || typeof decoded.id !== 'string' || !decoded.id || decoded.id.length > 128) throw new Error('Invalid cursor')
      const updatedAt = new Date(decoded.updatedAt)
      if (Number.isNaN(updatedAt.getTime()) || updatedAt.toISOString() !== decoded.updatedAt) throw new Error('Invalid date')
      cursor = { updatedAt, id: decoded.id }
    } catch {
      return NextResponse.json({ error: 'ページ指定が正しくありません' }, { status: 400 })
    }
  }

  const baseWhere: Prisma.SfaAccountWhereInput = {
    organizationId: ctx.organizationId,
    isActive: true,
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const pageWhere: Prisma.SfaAccountWhereInput = cursor
    ? { AND: [baseWhere, { OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
    ] }] }
    : baseWhere
  const [rows, totalCount] = await Promise.all([
    prisma.sfaAccount.findMany({
      where: pageWhere,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 201,
      ...(optionsOnly ? { select: { id: true, name: true, updatedAt: true } } : {}),
    }),
    prisma.sfaAccount.count({ where: baseWhere }),
  ])
  const accounts = rows.slice(0, 200)
  const last = accounts[accounts.length - 1]
  return NextResponse.json({
    accounts: bigIntToNumber(accounts),
    totalCount,
    nextCursor: rows.length > 200 && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/accounts — 取引先作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const parsedBody = await req.json().catch(() => null)
  if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: '会社名は必須です' }, { status: 400 })
  if (['industry', 'prefecture', 'url', 'note'].some((key) => body[key] != null && typeof body[key] !== 'string')) {
    return NextResponse.json({ error: '入力項目の形式が正しくありません' }, { status: 400 })
  }

  const account = await prisma.sfaAccount.create({
    data: {
      organizationId: ctx.organizationId,
      name: name.slice(0, 200),
      industry: (body.industry as string | undefined)?.slice(0, 80) || null,
      prefecture: (body.prefecture as string | undefined)?.slice(0, 40) || null,
      url: (body.url as string | undefined)?.slice(0, 300) || null,
      note: (body.note as string | undefined)?.slice(0, 2000) || null,
      ownerMemberId: ctx.memberId,
    },
  })
  return NextResponse.json({ account: bigIntToNumber(account) })
}
