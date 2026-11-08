import { privateApiJson } from '@/lib/private-api-response'
import type { Prisma, SfaMember } from '@prisma/client'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { withToolSeatAdmissionInTransaction, ToolSeatAdmissionError } from '@/lib/pricing-v2/tool-seat-admission.server'
import { ToolSeatInvitationDomainError, toolSeatInvitationFailure } from '@/lib/pricing-v2/tool-seat-invitation.server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { escapeHtml } from '@/lib/html-escape'
import { getSfaContext, hasMinRole, orgSlugFrom } from '@/lib/sfa/access'
import { ROLE_HIERARCHY } from '@/lib/sfa/types'
import { sendEmail } from '@/lib/email'
import { canManageSfaBilling, sfaQuotaResponse, withSfaAdmission, type SfaAdmissionResult } from '@/lib/sfa/limits'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'

type SfaInviteResult = { kind: 'duplicate'; status: string } | { kind: 'created'; member: SfaMember }
class DuplicateSfaInvitation extends Error { constructor(readonly status: string) { super('DUPLICATE_INVITATION') } }

const INVITABLE_ROLES = ['member', 'manager', 'admin']
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
const rank = (role: string) => ROLE_HIERARCHY[role] ?? 0
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// GET /api/sfa/members — メンバー一覧
export async function GET(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return privateApiJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
  const members = await prisma.sfaMember.findMany({
    where: { organizationId: ctx.organizationId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, role: true, status: true, inviteEmail: true, acceptedAt: true, createdAt: true },
  })
  return privateApiJson({ members, myRole: ctx.role, myMemberId: ctx.memberId }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST /api/sfa/members — メンバー招待（admin+）
export async function POST(req: NextRequest) {
  const ctx = await getSfaContext(orgSlugFrom(req))
  if (!ctx) return privateApiJson({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'admin')) return privateApiJson({ error: '招待権限がありません' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return privateApiJson({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role === undefined ? 'member' : body.role
  if (!email || email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return privateApiJson({ error: '有効なメールアドレスを入力してください' }, { status: 400 })
  }
  if (typeof role !== 'string' || !INVITABLE_ROLES.includes(role)) {
    return privateApiJson({ error: '招待権限の形式が正しくありません' }, { status: 400 })
  }
  // 自分と同格以上の権限では招待できない（adminはadminを招待不可。ownerのみadmin招待可能）
  if (rank(role) >= rank(ctx.role)) {
    return privateApiJson({ error: '自分と同格以上の権限では招待できません' }, { status: 403 })
  }

  const duplicateWhere = () => ({
    organizationId: ctx.organizationId, inviteEmail: email,
    OR: [{ status: 'ACTIVE' }, { status: 'PENDING', createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } }],
  })
  const org = await prisma.sfaOrganization.findUnique({ where: { id: ctx.organizationId } })
  const inviteToken = crypto.randomUUID()
  let admitted: SfaAdmissionResult<SfaInviteResult>
  try {
    const recipients = await prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
    if (recipients.length > 1) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
    let guardedTx: Prisma.TransactionClient | null = null
    const authorize = async (tx: Prisma.TransactionClient) => {
      const ceiling = await ceilToolRole({ tool: 'sfa', organizationId: ctx.organizationId, userId: ctx.userId, toolRole: 'owner' }, tx)
      const organizations = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM sfa_organizations WHERE id = ${ctx.organizationId} FOR UPDATE`
      if (!organizations.length) throw new ToolSeatInvitationDomainError('missing')
      const actor = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM sfa_members
        WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId}
        AND "userId" = ${ctx.userId} AND status = 'ACTIVE' AND role IN ('owner', 'admin') FOR UPDATE`
      const currentRole = actor.length && ceiling ? lowerToolRole('sfa', actor[0].role, ceiling) : null
      const actorRole = currentRole ? lowerToolRole('sfa', currentRole, ctx.role) : null
      if (!actorRole || rank(role) >= rank(actorRole)) throw new ToolSeatInvitationDomainError('forbidden')
      const currentRecipients = await tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
      if (currentRecipients.length !== recipients.length || currentRecipients.some(user => !recipients.some(hint => hint.id === user.id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
      const duplicate = await tx.sfaMember.findFirst({ where: duplicateWhere() })
      if (duplicate) throw new DuplicateSfaInvitation(duplicate.status)
      return { role: actorRole, value: undefined }
    }
    admitted = await withSfaAdmission<SfaInviteResult>(ctx.organizationId, { members: 1 }, async tx => {
      // Keep domain authorization mandatory even for alternate quota adapters.
      if (guardedTx !== tx) await authorize(tx)
      const dup = await tx.sfaMember.findFirst({ where: duplicateWhere() })
      if (dup) return { kind: 'duplicate', status: dup.status }
      await tx.sfaMember.deleteMany({ where: { organizationId: ctx.organizationId, inviteEmail: email, status: 'PENDING', createdAt: { lte: new Date(Date.now() - INVITE_TTL_MS) } } })
      const member = await tx.sfaMember.create({ data: { organizationId: ctx.organizationId, role, status: 'PENDING', inviteEmail: email, inviteToken } })
      return { kind: 'created', member }
    }, { countPendingInvites: true, coordinate: (tx, admit) => withToolSeatAdmissionInTransaction({ tool: 'sfa', organizationId: ctx.organizationId, actorUserId: ctx.userId, additionalUserIds: recipients.map(user => user.id) }, tx, authorize, async () => {
      guardedTx = tx
      try { return await admit() } finally { guardedTx = null }
    }) })
  } catch (error) {
    if (error instanceof DuplicateSfaInvitation) return privateApiJson({ error: error.status === 'ACTIVE' ? '既に参加済みのメンバーです' : '既に招待済みです' }, { status: 409 })
    const seatFailure = toolSeatInvitationFailure(error)
    if (seatFailure) return privateApiJson(seatFailure.body, { status: seatFailure.status })
    return privateApiJson({ error: '招待の作成に失敗しました（既に招待済みかもしれません）' }, { status: 409 })
  }
  if (admitted.limit) return sfaQuotaResponse(admitted.limit, await canManageSfaBilling(prisma, ctx.organizationId, ctx.userId))
  if (admitted.created.kind === 'duplicate') return privateApiJson({ error: admitted.created.status === 'ACTIVE' ? '既に参加済みのメンバーです' : '既に招待済みです' }, { status: 409 })
  const member = admitted.created.member

  const baseUrl = process.env.NEXTAUTH_URL || 'https://doya-ai.surisuta.jp'
  const link = `${baseUrl}/sfa/invite/${inviteToken}`
  const delivery = await sendEmail({
    to: email,
    subject: `【ドヤ営業管理】${esc(org?.name || '組織')}からの招待`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#22c55e,#84cc16);padding:24px;border-radius:16px 16px 0 0;color:#fff">
          <h1 style="margin:0;font-size:20px">ドヤ営業管理に招待されました</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:24px">
          <p style="font-weight:700;color:#334155">「${esc(org?.name || '組織')}」のメンバーとして招待されました。</p>
          <p style="color:#64748b">下のボタンからログインして参加してください（リンクの有効期限は48時間）。</p>
          <a href="${escapeHtml(link)}" style="display:inline-block;margin-top:12px;background:#7f19e6;color:#fff;font-weight:800;padding:12px 24px;border-radius:9999px;text-decoration:none">招待を受ける</a>
          <p style="color:#94a3b8;font-size:12px;margin-top:16px">${esc(link)}</p>
        </div>
      </div>`,
  })

  return privateApiJson({ ok: true, emailSent: delivery.success, inviteUrl: delivery.success ? undefined : link, member: { id: member.id, inviteEmail: email, role } })
}
