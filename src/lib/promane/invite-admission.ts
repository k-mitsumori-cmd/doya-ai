import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getUserPromaneLimits } from '@/lib/promane/limits'

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
        const now = new Date()
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
          where: { workspaceId: args.workspaceId, email: args.email, acceptedAt: null, expiresAt: { gt: now } },
        })
        if (existingInvite) {
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
          where: { workspaceId: args.workspaceId, acceptedAt: null, expiresAt: { gt: now } },
        })
        if (atLimit(active + pending)) return limitResponse()
        const invitation = await tx.promaneInvitation.create({
          data: {
            workspaceId: args.workspaceId,
            email: args.email,
            role: args.role,
            token: crypto.randomBytes(32).toString('hex'),
            invitedById: args.userId,
            expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
          select: { token: true, expiresAt: true },
        })
        return { success: true, invitation, workspaceName: workspace.name, reused: false }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || attempt === 4) throw error
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
        const invitation = await tx.promaneInvitation.findUnique({
          where: { token: args.token },
          include: { workspace: { select: { id: true, slug: true, userId: true } } },
        })
        if (!invitation) return { success: false, response: { status: 404, error: '招待リンクが見つかりません' } }
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

        const existing = await tx.promaneMember.findUnique({
          where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: args.userId } },
        })
        if (existing && !existing.isActive) {
          return { success: false, response: { status: 403, error: 'ワークスペースへのアクセスが停止されています。管理者にご確認ください。' } }
        }
        if (!existing) {
          const limits = await getUserPromaneLimits(invitation.workspace.userId, tx)
          const used = await tx.promaneMember.count({ where: { workspaceId: invitation.workspaceId, isActive: true } })
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
        return { success: true, workspaceSlug: invitation.workspace.slug, alreadyMember: !!existing }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if ((error as { code?: string })?.code !== 'P2034' || attempt === 4) throw error
    }
  }
  throw new Error('Promane invitation admission retries exhausted')
}
