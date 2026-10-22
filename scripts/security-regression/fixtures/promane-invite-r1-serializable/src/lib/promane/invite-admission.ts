import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserPromaneLimits } from '@/lib/promane/limits'
import { assertRetirementMembershipWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'
import { LifecycleError } from '@/lib/account-lifecycle/state'

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
class InvitationParticipantsChanged extends Error {}

const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 }
const retryable = (error: unknown) => {
  const failure = error as { code?: string; meta?: { code?: string } }
  return error instanceof InvitationParticipantsChanged || failure?.code === 'P2034' ||
    failure?.code === 'P2010' && ['40001', '40P01'].includes(failure.meta?.code || '')
}
const lifecycleFailure = (error: unknown): AdmissionError | null => error instanceof LifecycleError
  ? { status: error.status, code: error.code, error: error.message }
  : null
const changed = () => { throw new InvitationParticipantsChanged() }
const recipientIds = (rows: Array<{ id: string; email: string | null }>, email: string) => {
  const matched = rows.filter(row => row.email?.trim().toLowerCase() === email)
  if (matched.length > 1) throw new LifecycleError('LIFECYCLE_TARGET_AMBIGUOUS')
  return matched.map(row => row.id)
}

/** Discovery reads do not lock a scope. The caller locks every discovered User before this row. */
async function lockWorkspace(tx: Prisma.TransactionClient, id: string, ownerId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string; userId: string }>>(Prisma.sql`
    SELECT id, "userId" FROM promane_workspaces WHERE id = ${id} FOR UPDATE`)
  if (rows.length !== 1 || rows[0].userId !== ownerId) changed()
}
async function lockInviter(tx: Prisma.TransactionClient, workspaceId: string, userId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM promane_members WHERE "workspaceId" = ${workspaceId} AND "userId" = ${userId} FOR UPDATE`)
  if (rows.length !== 1) return false
  return true
}
async function lockInvitation(tx: Prisma.TransactionClient, id: string, token: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM promane_invitations WHERE id = ${id} AND token = ${token} FOR UPDATE`)
  if (rows.length !== 1) changed()
}

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
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const initialInviter = await tx.promaneMember.findUnique({
          where: { workspaceId_userId: { workspaceId: args.workspaceId, userId: args.userId } },
        })
        if (!initialInviter?.isActive || !['owner', 'admin'].includes(initialInviter.role)) {
          return { success: false, response: { status: 403, error: '招待権限がありません（owner/admin のみ）' } }
        }
        const discoveredWorkspace = await tx.promaneWorkspace.findUnique({
          where: { id: args.workspaceId }, select: { name: true, userId: true },
        })
        if (!discoveredWorkspace) return { success: false, response: { status: 404, error: 'ワークスペースが見つかりません' } }
        const discoveredRecipients = recipientIds(await tx.user.findMany({
          where: { email: { equals: args.email, mode: 'insensitive' } }, select: { id: true, email: true },
        }), args.email)
        const lockedIds = [args.userId, discoveredWorkspace.userId, ...discoveredRecipients]
        await lockLifecycleUsers(tx, lockedIds)
        await lockWorkspace(tx, args.workspaceId, discoveredWorkspace.userId)
        const currentRecipients = recipientIds(await tx.user.findMany({
          where: { email: { equals: args.email, mode: 'insensitive' } }, select: { id: true, email: true },
        }), args.email)
        if (JSON.stringify(currentRecipients.sort()) !== JSON.stringify(discoveredRecipients.sort())) changed()
        await assertRetirementMembershipWritable(tx, lockedIds)
        if (!await lockInviter(tx, args.workspaceId, args.userId)) {
          return { success: false, response: { status: 403, error: '招待権限がありません（owner/admin のみ）' } }
        }
        const inviter = await tx.promaneMember.findUnique({
          where: { workspaceId_userId: { workspaceId: args.workspaceId, userId: args.userId } },
        })
        if (!inviter?.isActive || !['owner', 'admin'].includes(inviter.role)) {
          return { success: false, response: { status: 403, error: '招待権限がありません（owner/admin のみ）' } }
        }
        const existingMember = await tx.promaneMember.findFirst({
          where: { workspaceId: args.workspaceId, user: { email: { equals: args.email, mode: 'insensitive' } } },
        })
        if (existingMember) return { success: false, response: { status: 409, error: '既にメンバーです' } }

        const workspace = await tx.promaneWorkspace.findUnique({
          where: { id: args.workspaceId }, select: { name: true, userId: true },
        })
        if (!workspace || workspace.userId !== discoveredWorkspace.userId) changed()
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
      }, transactionOptions)
    } catch (error) {
      const denied = lifecycleFailure(error)
      if (denied) return { success: false, response: denied }
      if (!retryable(error)) throw error
      if (attempt === 4) return { success: false, response: { status: 409, code: 'PROMANE_INVITE_STATE_CHANGED', error: '招待の状態が変わりました。再読み込みしてご確認ください。' } }
    }
  }
  throw new Error('Promane invitation issue retries exhausted')
}

