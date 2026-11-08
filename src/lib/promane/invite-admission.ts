import { ToolSeatInvitationDomainError, toolSeatInvitationFailure } from '@/lib/pricing-v2/tool-seat-invitation.server'
import { lowerToolRole } from '@/lib/company-roles/tool-roles'
import { withToolSeatAdmissionInTransaction, ToolSeatAdmissionError, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserPromaneLimits } from '@/lib/promane/limits'
import { ceilToolRole } from '@/lib/company-roles/access.server'

type AdmissionError = {
  status: number
  error: string
  code?: string
  expectedEmail?: string
  limitReached?: boolean
  canManageBilling?: boolean
}
type AdmissionResult =
  | { success: true; workspaceSlug: string; alreadyMember: boolean }
  | { success: false; response: AdmissionError }

class InvitationExpired extends Error {}

type IssueResult =
  | { success: true; invitation: { token: string; expiresAt: Date }; workspaceName: string; reused: boolean }
  | { success: false; response: AdmissionError }

/** 有効な招待も席として予約し、満員のワークスペースから使用不能な招待を送らない。 */
export async function issuePromaneInvitation(args: {
  workspaceId: string
  userId: string
  email: string
  role: 'admin' | 'member' | 'guest'
}): Promise<IssueResult> {
  const authorize = async (tx: Prisma.TransactionClient, ceiling: string | null) => {
    const workspaces = await tx.$queryRaw<{ id: string }[]>
      `SELECT id FROM promane_workspaces WHERE id = ${args.workspaceId} FOR UPDATE`
    if (workspaces.length !== 1) throw new ToolSeatInvitationDomainError('missing')
    const inviters = await tx.$queryRaw<{ role: string; isActive: boolean }[]>
      `SELECT role, "isActive" FROM promane_members
        WHERE "workspaceId" = ${args.workspaceId} AND "userId" = ${args.userId} FOR UPDATE`
    const inviter = inviters[0]
    const role = inviter?.isActive && ceiling ? lowerToolRole('promane', inviter.role, ceiling) : null
    if (role !== 'owner' && role !== 'admin') throw new ToolSeatInvitationDomainError('forbidden')
    return { role, value: undefined }
  }
  const issue = async (tx: Prisma.TransactionClient): Promise<IssueResult> => {
        const existingMember = await tx.promaneMember.findFirst({
          where: { workspaceId: args.workspaceId, user: { email: { equals: args.email, mode: 'insensitive' } } },
        })
        if (existingMember) return { success: false, response: { status: 409, error: '既にメンバーです' } }

        const workspace = await tx.promaneWorkspace.findUnique({
          where: { id: args.workspaceId }, select: { name: true, userId: true },
        })
        if (!workspace) return { success: false, response: { status: 404, error: 'ワークスペースが見つかりません' } }
        const limits = await getUserPromaneLimits(workspace.userId, tx)
        const active = await tx.promaneMember.count({ where: { workspaceId: args.workspaceId, isActive: true } })
        const atLimit = (count: number) => limits.maxMembersPerWorkspace >= 0 && count >= limits.maxMembersPerWorkspace
        const canManageBilling = args.userId === workspace.userId
        const limitResponse = () => ({
          success: false as const,
          response: {
            status: 403,
            error: `メンバーと有効な招待の上限（${limits.maxMembersPerWorkspace}名）に達しました。${canManageBilling ? 'プランをご確認ください。' : '利用枠の変更はワークスペースの契約者にご相談ください。'}`,
            code: 'PROMANE_MEMBER_LIMIT_REACHED',
            limitReached: true,
            canManageBilling,
          },
        })
        if (atLimit(active)) return limitResponse()
        const existingInvite = await tx.promaneInvitation.findFirst({
          where: { workspaceId: args.workspaceId, email: args.email, acceptedAt: null, expiresAt: { gt: new Date() } },
        })
        if (existingInvite && existingInvite.expiresAt.getTime() > Date.now()) {
          if (existingInvite.role !== args.role) {
            return {
              success: false,
              response: {
                status: 409,
                error: 'このメールアドレスには別の役割で有効な招待があります。役割を変える場合は、既存の招待を取り消してから再度招待してください。',
                code: 'PROMANE_INVITE_ROLE_CONFLICT',
              },
            }
          }
          return {
            success: true,
            invitation: { token: existingInvite.token, expiresAt: existingInvite.expiresAt },
            workspaceName: workspace.name,
            reused: true,
          }
        }

        const pending = await tx.promaneInvitation.count({
          where: { workspaceId: args.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
        })
        if (atLimit(active + pending)) return limitResponse()
        const invitation = await tx.promaneInvitation.create({
          data: {
            workspaceId: args.workspaceId,
            email: args.email,
            role: args.role,
            token: crypto.randomBytes(32).toString('hex'),
            invitedById: args.userId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          select: { token: true, expiresAt: true },
        })
        return { success: true, invitation, workspaceName: workspace.name, reused: false }

  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const operating = args.role !== 'guest'
      const email = args.email.trim().toLowerCase()
      const recipients = operating ? await prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 }) : []
      if (recipients.length > 1) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
      return await prisma.$transaction(async tx => {
        const currentAuthority = async (currentTx: Prisma.TransactionClient) => {
          const ceiling = await ceilToolRole({ tool: 'promane', userId: args.userId, organizationId: args.workspaceId, toolRole: 'owner' }, currentTx)
          const domain = await authorize(currentTx, ceiling)
          if (operating) {
            const currentRecipients = await currentTx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
            if (currentRecipients.length !== recipients.length || currentRecipients.some(user => !recipients.some(hint => hint.id === user.id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
          }
          return domain
        }
        if (operating) return withToolSeatAdmissionInTransaction({ tool: 'promane', organizationId: args.workspaceId, actorUserId: args.userId, additionalUserIds: recipients.map(user => user.id) }, tx, currentAuthority, currentTx => issue(currentTx))
        // Read-only guests do not require or consume a purchased operating seat.
        // Current authority and the existing Serializable service quota remain.
        await currentAuthority(tx)
        return issue(tx)
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const failure = toolSeatInvitationFailure(error)
      if (failure) return { success: false, response: { status: failure.status, ...failure.body } }
      const sql = error as { code?: string; meta?: { code?: string } }
      const retryable = sql.code === 'P2034' || sql.code === 'P2010' && ['40001', '40P01'].includes(sql.meta?.code ?? '')
      if (!retryable || attempt === 4) throw error
    }
  }
  throw new Error('Promane invitation issue retries exhausted')
}

/** 招待承諾と契約者のメンバー枠判定を同じ直列化可能トランザクションに収める。 */
class PromaneAdmissionDenied extends Error {
  constructor(public readonly response: AdmissionError) { super(response.code ?? 'PROMANE_ADMISSION_DENIED') }
}
class PromaneInvitationUnavailable extends Error {}
type VerifiedInvitation = { id: string; workspaceId: string; role: string; email: string }

export async function acceptPromaneInvitation(args: {
  token: string
  userId: string
  email: string | null | undefined
  displayName: string | null | undefined
}): Promise<AdmissionResult> {
  const mismatch = (email: string): AdmissionError => ({ status: 403,
    error: `この招待は ${email} 宛です。一旦ログアウトし、招待されたGoogleアカウントでログインしてください。`,
    code: 'email_mismatch', expectedEmail: email })
  const fresh = (invitation: { expiresAt: Date }) => {
    if (invitation.expiresAt.getTime() <= Date.now()) throw new InvitationExpired()
  }
  const currentInvitation = async (tx: Prisma.TransactionClient, verified?: VerifiedInvitation) => {
    const hint = await tx.promaneInvitation.findUnique({ where: { token: args.token }, select: { id: true, workspaceId: true } })
    if (!hint) throw new PromaneAdmissionDenied({ status: 404, error: '招待リンクが見つかりません' })
    const workspace = await tx.$queryRaw<Array<{ id: string }>>
      `SELECT id FROM promane_workspaces WHERE id = ${hint.workspaceId} FOR UPDATE`
    if (workspace.length !== 1) throw new PromaneInvitationUnavailable()
    const invitation = await tx.promaneInvitation.findUnique({ where: { id: hint.id },
      include: { workspace: { select: { id: true, slug: true, userId: true } } } })
    if (!invitation || invitation.workspaceId !== hint.workspaceId || invitation.token !== args.token) throw new PromaneInvitationUnavailable()
    if (verified && (invitation.id !== verified.id || invitation.workspaceId !== verified.workspaceId ||
      invitation.role !== verified.role || invitation.email !== verified.email)) throw new PromaneInvitationUnavailable()
    if (!['admin', 'member', 'guest'].includes(invitation.role)) throw new PromaneAdmissionDenied({ status: 404, error: '招待リンクが見つかりません' })
    if (invitation.acceptedAt) throw new PromaneAdmissionDenied({ status: 410, error: '既に承諾済みです', code: 'PROMANE_INVITE_ACCEPTED' })
    fresh(invitation)
    const account = await tx.user.findUnique({ where: { id: args.userId }, select: { email: true } })
    const email = invitation.email.trim().toLowerCase()
    if (!args.email || args.email.trim().toLowerCase() !== email || !account?.email || account.email.trim().toLowerCase() !== email) throw new PromaneAdmissionDenied(mismatch(invitation.email))
    return invitation
  }
  const claim = async (tx: Prisma.TransactionClient, invitation: Awaited<ReturnType<typeof currentInvitation>>) => {
    fresh(invitation)
    const result = await tx.promaneInvitation.updateMany({ where: { id: invitation.id, workspaceId: invitation.workspaceId,
      token: args.token, role: invitation.role, email: invitation.email, acceptedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() } })
    fresh(invitation)
    if (result.count !== 1) throw new PromaneInvitationUnavailable()
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Marking an obsolete invitation accepted for an existing ACTIVE member
      // cannot grant a role. Keep that decrease-only path independent of billing.
      const probe = await prisma.$transaction(async tx => {
        const invitation = await currentInvitation(tx)
        const existing = await tx.promaneMember.findUnique({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: args.userId } } })
        fresh(invitation)
        if (existing && !existing.isActive) throw new PromaneAdmissionDenied({ status: 403, error: 'ワークスペースへのアクセスが停止されています。管理者にご確認ください。' })
        if (existing) {
          await claim(tx, invitation)
          return { kind: 'already' as const, slug: invitation.workspace.slug }
        }
        return { kind: 'new' as const, verified: { id: invitation.id, workspaceId: invitation.workspaceId, role: invitation.role, email: invitation.email } }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      if (probe.kind === 'already') return { success: true, workspaceSlug: probe.slug, alreadyMember: true }
      return await prisma.$transaction(tx => withToolSeatAdmissionInTransaction({ tool: 'promane', organizationId: probe.verified.workspaceId, actorUserId: args.userId }, tx,
        async currentTx => { const invitation = await currentInvitation(currentTx, probe.verified); return { role: invitation.role, value: invitation } },
        async (currentTx, invitation) => {
          const existing = await currentTx.promaneMember.findUnique({ where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: args.userId } } })
          fresh(invitation)
          if (existing && !existing.isActive) throw new PromaneAdmissionDenied({ status: 403, error: 'ワークスペースへのアクセスが停止されています。管理者にご確認ください。' })
          if (!existing) {
            const limits = await getUserPromaneLimits(invitation.workspace.userId, currentTx)
            const used = await currentTx.promaneMember.count({ where: { workspaceId: invitation.workspaceId, isActive: true } })
            fresh(invitation)
            if (limits.maxMembersPerWorkspace >= 0 && used >= limits.maxMembersPerWorkspace) throw new PromaneAdmissionDenied({ status: 403,
              error: `メンバーの上限（${limits.maxMembersPerWorkspace}名）に達しました。利用枠の変更はワークスペースの契約者にご相談ください。`,
              code: 'PROMANE_MEMBER_LIMIT_REACHED', limitReached: true, canManageBilling: false })
            await currentTx.promaneMember.create({ data: { workspaceId: invitation.workspaceId, userId: args.userId,
              role: invitation.role, displayName: args.displayName || invitation.email.split('@')[0] } })
          }
          await claim(currentTx, invitation)
          return { success: true as const, workspaceSlug: invitation.workspace.slug, alreadyMember: !!existing }
        }), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const failure = toolSeatAdmissionFailure(error)
      if (failure) return { success: false, response: { status: failure.status, ...failure.body } }
      if (error instanceof PromaneAdmissionDenied) return { success: false, response: error.response }
      if (error instanceof InvitationExpired) return { success: false, response: { status: 410, error: '有効期限が切れています', code: 'PROMANE_INVITE_EXPIRED' } }
      if (error instanceof PromaneInvitationUnavailable) return { success: false, response: { status: 409, error: '招待の内容が変更されました。招待を確認し直してください。', code: 'PROMANE_INVITE_CHANGED' } }
      const sql = error as { code?: string; meta?: { code?: string } }
      const retryable = sql.code === 'P2034' || sql.code === 'P2010' && ['40001', '40P01'].includes(sql.meta?.code ?? '')
      if (!retryable || attempt === 4) throw error
    }
  }
  throw new Error('Promane invitation admission retries exhausted')
}
