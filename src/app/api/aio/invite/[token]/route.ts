export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> | { token: string } }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000

// GET /api/aio/invite/[token] — 招待の検証
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const member = await prisma.aioMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() > INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }
  return NextResponse.json({
    organizationName: member.organization.name,
    organizationSlug: member.organization.slug,
    email: member.inviteEmail,
    role: member.role,
  })
}

// POST /api/aio/invite/[token] — 承諾して参加
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  const userName = session?.user?.name || null
  const sessionEmail = session?.user?.email?.trim().toLowerCase()
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const member = await prisma.aioMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() > INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // 招待は宛先メール本人だけが承諾できる（リンク転送によるなりすまし防止）
  if (!sessionEmail || sessionEmail !== member.inviteEmail?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。' },
      { status: 403 }
    )
  }

  const existing = await prisma.aioMember.findFirst({
    where: { organizationId: member.organizationId, userId, status: 'ACTIVE' },
  })
  if (existing) {
    await prisma.aioMember.delete({ where: { id: member.id } }).catch(() => {})
    return NextResponse.json({ ok: true, organizationSlug: member.organization.slug, alreadyMember: true })
  }

  try {
    await prisma.aioMember.update({
      where: { id: member.id },
      data: { userId, name: userName, status: 'ACTIVE', acceptedAt: new Date(), inviteToken: null },
    })
  } catch {
    return NextResponse.json({ error: '既にこの組織に所属しています' }, { status: 409 })
  }
  return NextResponse.json({ ok: true, organizationSlug: member.organization.slug })
}
