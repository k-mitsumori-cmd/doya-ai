import { withToolSeatAdmission, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import type { Prisma } from '@prisma/client'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET  /api/aishodan/invite/[token] — 招待の内容（組織名・権限）
// POST /api/aishodan/invite/[token] — 招待を受ける（要ログイン）
import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { prisma } from '@/lib/prisma'
import { resolveUserId } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}
class InvitationUnavailable extends Error {}
class InvitationEmailMismatch extends Error {}

const ROLE_LABEL: Record<string, string> = {
  owner: 'オーナー',
  admin: '管理者',
  manager: 'マネージャー',
  member: 'メンバー',
}

async function load(token: string) {
  if (!token || token.length < 16) return null
  return prisma.aishodanMember.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      role: true,
      status: true,
      inviteEmail: true,
      userId: true,
      createdAt: true,
      organization: { select: { id: true, name: true } },
    },
  })
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const m = await load(p.token)
  if (!m || !['admin', 'manager', 'member'].includes(m.role)) return privateApiJson({ error: '招待が見つかりません' }, { status: 404 })
  if (m.status === 'PENDING' && m.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) {
    return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // ⚠️ 未ログインでも開ける画面なので、返すのは表示に要る最小限だけ。
  //    招待されたメールアドレスもここでは返さない（総当たりで宛先を探られないように）。
  return privateApiJson({
    invite: {
      organizationName: m.organization.name,
      roleLabel: ROLE_LABEL[m.role] || m.role,
      accepted: m.status === 'ACTIVE',
    },
  })
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const userId = await resolveUserId()
  if (!userId) return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })

  const m = await load(p.token)
  if (!m || !['admin', 'manager', 'member'].includes(m.role)) return privateApiJson({ error: '招待が見つかりません' }, { status: 404 })
  if (m.status !== 'PENDING') {
    return privateApiJson({ error: 'この招待は既に使われています' }, { status: 409 })
  }
  if (m.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) {
    return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
  }
  try {
    // The first transaction may only remove an obsolete pending invitation for
    // an account that is already active. This decrease-only cleanup remains
    // available when the company is over capacity or billing is unavailable.
    // Actual activation always enters the shared company seat guard below.
    const currentInvitation = async (tx: Prisma.TransactionClient, verified?: { role: string; inviteEmail: string | null }) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM aishodan_organizations WHERE id = ${m.organization.id} FOR UPDATE`
      if (rows.length === 0) throw new InvitationUnavailable()
      const invite = await tx.aishodanMember.findUnique({ where: { id: m.id } })
      if (!invite || invite.organizationId !== m.organization.id || invite.status !== 'PENDING' || invite.inviteToken !== p.token) throw new InvitationUnavailable()
      if (verified && (invite.role !== verified.role || invite.inviteEmail !== verified.inviteEmail)) throw new InvitationUnavailable()
      if (invite.createdAt.getTime() <= Date.now() - INVITE_TTL_MS) throw new InvitationExpired()
      const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!invite.inviteEmail || !account?.email || account.email.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase()) throw new InvitationEmailMismatch()
      if (!['admin', 'manager', 'member'].includes(invite.role)) throw new InvitationUnavailable()
      return invite
    }
    const cleanExisting = await prisma.$transaction(async tx => {
      const invite = await currentInvitation(tx)
      const already = await tx.aishodanMember.findFirst({ where: { organizationId: m.organization.id, userId, status: 'ACTIVE' }, select: { id: true } })
      if (!already) return { role: invite.role, inviteEmail: invite.inviteEmail }
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      const removed = await tx.aishodanMember.deleteMany({ where: { id: invite.id, organizationId: m.organization.id, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
      if (removed.count !== 1) throw new InvitationUnavailable()
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      return true
    })
    if (cleanExisting === true) return privateApiJson({ ok: true, alreadyMember: true })

    const result = await withToolSeatAdmission({ tool: 'aishodan', organizationId: m.organization.id, actorUserId: userId }, async tx => {
      const invite = await currentInvitation(tx, cleanExisting)
      return { role: invite.role, value: invite }
    }, async (tx, invite) => {
      const already = await tx.aishodanMember.findFirst({ where: { organizationId: m.organization.id, userId, status: 'ACTIVE' }, select: { id: true } })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (already) {
        const removed = await tx.aishodanMember.deleteMany({ where: { id: invite.id, organizationId: m.organization.id, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
        if (removed.count !== 1) throw new InvitationUnavailable()
        if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
        return 'already' as const
      }
      const now = new Date()
      const claimed = await tx.aishodanMember.updateMany({
        where: { id: invite.id, organizationId: m.organization.id, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
        data: { userId, status: 'ACTIVE', acceptedAt: now, inviteToken: null },
      })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (claimed.count !== 1) throw new InvitationUnavailable()
      return 'accepted' as const
    })
    if (result === 'already') return privateApiJson({ ok: true, alreadyMember: true })
    return privateApiJson({ ok: true, organizationName: m.organization.name })
  } catch (error) {
    const seatFailure = toolSeatAdmissionFailure(error)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    if (error instanceof InvitationEmailMismatch) return privateApiJson({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
    if (error instanceof InvitationUnavailable) return privateApiJson({ error: 'この招待は既に使用済みです' }, { status: 409 })
    if (error instanceof InvitationExpired) return privateApiJson({ error: '招待の有効期限が切れています' }, { status: 410 })
    return privateApiJson({ error: '招待を承諾できませんでした。再読み込みしてください' }, { status: 409 })
  }
}
