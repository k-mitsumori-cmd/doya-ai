import { withToolSeatAdmissionInTransaction, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import type { Prisma } from '@prisma/client'
import type { SfaQuotaExceeded } from '@/lib/sfa/limits'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sfaQuotaResponse, checkSfaQuota } from '@/lib/sfa/limits'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}
class InvitationUnavailable extends Error {}
class InvitationEmailMismatch extends Error {}
class SfaInvitationQuota extends Error { constructor(public readonly limit: SfaQuotaExceeded) { super('SFA_LIMIT_REACHED') } }

// GET /api/sfa/invite/[token] — 招待の検証
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const member = await prisma.sfaMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
    return privateApiJson({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
  }
  return privateApiJson({
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
  if (!userId) return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })

  const member = await prisma.sfaMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING') {
    return privateApiJson({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // 招待は宛先メールアドレス本人だけが承諾できる（リンク転送によるなりすまし・権限乗っ取りを防止）
  if (!sessionEmail || sessionEmail !== member.inviteEmail?.trim().toLowerCase()) {
    return privateApiJson(
      { error: 'この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。' },
      { status: 403 }
    )
  }

  for (let attempt = 0; attempt < 5; attempt++) {
  try {
    // The first transaction may only remove an obsolete pending invitation for
    // an account that is already active. This decrease-only cleanup remains
    // available when the company is over capacity or billing is unavailable.
    // Actual activation always enters the shared company seat guard below.
    const currentInvitation = async (tx: Prisma.TransactionClient, verified?: { role: string; inviteEmail: string | null }) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_organizations WHERE id = ${member.organizationId} FOR UPDATE`
      if (rows.length === 0) throw new InvitationUnavailable()
      const invite = await tx.sfaMember.findUnique({ where: { id: member.id } })
      if (!invite || invite.organizationId !== member.organizationId || invite.status !== 'PENDING' || invite.inviteToken !== p.token) throw new InvitationUnavailable()
      if (verified && (invite.role !== verified.role || invite.inviteEmail !== verified.inviteEmail)) throw new InvitationUnavailable()
      if (invite.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) throw new InvitationExpired()
      const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!invite.inviteEmail || !account?.email || account.email.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase()) throw new InvitationEmailMismatch()
      if (!['admin', 'manager', 'member'].includes(invite.role)) throw new InvitationUnavailable()
      return invite
    }
    const cleanExisting = await prisma.$transaction(async tx => {
      const invite = await currentInvitation(tx)
      const already = await tx.sfaMember.findFirst({ where: { organizationId: member.organizationId, userId, status: 'ACTIVE' }, select: { id: true } })
      if (!already) return { role: invite.role, inviteEmail: invite.inviteEmail }
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      const removed = await tx.sfaMember.deleteMany({ where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
      if (removed.count !== 1) throw new InvitationUnavailable()
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      return true
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    if (cleanExisting === true) return privateApiJson({ ok: true, organizationSlug: member.organization.slug, alreadyMember: true })

    const result = await prisma.$transaction(tx => withToolSeatAdmissionInTransaction({ tool: 'sfa', organizationId: member.organizationId, actorUserId: userId }, tx, async tx => {
      const invite = await currentInvitation(tx, cleanExisting)
      return { role: invite.role, value: invite }
    }, async (tx, invite) => {
      const already = await tx.sfaMember.findFirst({ where: { organizationId: member.organizationId, userId, status: 'ACTIVE' }, select: { id: true } })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (already) {
        const removed = await tx.sfaMember.deleteMany({ where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
        if (removed.count !== 1) throw new InvitationUnavailable()
        if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
        return 'already' as const
      }
      const limit = await checkSfaQuota(tx, invite.organizationId, { members: 1 })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (limit) throw new SfaInvitationQuota(limit)
      const now = new Date()
      const claimed = await tx.sfaMember.updateMany({
        where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
        data: { userId, name: userName, status: 'ACTIVE', acceptedAt: now, inviteToken: null },
      })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (claimed.count !== 1) throw new InvitationUnavailable()
      return 'accepted' as const
    }), { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    return privateApiJson({ ok: true, organizationSlug: member.organization.slug, ...(result === 'already' ? { alreadyMember: true } : {}) })
  } catch (error) {
    const failure = error as { code?: string; meta?: { code?: string } }
    if ((failure?.code === 'P2034' || failure?.code === 'P2010' && ['40001', '40P01'].includes(failure.meta?.code || '')) && attempt < 4) continue
    if (error instanceof SfaInvitationQuota) return sfaQuotaResponse(error.limit)
    const seatFailure = toolSeatAdmissionFailure(error)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    if (error instanceof InvitationEmailMismatch) return privateApiJson({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
    if (error instanceof InvitationUnavailable) return privateApiJson({ error: 'この招待は既に使用済みです' }, { status: 409 })
    if (error instanceof InvitationExpired) return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
    return privateApiJson({ error: '招待を承諾できませんでした。再読み込みしてください' }, { status: 409 })
  }
  }
  return privateApiJson({ error: '招待の状態を確認できませんでした。再確認してください。' }, { status: 409 })
}