/** 招待承諾と契約者のメンバー枠判定を同じ直列化可能トランザクションに収める。 */
export async function acceptPromaneInvitation(args: {
  token: string
  userId: string
  email: string | null | undefined
  displayName: string | null | undefined
}): Promise<AdmissionResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const discovered = await tx.promaneInvitation.findUnique({
          where: { token: args.token },
          include: { workspace: { select: { id: true, slug: true, userId: true } } },
        })
        if (!discovered || !['admin', 'member', 'guest'].includes(discovered.role)) return { success: false, response: { status: 404, error: '招待リンクが見つかりません' } }
        if (discovered.acceptedAt) return { success: false, response: { status: 410, error: '既に承諾済みです', code: 'PROMANE_INVITE_ACCEPTED' } }
        if (discovered.expiresAt.getTime() <= Date.now()) return { success: false, response: { status: 410, error: '有効期限が切れています', code: 'PROMANE_INVITE_EXPIRED' } }
        if (!args.email || args.email.toLowerCase() !== discovered.email.toLowerCase()) {
          return { success: false, response: { status: 403, error: `この招待は ${discovered.email} 宛です。一旦ログアウトし、招待されたGoogleアカウントでログインしてください。`, code: 'email_mismatch', expectedEmail: discovered.email } }
        }
        const lockedIds = [args.userId, discovered.workspace.userId]
        await lockLifecycleUsers(tx, lockedIds)
        await lockWorkspace(tx, discovered.workspaceId, discovered.workspace.userId)
        await lockInvitation(tx, discovered.id, args.token)
        const invitation = await tx.promaneInvitation.findUnique({
          where: { token: args.token },
          include: { workspace: { select: { id: true, slug: true, userId: true } } },
        })
        if (!invitation || invitation.id !== discovered.id || invitation.workspaceId !== discovered.workspaceId ||
            invitation.workspace.userId !== discovered.workspace.userId || invitation.email !== discovered.email ||
            invitation.role !== discovered.role || invitation.expiresAt.getTime() !== discovered.expiresAt.getTime() ||
            (invitation.acceptedAt?.getTime() ?? null) !== (discovered.acceptedAt?.getTime() ?? null)) changed()
        if (!invitation || !['admin', 'member', 'guest'].includes(invitation.role)) return { success: false, response: { status: 404, error: '招待リンクが見つかりません' } }
        if (invitation.acceptedAt) return { success: false, response: { status: 410, error: '既に承諾済みです', code: 'PROMANE_INVITE_ACCEPTED' } }
        if (invitation.expiresAt.getTime() <= Date.now()) return { success: false, response: { status: 410, error: '有効期限が切れています', code: 'PROMANE_INVITE_EXPIRED' } }
        if (!args.email || args.email.toLowerCase() !== invitation.email.toLowerCase()) {
          return {
            success: false,
            response: {
              status: 403,
              error: `この招待は ${invitation.email} 宛です。一旦ログアウトし、招待されたGoogleアカウントでログインしてください。`,
              code: 'email_mismatch',
              expectedEmail: invitation.email,
            },
          }
        }
        const recipient = await tx.user.findUnique({ where: { id: args.userId }, select: { email: true } })
        if (!recipient || recipient.email?.trim().toLowerCase() !== invitation.email.toLowerCase()) {
          return { success: false, response: { status: 403, error: 'ログイン状態を確認してください。招待されたアカウントで再度お試しください。', code: 'email_mismatch' } }
        }
        await assertRetirementMembershipWritable(tx, lockedIds)

        const existing = await tx.promaneMember.findUnique({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: args.userId } },
        })
        if (invitation.expiresAt.getTime() <= Date.now()) throw new InvitationExpired()
        if (existing && !existing.isActive) {
          return { success: false, response: { status: 403, error: 'ワークスペースへのアクセスが停止されています。管理者にご確認ください。' } }
        }
        if (existing && !['owner', 'admin', 'member', 'guest'].includes(existing.role)) {
          return { success: false, response: { status: 409, code: 'PROMANE_MEMBER_ROLE_UNAVAILABLE', error: '所属の役割を確認できません。管理者にご確認ください。' } }
        }
        if (!existing) {
          const limits = await getUserPromaneLimits(invitation.workspace.userId, tx)
          const used = await tx.promaneMember.count({ where: { workspaceId: invitation.workspaceId, isActive: true } })
          if (invitation.expiresAt.getTime() <= Date.now()) throw new InvitationExpired()
          if (limits.maxMembersPerWorkspace >= 0 && used >= limits.maxMembersPerWorkspace) {
            return {
              success: false,
              response: {
                status: 403,
                error: `メンバーの上限（${limits.maxMembersPerWorkspace}名）に達しました。利用枠の変更はワークスペースの契約者にご相談ください。`,
                code: 'PROMANE_MEMBER_LIMIT_REACHED',
                limitReached: true,
                canManageBilling: false,
              },
            }
          }
          await tx.promaneMember.create({
            data: {
              workspaceId: invitation.workspaceId,
              userId: args.userId,
              role: invitation.role,
              displayName: args.displayName || invitation.email.split('@')[0],
            },
          })
        }
        await tx.promaneInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } })
        // Throw outside the success path so the whole membership write rolls back.
        if (invitation.expiresAt.getTime() <= Date.now()) throw new InvitationExpired()
        return { success: true, workspaceSlug: invitation.workspace.slug, alreadyMember: !!existing }
      }, transactionOptions)
    } catch (error) {
      if (error instanceof InvitationExpired) return { success: false, response: { status: 410, error: '有効期限が切れています', code: 'PROMANE_INVITE_EXPIRED' } }
      const denied = lifecycleFailure(error)
      if (denied) return { success: false, response: denied }
      if (!retryable(error)) throw error
      if (attempt === 4) return { success: false, response: { status: 409, code: 'PROMANE_INVITE_STATE_CHANGED', error: '招待の状態が変わりました。再読み込みしてご確認ください。' } }
    }
  }
  throw new Error('Promane invitation admission retries exhausted')
}
