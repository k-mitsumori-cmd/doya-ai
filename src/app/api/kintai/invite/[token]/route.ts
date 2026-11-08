export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { privateApiJson } from '@/lib/private-api-response'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withToolSeatAdmissionInTransaction, toolSeatAdmissionFailure } from '@/lib/pricing-v2/tool-seat-admission.server'
import { isKintaiInviteExpired } from '@/lib/kintai/invite-token'

type Ctx = { params: Promise<{ token: string }> }
class InvitationExpired extends Error {}
class KintaiAdmissionDenied extends Error {
  constructor(public readonly status: number, public readonly message: string) { super(message) }
}
const allowedInviteRoles = ['system_admin', 'hr_admin', 'manager', 'employee']
const expiredMessage = '招待リンクの有効期限（48時間）が切れています。管理者に再招待を依頼してください。'

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const p = await ctx.params
    const member = await prisma.kintaiMember.findFirst({
      where: { inviteToken: p.token, status: 'PENDING' },
      include: {
        organization: { select: { name: true } },
      },
    })
    if (!member || !allowedInviteRoles.includes(member.role)) {
      return privateApiJson({ error: '無効または期限切れの招待リンクです' }, { status: 404 })
    }

    // 招待トークン有効期限チェック（48時間）
    if (isKintaiInviteExpired(member.inviteToken, member.createdAt)) {
      return privateApiJson({ error: '招待リンクの有効期限（48時間）が切れています。管理者に再招待を依頼してください。' }, { status: 410 })
    }

    const employee = await prisma.kintaiEmployee.findFirst({
      where: { organizationId: member.organizationId, member: { id: member.id } },
      select: { name: true, email: true },
    })

    return privateApiJson({
      organizationName: member.organization.name,
      employeeName: employee?.name || '',
      email: employee?.email || member.inviteEmail,
      role: member.role,
    })
  } catch (e) {
    console.error('[kintai/invite/[token] GET]')
    return privateApiJson({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return privateApiJson({ error: 'ログインが必要です' }, { status: 401 })
    }

    // userId を確実に取得（session.user.id が欠けるケースに対応）
    let userId = (session.user as any)?.id as string | undefined
    if (!userId) {
      const dbUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      userId = dbUser?.id
    }
    if (!userId) {
      return privateApiJson({ error: 'ユーザー情報の取得に失敗しました' }, { status: 400 })
    }

    const p = await ctx.params
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const hint = await prisma.kintaiMember.findFirst({
          where: { inviteToken: p.token, status: 'PENDING' },
          select: { id: true, organizationId: true, role: true, inviteEmail: true, createdAt: true },
        })
        if (!hint) return privateApiJson({ error: '無効または期限切れの招待リンクです' }, { status: 404 })
        const result = await prisma.$transaction(tx => withToolSeatAdmissionInTransaction({
          tool: 'kintai', organizationId: hint.organizationId, actorUserId: userId!,
        }, tx, async currentTx => {
          const tx = currentTx
          const organizations = await tx.$queryRaw<Array<{ id: string }>>
            `SELECT id FROM kintai_organizations WHERE id = ${hint.organizationId} FOR UPDATE`
          if (organizations.length !== 1) throw new KintaiAdmissionDenied(409, '組織の状態が変更されました。招待を確認し直してください。')
          const member = await tx.kintaiMember.findFirst({
            where: { inviteToken: p.token, status: 'PENDING' },
            include: { organization: { select: { name: true } }, employee: { select: { email: true, isActive: true } } },
          })
          if (!member || !allowedInviteRoles.includes(member.role)) throw new KintaiAdmissionDenied(404, '無効または期限切れの招待リンクです')
          if (member.id !== hint.id || member.organizationId !== hint.organizationId || member.role !== hint.role || member.inviteEmail !== hint.inviteEmail || member.createdAt.getTime() !== hint.createdAt.getTime()) {
            throw new KintaiAdmissionDenied(409, '招待の内容が変更されました。招待を確認し直してください。')
          }
          if (isKintaiInviteExpired(member.inviteToken, member.createdAt)) {
            throw new InvitationExpired()
          }
          if (!member.employee) throw new KintaiAdmissionDenied(409, '従業員情報が見つかりません。管理者にお問い合わせください。')
          if (!member.employee.isActive) throw new KintaiAdmissionDenied(409, '無効な従業員情報のため参加できません。管理者にお問い合わせください。')
          const account = await tx.user.findUnique({ where: { id: userId! }, select: { email: true } })
          const invitedEmail = (member.inviteEmail || member.employee.email).trim().toLowerCase()
          if (session.user.email!.trim().toLowerCase() !== invitedEmail || !account?.email || account.email.trim().toLowerCase() !== invitedEmail) {
            throw new KintaiAdmissionDenied(403, '招待先のメールアドレスでログインしてください。')
          }
          const existing = await tx.kintaiMember.findFirst({
            where: { organizationId: member.organizationId, userId, id: { not: member.id } },
          })
          if (isKintaiInviteExpired(member.inviteToken, member.createdAt)) throw new InvitationExpired()
          if (existing) throw new KintaiAdmissionDenied(409, 'このアカウントは既にこの組織に所属しています')

          // 参加すると、ほかの組織の所属は無効になる。その組織で唯一の有効なシステム管理者だった場合、
          // 管理者のいない組織が残り、未使用の管理者席を乗っ取られる原因にもなるため、参加を断る。
          const adminSeats = await tx.kintaiMember.findMany({
            where: { userId, status: 'ACTIVE', role: 'system_admin', id: { not: member.id } },
            select: { id: true, organizationId: true },
          })
          for (const seat of adminSeats) {
            const otherAdmins = await tx.kintaiMember.count({
              // 従業員として無効な管理者は数えない（PATCH の「最後のシステム管理者」判定と同じ条件）
              where: { organizationId: seat.organizationId, id: { not: seat.id }, role: 'system_admin', status: 'ACTIVE', employee: { is: { isActive: true } } },
            })
            if (otherAdmins === 0) {
              throw new KintaiAdmissionDenied(409, '現在の組織で唯一のシステム管理者のため、この招待には参加できません。先に別の方へシステム管理者の権限を引き継いでください。')
            }
          }

          return { role: member.role, value: member }
        }, async (tx, member) => {
          if (isKintaiInviteExpired(member.inviteToken, member.createdAt)) throw new InvitationExpired()
          await tx.kintaiMember.updateMany({
            where: { userId, status: 'ACTIVE', id: { not: member.id } },
            data: { status: 'INACTIVE' },
          })
          const claimed = await tx.kintaiMember.updateMany({
            where: { id: member.id, organizationId: hint.organizationId, role: member.role, inviteEmail: member.inviteEmail, createdAt: member.createdAt, inviteToken: p.token, status: 'PENDING' },
            data: { userId, status: 'ACTIVE', inviteToken: null, acceptedAt: new Date() },
          })
          if (claimed.count !== 1) throw new KintaiAdmissionDenied(409, '招待の状態が変更されました。招待を確認し直してください。')
          // A delayed DB operation must not commit a transfer after expiry.
          if (isKintaiInviteExpired(member.inviteToken, member.createdAt)) throw new InvitationExpired()
          return { status: 200, success: true, organizationId: member.organizationId, organizationName: member.organization.name }
        }), { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
        const { status, ...body } = result
        return privateApiJson(body, { status })
      } catch (e: any) {
        const failure = toolSeatAdmissionFailure(e)
        if (failure) return privateApiJson(failure.body, { status: failure.status })
        if (e instanceof KintaiAdmissionDenied) return privateApiJson({ error: e.message }, { status: e.status })
        if (e instanceof InvitationExpired) return privateApiJson({ error: expiredMessage }, { status: 410 })
        if (e?.code === 'P2002') return privateApiJson({ error: 'このアカウントは既にこの組織に所属しています' }, { status: 409 })
        if (!(e?.code === 'P2034' || e?.code === 'P2010' && ['40001', '40P01'].includes(e?.meta?.code)) || attempt === 4) throw e
      }
    }
    return privateApiJson({ error: '参加に失敗しました。再度お試しください。' }, { status: 500 })
  } catch (e: any) {
    console.error('[kintai/invite/[token] POST]')
    return privateApiJson({ error: '参加に失敗しました。管理者にお問い合わせください。' }, { status: 500 })
  }
}
