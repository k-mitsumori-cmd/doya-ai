export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { withLifecycleOrganizationWrite } from '@/lib/account-lifecycle/organization-fence'
import { LifecycleError } from '@/lib/account-lifecycle/state'

type Ctx = { params: Promise<{ token: string }> }
const INVITE_TTL_MS = 48 * 60 * 60 * 1000
class InvitationExpired extends Error {}

// GET /api/aio/invite/[token] — 招待の検証
export async function GET(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const member = await prisma.aioMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
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

// POST /api/aio/invite/[token] — 承諾して参加
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

  const member = await prisma.aioMember.findUnique({ where: { inviteToken: p.token }, include: { organization: true } })
  if (!member || member.status !== 'PENDING' || !['admin', 'manager', 'member'].includes(member.role)) {
    return NextResponse.json({ error: '招待が見つからないか、既に承諾済みです' }, { status: 404 })
  }
  if (Date.now() - member.createdAt.getTime() >= INVITE_TTL_MS) {
    return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
  }

  // Pending invitations are unbound. A legacy bound row must not be silently
  // transferred to another account by matching only its email.
  if (member.userId !== null && member.userId !== userId) return NextResponse.json({ error: 'この招待のアカウント状態を確認できません', code: 'INVITE_UNAVAILABLE' }, { status: 409 })

  // 招待は宛先メール本人だけが承諾できる（リンク転送によるなりすまし防止）
  if (!sessionEmail || sessionEmail !== member.inviteEmail?.trim().toLowerCase()) {
    return NextResponse.json(
      { error: 'この招待は別のメールアドレス宛てです。招待されたメールアドレスでログインしてください。' },
      { status: 403 }
    )
  }

  try {
    const result = await withLifecycleOrganizationWrite(prisma, {
      service: 'aio', organizationId: member.organizationId, actorUserId: userId, access: 'invitation',
      targetMemberIds: [member.id], targetUserIds: [userId], targetEmails: [member.inviteEmail!.trim().toLowerCase()],
      grantsAuthority: true, pendingClaimUserId: member.userId === null ? userId : null, repairsUnknownTargetRole: false,
    }, async (tx) => {
      const invite = await tx.aioMember.findUnique({ where: { id: member.id } })
      if (!invite || invite.organizationId !== member.organizationId || invite.status !== 'PENDING' || invite.inviteToken !== p.token || invite.userId !== member.userId || member.userId !== null && invite.role !== member.role) return 'unavailable' as const
      const now = new Date()
      if (invite.createdAt.getTime() <= now.getTime() - INVITE_TTL_MS) return 'expired' as const
      const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!invite.inviteEmail || !account?.email || account.email.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase()) return 'mismatch' as const
      if (!['admin', 'manager', 'member'].includes(invite.role)) return 'unavailable' as const
      const existing = await tx.aioMember.findFirst({ where: { organizationId: member.organizationId, userId, status: 'ACTIVE' } })
      if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
      if (existing) {
        await tx.aioMember.deleteMany({ where: { id: invite.id, organizationId: member.organizationId, role: invite.role, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token } })
        if (Date.now() - invite.createdAt.getTime() >= INVITE_TTL_MS) throw new InvitationExpired()
        return 'already' as const
      }
      const claimed = await tx.aioMember.updateMany({
        where: { id: invite.id, organizationId: member.organizationId, role: invite.role, userId: member.userId, inviteEmail: invite.inviteEmail, status: 'PENDING', inviteToken: p.token, createdAt: { gt: new Date(Date.now() - INVITE_TTL_MS) } },
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
    if (error instanceof LifecycleError) {
      if (error.code === 'LIFECYCLE_PENDING_CLAIM_UNAVAILABLE') {
        const [currentInvite, currentAccount] = await Promise.all([
          prisma.aioMember.findUnique({ where: { id: member.id } }),
          prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
        ])
        if (currentInvite?.status === 'PENDING' && currentInvite.organizationId === member.organizationId && currentInvite.role === member.role && currentInvite.userId === member.userId && currentInvite.inviteToken === p.token && currentInvite.inviteEmail && currentAccount && (!currentAccount.email || currentAccount.email.trim().toLowerCase() !== currentInvite.inviteEmail.trim().toLowerCase())) {
          return NextResponse.json({ error: '招待先のメールアドレスでログインしてください' }, { status: 403 })
        }
      }
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
    }
    if (error instanceof InvitationExpired) return NextResponse.json({ error: '招待の有効期限が切れています' }, { status: 410 })
    return NextResponse.json({ error: '招待を承諾できませんでした。再読み込みしてください' }, { status: 409 })
  }
}
