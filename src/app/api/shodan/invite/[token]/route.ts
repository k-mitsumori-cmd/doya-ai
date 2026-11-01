export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}

// GET /api/shodan/invite/[token] — 招待の検証
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const member = await prisma.shodanMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING' || !['admin', 'manager', 'member'].includes(member.role)) {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }
  return NextResponse.json({
    organizationName: member.organization.name,
    organizationSlug: member.organization.slug,
    email: member.inviteEmail,
    role: member.role,
  })
}

// POST /api/shodan/invite/[token] — 承諾して参加
export async function POST(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  const userName = session?.user?.name || null
  const sessionEmail = session?.user?.email?.trim().toLowerCase()
  if (!userId && session?.user?.email) {
    const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } })
    userId = u?.id
  }
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

  const member = await prisma.shodanMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING' || !['admin', 'manager', 'member'].includes(member.role)) {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // 招待は宛先メール本人だけが承諾できる（リンク転送によるなりすまし防止）
  if (!sessionEmail || sessionEmail !== member.inviteEmail?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。' },
      { status: 403 }
    )
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM shodan_organizations WHERE id = ${member.organizationId} FOR UPDATE`
      if (rows.length === 0) return 'unavailable' as const
      const invite = await tx.shodanMember.findUnique({ where: { id: member.id } })
      if (!invite || invite.organizationId !== member.organizationId || invite.status !== 'PENDING' || invite.inviteToken !== p.token) return 'unavailable' as const
      const now = new Date()
      if (invite.createdAt.getTime() <= now.getTime() - INVITE_TTL_MS) return 'expired' as const
      const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!invite.inviteEmail || !account?.email || account.email.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase()) return 'mismatch' as const
      if (!['admin', 'manager', 'member'].includes(invite.role)) return 'unavailable' as const
      const existing = await tx.shodanMember.findFirst({ where: { organizationId: member.organizationId, userId, status: 'ACTIVE' } })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (existing) {
        await tx.shodanMember.deleteMany({ where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
        if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
        return 'already' as const
      }
      const claimed = await tx.shodanMember.updateMany({
        where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
        data: { userId, name: userName, status: 'ACTIVE', acceptedAt: now, inviteToken: null },
      })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      return claimed.count === 1 ? 'accepted' as const : 'unavailable' as const
    })
    if (result === 'expired') return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
    if (result === 'mismatch') return NextResponse.json({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
    if (result === 'unavailable') return NextResponse.json({ error: 'この招待は既に使用済みです' }, { status: 409 })
    return NextResponse.json({ ok: true, organizationSlug: member.organization.slug, ...(result === 'already' ? { alreadyMember: true } : {}) })
  } catch (error) {
    if (error instanceof InvitationExpired) return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
    return NextResponse.json({ error: '招待を承諾できませんでした。再読み込みしてください' }, { status: 409 })
  }
}
