export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sfaQuotaResponse, checkSfaQuota } from '@/lib/sfa/limits'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}
class InvitationUnavailable extends Error {}

// GET /api/sfa/invite/[token] — 招待の検証
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const member = await prisma.sfaMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
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

// POST /api/sfa/invite/[token] — 承諾して参加
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

  const member = await prisma.sfaMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // 招待は宛先メールアドレス本人だけが承諾できる（リンク転送によるなりすまし・権限乗っ取りを防止）
  if (!sessionEmail || sessionEmail !== member.inviteEmail?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。' },
      { status: 403 }
    )
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const invite = await tx.sfaMember.findUnique({ where: { id: member.id }, include: { organization: true } })
        if (!invite || invite.organizationId !== member.organizationId || invite.status !== 'PENDING' || invite.inviteToken !== p.token || !['admin', 'manager', 'member'].includes(invite.role)) throw new InvitationUnavailable()
        const ensureFresh = () => { if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired() }
        ensureFresh()
        if (!invite.inviteEmail || invite.inviteEmail.trim().toLowerCase() !== sessionEmail) return { kind: 'mismatch' as const }
        const where = { id: invite.id, organizationId: invite.organizationId, status: 'PENDING', inviteToken: p.token, inviteEmail: invite.inviteEmail, role: invite.role }
        const existing = await tx.sfaMember.findFirst({ where: { organizationId: invite.organizationId, userId, status: 'ACTIVE' } })
        ensureFresh()
        if (existing) {
          const removed = await tx.sfaMember.deleteMany({ where: { ...where, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } } })
          ensureFresh()
          if (removed.count !== 1) throw new InvitationUnavailable()
          return { kind: 'already' as const, slug: invite.organization.slug }
        }
        const limit = await checkSfaQuota(tx, invite.organizationId, { members: 1 })
        ensureFresh()
        if (limit) return { kind: 'quota' as const, limit }
        const claimed = await tx.sfaMember.updateMany({
          where: { ...where, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
          data: { userId, name: userName, status: 'ACTIVE', acceptedAt: new Date(), inviteToken: null },
        })
        ensureFresh()
        if (claimed.count !== 1) throw new InvitationUnavailable()
        return { kind: 'accepted' as const, slug: invite.organization.slug }
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      if (result.kind === 'mismatch') return NextResponse.json({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
      if (result.kind === 'quota') return sfaQuotaResponse(result.limit)
      return NextResponse.json({ ok: true, organizationSlug: result.slug, ...(result.kind === 'already' ? { alreadyMember: true } : {}) })
    } catch (error) {
      if ((error as { code?: string })?.code === 'P2034' && attempt < 4) continue
      if (error instanceof InvitationExpired) return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
      return NextResponse.json({ error: '招待の状態を確認できませんでした。再確認してください。' }, { status: 409 })
    }
  }
  return NextResponse.json({ error: '招待の状態を確認できませんでした。再確認してください。' }, { status: 409 })
}
