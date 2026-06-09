export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSfaContext, orgSlugFrom } from '@/lib/sfa/access'

// GET /api/sfa/contacts — 担当者一覧（accountId/q で絞り込み可・取引先名つき）
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })

  const url = new URL(req.url)
  const accountId = url.searchParams.get('accountId')?.trim()
  const q = url.searchParams.get('q')?.trim()

  const contacts = await prisma.sfaContact.findMany({
    where: {
      organizationId: ctx.organizationId,
      isActive: true,
      ...(accountId ? { accountId } : {}),
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  })

  // 取引先名を付与
  const accIds = Array.from(new Set(contacts.map((c) => c.accountId).filter(Boolean))) as string[]
  const accs = accIds.length
    ? await prisma.sfaAccount.findMany({ where: { id: { in: accIds } }, select: { id: true, name: true } })
    : []
  const accMap = Object.fromEntries(accs.map((a) => [a.id, a.name]))
  const withName = contacts.map((c) => ({ ...c, accountName: c.accountId ? accMap[c.accountId] || null : null }))

  return NextResponse.json({ contacts: withName }, { headers: { 'Cache-Control': 'no-store' } })
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
  if ((body.accountId as string)?.trim()) {
    const acc = await prisma.sfaAccount.findUnique({ where: { id: body.accountId }, select: { organizationId: true } })
    if (acc && acc.organizationId === ctx.organizationId) accountId = body.accountId
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
