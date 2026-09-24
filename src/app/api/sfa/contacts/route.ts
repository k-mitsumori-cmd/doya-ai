export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

// GET /api/sfa/contacts — 担当者一覧（accountId/q で絞り込み可・取引先名つき）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')?.trim()
  const q = url.searchParams.get('q')?.trim() || ''
  if (q.length > 100) return NextResponse.json({ error: '検索条件が長すぎます' }, { status: 400 })

  let cursor: { updatedAt: Date; id: string } | null = null
  const rawCursor = url.searchParams.get('cursor')
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

  const baseWhere: Prisma.SfaContactWhereInput = {
    organizationId: ctx.organizationId,
    isActive: true,
    ...(accountId ? { accountId } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  }
  const pageWhere: Prisma.SfaContactWhereInput = cursor
    ? { AND: [baseWhere, { OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
    ] }] }
    : baseWhere
  const [rows, totalCount] = await Promise.all([
    prisma.sfaContact.findMany({ where: pageWhere, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: 201 }),
    prisma.sfaContact.count({ where: baseWhere }),
  ])
  const contacts = rows.slice(0, 200)

  // 取引先名を付与
  const accIds = Array.from(new Set(contacts.map((c) => c.accountId).filter(Boolean))) as string[]
  const accs = accIds.length
    ? await prisma.sfaAccount.findMany({ where: { id: { in: accIds }, organizationId: ctx.organizationId }, select: { id: true, name: true } })
    : []
  const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
  const withName = contacts.map((c) => ({ ...c, accountName: c.accountId ? accMap[c.accountId] || null : null }))

  const last = contacts[contacts.length - 1]
  return NextResponse.json({
    contacts: withName,
    totalCount,
    nextCursor: rows.length > 200 && last
      ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt.toISOString(), id: last.id })).toString('base64url')
      : null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/contacts — 担当者作成
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = (body.name as string)?.trim()
  if (!name) return NextResponse.json({ error: '氏名は必須です' }, { status: 400 })

  // 取引先指定があれば所有確認（IDOR対策）
  let accountId: string | null = null
  if (typeof body.accountId === 'string' && body.accountId.trim()) {
    const requestedId = body.accountId.trim()
    const acc = await prisma.sfaAccount.findFirst({ where: { id: requestedId, organizationId: ctx.organizationId, isActive: true }, select: { id: true } })
    if (!acc) return NextResponse.json({ error: '選択した取引先が見つかりません。再読み込みして選び直してください。' }, { status: 400 })
    accountId = acc.id
  }

  const contact = await prisma.sfaContact.create({
    data: {
      organizationId: ctx.organizationId,
      accountId,
      name: name.slice(0, 80),
      title: (body.title as string)?.slice(0, 80) || null,
      department: (body.department as string)?.slice(0, 80) || null,
      email: (body.email as string)?.slice(0, 200) || null,
      phone: (body.phone as string)?.slice(0, 40) || null,
      isKeyPerson: body.isKeyPerson === true,
      note: (body.note as string)?.slice(0, 2000) || null,
    },
  })
  return NextResponse.json({ contact })
}
